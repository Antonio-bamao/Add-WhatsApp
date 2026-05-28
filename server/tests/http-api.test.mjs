import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createAppServer, createRuntimeFromEnv } from "../src/app.js";
import { signMockAlipayPayload } from "../src/services/paymentProviders.js";

async function withServer(testFn, options = {}) {
  const server = createAppServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await testFn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
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

describe("cloud API skeleton", () => {
  it("serves health, auth, entitlements, admin adjustment, credit consume, leases, and audit logs", async () => {
    await withServer(async (baseUrl) => {
      const health = await request(baseUrl, "/v1/health");
      assert.equal(health.response.status, 200);
      assert.equal(health.payload.ok, true);

      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "api-user", password: "StrongPass123", planId: "advanced" }
      });
      assert.equal(registered.response.status, 201);
      assert.ok(registered.payload.accessToken);

      const token = registered.payload.accessToken;
      const auth = { authorization: `Bearer ${token}` };

      const rejectedAdjustment = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: auth,
        body: { userId: registered.payload.user.id, amount: 300, reason: "manual transfer" }
      });
      assert.equal(rejectedAdjustment.response.status, 403);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "admin-preview", password: "AdminPass123" }
      });
      assert.equal(adminLogin.response.status, 200);
      assert.ok(adminLogin.payload.adminAccessToken);
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };

      const adjusted = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: adminAuth,
        body: { userId: registered.payload.user.id, amount: 300, reason: "manual transfer" }
      });
      assert.equal(adjusted.response.status, 200);
      assert.equal(adjusted.payload.balanceCredits, 300);

      const entitlements = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(entitlements.response.status, 200);
      assert.equal(entitlements.payload.availableToday, 200);

      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });
      assert.equal(order.response.status, 201);
      assert.equal(order.payload.status, "created");

      const rejectedPaymentEvent = await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        body: {
          provider: "manual",
          providerEventId: "evt-api-paid-1",
          orderId: order.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-api-1"
        }
      });
      assert.equal(rejectedPaymentEvent.response.status, 401);

      const paymentEvent = await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        headers: adminAuth,
        body: {
          provider: "manual",
          providerEventId: "evt-api-paid-1",
          orderId: order.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-api-1"
        }
      });
      assert.equal(paymentEvent.response.status, 200);
      assert.equal(paymentEvent.payload.order.status, "paid");

      const duplicatePaymentEvent = await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        headers: adminAuth,
        body: {
          provider: "manual",
          providerEventId: "evt-api-paid-1",
          orderId: order.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-api-1"
        }
      });
      assert.equal(duplicatePaymentEvent.response.status, 200);
      assert.equal(duplicatePaymentEvent.payload.idempotentReplay, true);

      const compensation = await request(baseUrl, "/v1/admin/orders/compensate", {
        method: "POST",
        headers: adminAuth,
        body: { limit: 10 }
      });
      assert.equal(compensation.response.status, 200);
      assert.equal(compensation.payload.processedCount, 0);

      const consumed = await request(baseUrl, "/v1/credits/consume", {
        method: "POST",
        headers: auth,
        body: {
          idempotencyKey: "api-consume-1",
          taskId: "task-api",
          contactHash: "hash-api",
          workspaceId: "workspace-api",
          sentAt: "2026-05-26T14:00:00+08:00"
        }
      });
      assert.equal(consumed.response.status, 200);
      assert.equal(consumed.payload.balanceCredits, 2299);

      const lease = await request(baseUrl, "/v1/workspaces/leases", {
        method: "POST",
        headers: auth,
        body: { deviceId: "device-api", workspaceKind: "primary", processNonce: "nonce-api" }
      });
      assert.equal(lease.response.status, 201);
      assert.ok(lease.payload.leaseId);

      const renewedLease = await request(baseUrl, `/v1/workspaces/leases/${lease.payload.leaseId}/renew`, {
        method: "POST",
        headers: auth
      });
      assert.equal(renewedLease.response.status, 200);
      assert.equal(renewedLease.payload.status, "active");

      const releasedLease = await request(baseUrl, `/v1/workspaces/leases/${lease.payload.leaseId}/release`, {
        method: "POST",
        headers: auth
      });
      assert.equal(releasedLease.response.status, 200);
      assert.equal(releasedLease.payload.status, "released");

      const audit = await request(baseUrl, "/v1/admin/audit-logs", { headers: adminAuth });
      assert.equal(audit.response.status, 200);
      assert.ok(audit.payload.items.some((entry) => entry.action === "credit.adjustment"));

      const consoleSnapshot = await request(baseUrl, "/v1/admin/console");
      assert.equal(consoleSnapshot.response.status, 200);
      assert.equal(consoleSnapshot.payload.source, "server-local-preview");
      assert.equal(consoleSnapshot.payload.summary.users, 1);
      assert.equal(consoleSnapshot.payload.modules.users.records.length, 1);
      assert.equal(consoleSnapshot.payload.modules.plans.records.length, 4);
      assert.ok(consoleSnapshot.payload.auditTrail.some((entry) => entry.action === "credit.adjustment"));
    });
  });

  it("accepts signed mock_alipay notifications and rejects tampered callbacks", async () => {
    const secret = "http_mock_alipay_secret";
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "pay-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });
      assert.equal(order.response.status, 201);

      const payload = {
        app_id: "mock-app",
        notify_id: "notify-http-001",
        out_trade_no: order.payload.orderNo,
        trade_no: "mock-trade-http-001",
        trade_status: "TRADE_SUCCESS",
        total_amount: "600.00"
      };
      const signed = { ...payload, sign: signMockAlipayPayload(payload, secret) };

      const paid = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: signed
      });
      assert.equal(paid.response.status, 200);
      assert.equal(paid.payload.order.status, "paid");

      const duplicate = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: signed
      });
      assert.equal(duplicate.response.status, 200);
      assert.equal(duplicate.payload.idempotentReplay, true);

      const balance = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(balance.payload.balanceCredits, 2000);

      const tampered = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: { ...signed, notify_id: "notify-http-002", total_amount: "1.00" }
      });
      assert.equal(tampered.response.status, 401);
    }, { env: { MOCK_ALIPAY_WEBHOOK_SECRET: secret } });
  });

  it("routes through an async billing runtime instead of a hard-coded memory store", async () => {
    const runtime = {
      mode: "test-runtime",
      getAdminConsoleSnapshot: async () => ({
        source: "test-runtime",
        summary: { users: 9 },
        modules: { users: { records: [["runtime-user", "active", "PLUS", "test"]] } },
        actionQueue: [],
        auditTrail: []
      })
    };

    await withServer(async (baseUrl) => {
      const health = await request(baseUrl, "/v1/health");
      assert.equal(health.payload.mode, "test-runtime");

      const consoleSnapshot = await request(baseUrl, "/v1/admin/console");
      assert.equal(consoleSnapshot.payload.source, "test-runtime");
      assert.equal(consoleSnapshot.payload.summary.users, 9);
    }, { runtime });
  });

  it("lets admins freeze users and release abnormal workspace leases with audit logs", async () => {
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "ops-user", password: "StrongPass123", planId: "advanced" }
      });
      assert.equal(registered.response.status, 201);
      const userAuth = { authorization: `Bearer ${registered.payload.accessToken}` };

      const lease = await request(baseUrl, "/v1/workspaces/leases", {
        method: "POST",
        headers: userAuth,
        body: { deviceId: "ops-device", workspaceKind: "secondary", processNonce: "ops-nonce" }
      });
      assert.equal(lease.response.status, 201);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "admin-preview", password: "AdminPass123" }
      });
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };

      const releasedLease = await request(baseUrl, `/v1/admin/workspaces/leases/${lease.payload.leaseId}/release`, {
        method: "POST",
        headers: adminAuth,
        body: { reason: "stale process cleanup" }
      });
      assert.equal(releasedLease.response.status, 200);
      assert.equal(releasedLease.payload.status, "released");

      const frozen = await request(baseUrl, `/v1/admin/users/${registered.payload.user.id}/status`, {
        method: "POST",
        headers: adminAuth,
        body: { status: "frozen", reason: "risk review" }
      });
      assert.equal(frozen.response.status, 200);
      assert.equal(frozen.payload.status, "frozen");

      const rejectedEntitlements = await request(baseUrl, "/v1/me/entitlements", { headers: userAuth });
      assert.equal(rejectedEntitlements.response.status, 401);

      const audit = await request(baseUrl, "/v1/admin/audit-logs", { headers: adminAuth });
      assert.equal(audit.response.status, 200);
      assert.ok(audit.payload.items.some((entry) => entry.action === "workspace.release"));
      assert.ok(audit.payload.items.some((entry) => entry.action === "user.status_update"));
    });
  });

  it("selects the PostgreSQL runtime when DATABASE_URL is configured", async () => {
    const runtime = createRuntimeFromEnv({ DATABASE_URL: "postgres://user:pass@127.0.0.1:5432/addwhatsapp" });

    assert.equal(runtime.mode, "postgres");
    await runtime.close();
  });
});
