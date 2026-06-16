import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  GMAPS_PLAN_CATALOG,
  GMAPS_SKU_CATALOG,
  adjustCredits,
  confirmProductQuota,
  createCloudStore,
  createOrder,
  getEntitlements,
  getProductEntitlements,
  markOrderPaid,
  registerUser,
  releaseProductQuota,
  reserveProductQuota,
} from "../src/services/billingService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

test("defines the BizFinder catalog and product-scoped PostgreSQL tables", () => {
  const schema = fs.readFileSync(path.join(serverRoot, "src/db/schema.sql"), "utf8");

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(GMAPS_SKU_CATALOG).map(([sku, item]) => [
        sku,
        [item.planId, item.credits, item.amountCents],
      ]),
    ),
    {
      PLUS_200_299: ["advanced", 200, 29900],
      PRO_400_499: ["professional", 400, 49900],
      ULTRA_800_899: ["business", 800, 89900],
    },
  );
  assert.equal(GMAPS_PLAN_CATALOG.free.dailyLimit, 10);
  assert.equal(GMAPS_PLAN_CATALOG.free.taskLimit, 20);
  assert.equal(GMAPS_PLAN_CATALOG.advanced.dailyLimit, 200);
  assert.equal(GMAPS_PLAN_CATALOG.professional.dailyLimit, 500);
  assert.equal(GMAPS_PLAN_CATALOG.business.dailyLimit, 1000);

  for (const table of [
    "product_subscriptions",
    "product_credit_ledger",
    "product_usage_daily",
    "quota_reservations",
    "quota_reservation_items",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}\\b`, "i"));
  }
  assert.match(schema, /product_code/i);
  assert.match(schema, /sku/i);
});

test("grants the BizFinder free balance once and keeps it separate from WhatsApp", () => {
  const store = createCloudStore();
  const user = registerUser(store, {
    username: "gmaps-free-user",
    password: "StrongPass123",
    planId: "advanced",
  });
  adjustCredits(store, {
    adminUserId: "admin-1",
    userId: user.id,
    amount: 50,
    reason: "whatsapp balance",
  });

  const first = getProductEntitlements(store, { userId: user.id, product: "gmaps" });
  const second = getProductEntitlements(store, { userId: user.id, product: "gmaps" });

  assert.equal(first.planId, "free");
  assert.equal(first.balanceCredits, 20);
  assert.equal(second.balanceCredits, 20);
  assert.equal(getEntitlements(store, user.id).balanceCredits, 50);
  assert.equal(
    store.productCreditLedger.filter((entry) => entry.type === "free_grant").length,
    1,
  );
});

test("validates fixed BizFinder SKUs and never downgrades the highest paid plan", () => {
  const store = createCloudStore();
  const user = registerUser(store, {
    username: "gmaps-order-user",
    password: "StrongPass123",
  });

  assert.throws(
    () =>
      createOrder(store, {
        userId: user.id,
        product: "gmaps",
        sku: "PLUS_200_299",
        credits: 201,
        amountCents: 29900,
      }),
    /PRODUCT_SKU_MISMATCH/,
  );

  const ultra = createOrder(store, {
    userId: user.id,
    product: "gmaps",
    sku: "ULTRA_800_899",
    credits: 800,
    amountCents: 89900,
  });
  assert.equal(ultra.amountCents, 89900);
  assert.equal(ultra.productCode, "gmaps");
  assert.equal(ultra.sku, "ULTRA_800_899");
  markOrderPaid(store, {
    orderId: ultra.id,
    adminUserId: "admin-1",
    providerTradeNo: "gmaps-ultra",
  });

  const plus = createOrder(store, {
    userId: user.id,
    product: "gmaps",
    sku: "PLUS_200_299",
    credits: 200,
    amountCents: 29900,
  });
  markOrderPaid(store, {
    orderId: plus.id,
    adminUserId: "admin-1",
    providerTradeNo: "gmaps-plus",
  });

  const entitlements = getProductEntitlements(store, { userId: user.id, product: "gmaps" });
  assert.equal(entitlements.planId, "business");
  assert.equal(entitlements.balanceCredits, 1020);
  assert.equal(getEntitlements(store, user.id).balanceCredits, 0);
});

test("reserves within plan limits and charges confirmed results exactly once", () => {
  const store = createCloudStore();
  const user = registerUser(store, {
    username: "gmaps-quota-user",
    password: "StrongPass123",
  });
  const order = createOrder(store, {
    userId: user.id,
    product: "gmaps",
    sku: "PLUS_200_299",
    credits: 200,
    amountCents: 29900,
  });
  markOrderPaid(store, {
    orderId: order.id,
    adminUserId: "admin-1",
    providerTradeNo: "gmaps-plus-paid",
  });

  assert.throws(
    () => reserveProductQuota(store, { userId: user.id, product: "gmaps", units: 201 }),
    /TASK_LIMIT_REACHED/,
  );

  const reservation = reserveProductQuota(store, {
    userId: user.id,
    product: "gmaps",
    units: 3,
  });
  const first = confirmProductQuota(store, {
    userId: user.id,
    product: "gmaps",
    reservationId: reservation.reservation_id,
    placeIndex: 0,
    decision: "confirmed_phone",
  });
  const replay = confirmProductQuota(store, {
    userId: user.id,
    product: "gmaps",
    reservationId: reservation.reservation_id,
    placeIndex: 0,
    decision: "confirmed_phone",
  });
  releaseProductQuota(store, {
    userId: user.id,
    product: "gmaps",
    reservationId: reservation.reservation_id,
    placeIndex: 1,
    decision: "duplicate_or_empty_phone",
  });
  releaseProductQuota(store, {
    userId: user.id,
    product: "gmaps",
    reservationId: reservation.reservation_id,
    placeIndex: 2,
    decision: "stage_failed",
  });

  assert.equal(first.idempotentReplay, false);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(
    getProductEntitlements(store, { userId: user.id, product: "gmaps" }).balanceCredits,
    219,
  );
  assert.equal(
    store.productCreditLedger.filter((entry) => entry.type === "consume").length,
    1,
  );
});
