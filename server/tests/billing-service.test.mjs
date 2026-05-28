import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  adjustCredits,
  consumeCredit,
  createCloudStore,
  createOrder,
  getEntitlements,
  issueWorkspaceLease,
  markOrderPaid,
  processPaymentEvent,
  processPendingOrderCredits,
  releaseWorkspaceLease,
  renewWorkspaceLease,
  registerUser
} from "../src/services/billingService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

describe("cloud billing service", () => {
  it("defines the required PostgreSQL tables from the commercialization plan", () => {
    const schema = fs.readFileSync(path.join(serverRoot, "src/db/schema.sql"), "utf8");

    for (const table of [
      "users",
      "sessions",
      "devices",
      "plans",
      "subscriptions",
      "credit_ledger",
      "usage_daily",
      "usage_monthly",
      "orders",
      "payment_events",
      "referral_codes",
      "referral_records",
      "workspace_leases",
      "admin_users",
      "admin_sessions",
      "admin_audit_logs"
    ]) {
      assert.match(schema, new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}\\b`, "i"), `missing table: ${table}`);
    }

    assert.match(schema, /INSERT INTO plans/i);
    assert.match(schema, /advanced/);
    assert.match(schema, /professional/);
    assert.match(schema, /business/);
    assert.match(schema, /INSERT INTO admin_users/i);
    assert.doesNotMatch(schema, /AdminPass123/);
  });

  it("provides local Docker and migration entrypoints for visible PostgreSQL setup", () => {
    const compose = fs.readFileSync(path.join(serverRoot, "docker-compose.yml"), "utf8");
    const applySchema = fs.readFileSync(path.join(serverRoot, "scripts/apply-schema.ps1"), "utf8");

    assert.match(compose, /container_name:\s*add-whatsapp-postgres/);
    assert.match(compose, /POSTGRES_DB:\s*addwhatsapp/);
    assert.match(compose, /55433:5432/);
    assert.match(applySchema, /schema\.sql/);
    assert.match(applySchema, /docker exec/);
    assert.match(applySchema, /\\dt/);
  });

  it("separates credit balance from daily usage when calculating entitlements", () => {
    const store = createCloudStore({ now: new Date("2026-05-26T10:00:00+08:00") });
    const user = registerUser(store, { username: "plus-user", password: "StrongPass123", planId: "advanced" });

    adjustCredits(store, {
      adminUserId: "admin-1",
      userId: user.id,
      amount: 500,
      reason: "manual top up",
      ip: "127.0.0.1"
    });

    const before = getEntitlements(store, user.id);
    assert.equal(before.balanceCredits, 500);
    assert.equal(before.dailyLimit, 200);
    assert.equal(before.usedToday, 0);
    assert.equal(before.availableToday, 200);

    consumeCredit(store, {
      userId: user.id,
      idempotencyKey: "consume:user:task:contact:1",
      taskId: "task-1",
      contactHash: "contact-1",
      workspaceId: "workspace-1",
      sentAt: "2026-05-26T10:01:00+08:00"
    });

    const after = getEntitlements(store, user.id);
    assert.equal(after.balanceCredits, 499);
    assert.equal(after.usedToday, 1);
    assert.equal(after.availableToday, 199);
  });

  it("makes successful-add billing idempotent", () => {
    const store = createCloudStore();
    const user = registerUser(store, { username: "idempotent-user", password: "StrongPass123", planId: "professional" });
    adjustCredits(store, { adminUserId: "admin-1", userId: user.id, amount: 50, reason: "seed", ip: "127.0.0.1" });

    const first = consumeCredit(store, {
      userId: user.id,
      idempotencyKey: "consume:dedupe",
      taskId: "task-1",
      contactHash: "contact-hash",
      workspaceId: "workspace-1",
      sentAt: "2026-05-26T12:00:00+08:00"
    });
    const duplicate = consumeCredit(store, {
      userId: user.id,
      idempotencyKey: "consume:dedupe",
      taskId: "task-1",
      contactHash: "contact-hash",
      workspaceId: "workspace-1",
      sentAt: "2026-05-26T12:00:00+08:00"
    });

    assert.equal(first.idempotentReplay, false);
    assert.equal(duplicate.idempotentReplay, true);
    assert.equal(getEntitlements(store, user.id).balanceCredits, 49);
    assert.equal(store.creditLedger.filter((entry) => entry.type === "consume").length, 1);
  });

  it("only changes balances through ledger entries and audit-backed admin adjustments", () => {
    const store = createCloudStore();
    const user = registerUser(store, { username: "audit-user", password: "StrongPass123", planId: "business" });

    const result = adjustCredits(store, {
      adminUserId: "admin-1",
      userId: user.id,
      amount: 2000,
      reason: "manual paid transfer",
      ip: "10.0.0.8"
    });

    assert.equal(result.balanceCredits, 2000);
    assert.equal(store.creditLedger.at(-1).type, "admin_adjustment");
    assert.equal(store.auditLogs.at(-1).action, "credit.adjustment");
    assert.equal(store.auditLogs.at(-1).ip, "10.0.0.8");
  });

  it("marks manual orders paid through purchase ledger entries once", () => {
    const store = createCloudStore();
    const user = registerUser(store, { username: "order-user", password: "StrongPass123", planId: "advanced" });
    const order = createOrder(store, { userId: user.id, planId: "advanced", credits: 2000, amountCents: 60000 });

    markOrderPaid(store, { orderId: order.id, adminUserId: "admin-1", providerTradeNo: "bank-transfer-1", ip: "127.0.0.1" });
    markOrderPaid(store, { orderId: order.id, adminUserId: "admin-1", providerTradeNo: "bank-transfer-1", ip: "127.0.0.1" });

    assert.equal(getEntitlements(store, user.id).balanceCredits, 2000);
    assert.equal(store.creditLedger.filter((entry) => entry.type === "purchase").length, 1);
    assert.equal(store.orders.get(order.id).status, "paid");
  });

  it("processes paid payment callbacks idempotently before crediting orders", () => {
    const store = createCloudStore();
    const user = registerUser(store, { username: "callback-user", password: "StrongPass123", planId: "advanced" });
    const order = createOrder(store, { userId: user.id, planId: "advanced", credits: 2000, amountCents: 60000 });

    const first = processPaymentEvent(store, {
      provider: "manual",
      providerEventId: "evt-paid-1",
      orderId: order.id,
      eventType: "payment_succeeded",
      providerTradeNo: "manual-trade-1",
      payload: { paidAt: "2026-05-29T10:00:00+08:00" }
    });
    const duplicate = processPaymentEvent(store, {
      provider: "manual",
      providerEventId: "evt-paid-1",
      orderId: order.id,
      eventType: "payment_succeeded",
      providerTradeNo: "manual-trade-1",
      payload: { duplicate: true }
    });

    assert.equal(first.idempotentReplay, false);
    assert.equal(duplicate.idempotentReplay, true);
    assert.equal(getEntitlements(store, user.id).balanceCredits, 2000);
    assert.equal(store.paymentEvents.size, 1);
    assert.equal(store.creditLedger.filter((entry) => entry.type === "purchase").length, 1);
  });

  it("retries paid pending credit orders without duplicating purchase ledger entries", () => {
    const store = createCloudStore();
    const user = registerUser(store, { username: "compensate-user", password: "StrongPass123", planId: "professional" });
    const order = createOrder(store, { userId: user.id, planId: "professional", credits: 5000, amountCents: 100000 });
    store.orders.set(order.id, {
      ...order,
      status: "paid_pending_credit",
      providerTradeNo: "manual-pending-1",
      paidAt: "2026-05-29T10:05:00+08:00"
    });

    const first = processPendingOrderCredits(store, { limit: 10 });
    const second = processPendingOrderCredits(store, { limit: 10 });

    assert.equal(first.processedCount, 1);
    assert.equal(second.processedCount, 0);
    assert.equal(getEntitlements(store, user.id).balanceCredits, 5000);
    assert.equal(store.orders.get(order.id).status, "paid");
    assert.equal(store.creditLedger.filter((entry) => entry.type === "purchase").length, 1);
  });

  it("enforces workspace lease limits from the active plan", () => {
    const store = createCloudStore();
    const user = registerUser(store, { username: "lease-user", password: "StrongPass123", planId: "advanced" });

    issueWorkspaceLease(store, { userId: user.id, deviceId: "device-1", workspaceKind: "primary", processNonce: "p1" });
    issueWorkspaceLease(store, { userId: user.id, deviceId: "device-1", workspaceKind: "secondary", processNonce: "p2" });

    assert.throws(
      () => issueWorkspaceLease(store, { userId: user.id, deviceId: "device-1", workspaceKind: "secondary", processNonce: "p3" }),
      /WORKSPACE_LIMIT_REACHED/
    );
  });

  it("renews and releases workspace leases for the owning user", () => {
    const store = createCloudStore({ now: new Date("2026-05-28T10:00:00+08:00") });
    const user = registerUser(store, { username: "lease-lifecycle-user", password: "StrongPass123", planId: "advanced" });
    const lease = issueWorkspaceLease(store, { userId: user.id, deviceId: "device-1", workspaceKind: "secondary", processNonce: "p1" });

    store.now = () => new Date("2026-05-28T10:00:30+08:00");
    const renewed = renewWorkspaceLease(store, { userId: user.id, leaseId: lease.leaseId });
    assert.equal(renewed.leaseId, lease.leaseId);
    assert.equal(renewed.status, "active");
    assert.notEqual(renewed.expiresAt, lease.expiresAt);

    const released = releaseWorkspaceLease(store, { userId: user.id, leaseId: lease.leaseId });
    assert.equal(released.status, "released");
    assert.equal(store.workspaceLeases.get(lease.leaseId).status, "released");

    assert.throws(
      () => renewWorkspaceLease(store, { userId: user.id, leaseId: lease.leaseId }),
      /WORKSPACE_LEASE_NOT_ACTIVE/
    );
  });
});
