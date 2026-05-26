import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createAppServer } from "../src/app.js";

async function withServer(testFn) {
  const server = createAppServer();
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

      const adjusted = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: auth,
        body: { userId: registered.payload.user.id, amount: 300, reason: "manual transfer" }
      });
      assert.equal(adjusted.response.status, 200);
      assert.equal(adjusted.payload.balanceCredits, 300);

      const entitlements = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(entitlements.response.status, 200);
      assert.equal(entitlements.payload.availableToday, 200);

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
      assert.equal(consumed.payload.balanceCredits, 299);

      const lease = await request(baseUrl, "/v1/workspaces/leases", {
        method: "POST",
        headers: auth,
        body: { deviceId: "device-api", workspaceKind: "primary", processNonce: "nonce-api" }
      });
      assert.equal(lease.response.status, 201);
      assert.ok(lease.payload.leaseId);

      const audit = await request(baseUrl, "/v1/admin/audit-logs", { headers: auth });
      assert.equal(audit.response.status, 200);
      assert.ok(audit.payload.items.some((entry) => entry.action === "credit.adjustment"));
    });
  });
});
