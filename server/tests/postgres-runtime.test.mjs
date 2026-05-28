import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createAppServer } from "../src/app.js";

const databaseUrl = process.env.ADD_WHATSAPP_TEST_DATABASE_URL || "";

async function withServer(runtime, testFn) {
  const server = createAppServer({ runtime });
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

      const consoleSnapshot = await request(baseUrl, "/v1/admin/console");
      assert.equal(consoleSnapshot.payload.source, "postgres");
      assert.ok(consoleSnapshot.payload.summary.users >= 1);
      assert.ok(consoleSnapshot.payload.summary.creditEntries >= 1);
    });
  });
});
