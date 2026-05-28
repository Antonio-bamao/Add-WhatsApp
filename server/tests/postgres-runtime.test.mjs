import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { createAppServer } from "../src/app.js";
import { signMockAlipayPayload } from "../src/services/paymentProviders.js";

const databaseUrl = process.env.ADD_WHATSAPP_TEST_DATABASE_URL || "";

async function withServer(runtime, testFn, options = {}) {
  const server = createAppServer({ runtime, ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await testFn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await runtime.close?.();
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json();
  return { response, payload };
}

describe("PostgreSQL billing runtime", { skip: !databaseUrl }, () => {
  it("persists users and credit ledger entries across runtime restarts", async () => {
    const { createPostgresRuntime } = await import("../src/db/postgresRuntime.js");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const username = `pg_user_${Date.now()}`;
    const password = "StrongPass123";
    let registeredUserId = "";

    await withServer(createPostgresRuntime({ databaseUrl }), async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username, password, planId: "advanced" }
      });
      assert.equal(registered.response.status, 201);
      registeredUserId = registered.payload.user.id;

      const rejectedAdjustment = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: { authorization: `Bearer ${registered.payload.accessToken}` },
        body: { userId: registeredUserId, amount: 123, reason: "postgres persistence test" }
      });
      assert.equal(rejectedAdjustment.response.status, 403);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "admin-preview", password: "AdminPass123" }
      });
      assert.equal(adminLogin.response.status, 200);
      assert.ok(adminLogin.payload.adminAccessToken);

      const adjusted = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` },
        body: { userId: registeredUserId, amount: 123, reason: "postgres persistence test" }
      });
      assert.equal(adjusted.response.status, 200);
      assert.equal(adjusted.payload.balanceCredits, 123);
    });

    await withServer(createPostgresRuntime({ databaseUrl }), async (baseUrl) => {
      const login = await request(baseUrl, "/v1/auth/login", {
        method: "POST",
        body: { username, password, deviceId: "restart-device" }
      });
      assert.equal(login.response.status, 200);
      assert.equal(login.payload.user.id, registeredUserId);

      const entitlements = await request(baseUrl, "/v1/me/entitlements", {
        headers: { authorization: `Bearer ${login.payload.accessToken}` }
      });
      assert.equal(entitlements.response.status, 200);
      assert.equal(entitlements.payload.balanceCredits, 123);
      assert.equal(entitlements.payload.planId, "advanced");

      const auth = { authorization: `Bearer ${login.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });
      assert.equal(order.response.status, 201);

      const alipayPayment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/alipay/page-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(alipayPayment.response.status, 200);
      assert.equal(alipayPayment.payload.orderId, order.payload.id);
      const signingText = Object.keys(alipayPayment.payload.params)
        .filter((key) => key !== "sign" && key !== "sign_type")
        .sort()
        .map((key) => `${key}=${alipayPayment.payload.params[key]}`)
        .join("&");
      assert.equal(
        crypto.verify("RSA-SHA256", Buffer.from(signingText), publicKey, Buffer.from(alipayPayment.payload.params.sign, "base64")),
        true
      );

      const mockAlipaySecret = "pg_mock_alipay_secret";
      const payload = {
        app_id: "mock-app",
        notify_id: `pg-paid-${Date.now()}`,
        out_trade_no: order.payload.orderNo,
        trade_no: `pg-manual-${Date.now()}`,
        trade_status: "TRADE_SUCCESS",
        total_amount: "600.00"
      };
      const signedPayload = {
        ...payload,
        sign: signMockAlipayPayload(payload, mockAlipaySecret)
      };
      const paid = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: signedPayload
      });
      assert.equal(paid.response.status, 200);
      assert.equal(paid.payload.order.status, "paid");

      const duplicatePaid = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: signedPayload
      });
      assert.equal(duplicatePaid.response.status, 200);
      assert.equal(duplicatePaid.payload.idempotentReplay, true);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "admin-preview", password: "AdminPass123" }
      });
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };

      const compensated = await request(baseUrl, "/v1/admin/orders/compensate", {
        method: "POST",
        headers: adminAuth,
        body: { limit: 10 }
      });
      assert.equal(compensated.response.status, 200);
      assert.equal(compensated.payload.processedCount, 0);

      const paymentEvents = await request(baseUrl, "/v1/admin/payment-events?provider=mock_alipay&processed=processed&limit=5", {
        headers: adminAuth
      });
      assert.equal(paymentEvents.response.status, 200);
      assert.ok(paymentEvents.payload.total >= 1);
      assert.ok(paymentEvents.payload.items.some((event) => event.providerEventId === `mock_alipay:${payload.notify_id}:TRADE_SUCCESS`));

      const afterPaid = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(afterPaid.response.status, 200);
      assert.equal(afterPaid.payload.balanceCredits, 2123);

      const lease = await request(baseUrl, "/v1/workspaces/leases", {
        method: "POST",
        headers: auth,
        body: { deviceId: "restart-device", workspaceKind: "secondary", processNonce: `pg-${Date.now()}` }
      });
      assert.equal(lease.response.status, 201);
      assert.ok(lease.payload.leaseId);

      const renewed = await request(baseUrl, `/v1/workspaces/leases/${lease.payload.leaseId}/renew`, {
        method: "POST",
        headers: auth
      });
      assert.equal(renewed.response.status, 200);
      assert.equal(renewed.payload.status, "active");

      const released = await request(baseUrl, `/v1/workspaces/leases/${lease.payload.leaseId}/release`, {
        method: "POST",
        headers: auth
      });
      assert.equal(released.response.status, 200);
      assert.equal(released.payload.status, "released");

      const secondLease = await request(baseUrl, "/v1/workspaces/leases", {
        method: "POST",
        headers: auth,
        body: { deviceId: "restart-device", workspaceKind: "secondary", processNonce: `pg-admin-${Date.now()}` }
      });
      assert.equal(secondLease.response.status, 201);
      const adminReleased = await request(baseUrl, `/v1/admin/workspaces/leases/${secondLease.payload.leaseId}/release`, {
        method: "POST",
        headers: adminAuth,
        body: { reason: "postgres stale lease cleanup" }
      });
      assert.equal(adminReleased.response.status, 200);
      assert.equal(adminReleased.payload.status, "released");

      const frozen = await request(baseUrl, `/v1/admin/users/${registeredUserId}/status`, {
        method: "POST",
        headers: adminAuth,
        body: { status: "frozen", reason: "postgres risk review" }
      });
      assert.equal(frozen.response.status, 200);
      assert.equal(frozen.payload.status, "frozen");

      const rejectedWhileFrozen = await request(baseUrl, "/v1/me/entitlements", {
        headers: auth
      });
      assert.equal(rejectedWhileFrozen.response.status, 401);

      const restored = await request(baseUrl, `/v1/admin/users/${registeredUserId}/status`, {
        method: "POST",
        headers: adminAuth,
        body: { status: "active", reason: "postgres test restore" }
      });
      assert.equal(restored.response.status, 200);
      assert.equal(restored.payload.status, "active");

      const consoleSnapshot = await request(baseUrl, "/v1/admin/console");
      assert.equal(consoleSnapshot.payload.source, "postgres");
      assert.ok(consoleSnapshot.payload.summary.users >= 1);
      assert.ok(consoleSnapshot.payload.summary.creditEntries >= 1);
    }, {
      env: {
        MOCK_ALIPAY_WEBHOOK_SECRET: "pg_mock_alipay_secret",
        ALIPAY_APP_ID: "2026000000000000",
        ALIPAY_APP_PRIVATE_KEY: privateKey,
        ALIPAY_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/alipay/notify",
        ALIPAY_GATEWAY_URL: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
        ALIPAY_FIXED_TIMESTAMP: "2026-05-29 10:20:30"
      }
    });
  });
});
