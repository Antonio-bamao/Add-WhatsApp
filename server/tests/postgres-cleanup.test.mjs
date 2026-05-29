import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Pool } from "pg";

import { cleanupPostgresTestData } from "./helpers/postgresTestCleanup.mjs";

const databaseUrl = process.env.ADD_WHATSAPP_TEST_DATABASE_URL || "";

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function count(client, sql, values = []) {
  const result = await client.query(sql, values);
  return Number(result.rows[0]?.count || 0);
}

describe("PostgreSQL test cleanup", { skip: !databaseUrl }, () => {
  it("removes scoped test users and dependent billing rows without touching seeds", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const scope = `pg_test_cleanup_${Date.now()}_`;
    const userId = id("user");
    const orderId = id("order");
    const leaseId = id("lease");
    const sessionId = id("session");
    const subscriptionId = id("sub");
    const ledgerId = id("ledger");
    const eventId = id("payment_event");
    const referralCodeId = id("refcode");
    const usageDayId = id("usage_day");
    const usageMonthId = id("usage_month");
    const auditLogId = id("audit");
    const now = new Date().toISOString();

    try {
      await pool.query(
        `INSERT INTO users (id, username, password_hash, status, created_at, updated_at)
         VALUES ($1, $2, 'test-hash', 'active', $3, $3)`,
        [userId, `${scope}user`, now]
      );
      await pool.query(
        `INSERT INTO sessions (id, user_id, refresh_token_hash, device_id, expires_at, created_at)
         VALUES ($1, $2, 'refresh-hash', 'cleanup-device', $3, $3)`,
        [sessionId, userId, now]
      );
      await pool.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, status, started_at, changed_at)
         VALUES ($1, $2, 'advanced', 'active', $3, $3)`,
        [subscriptionId, userId, now]
      );
      await pool.query(
        `INSERT INTO orders (id, order_no, user_id, plan_id, credits, amount_cents, status, payment_provider, created_at)
         VALUES ($1, $2, $3, 'advanced', 2000, 60000, 'paid', 'mock_alipay', $4)`,
        [orderId, `${scope}order`, userId, now]
      );
      await pool.query(
        `INSERT INTO credit_ledger (id, user_id, type, amount, balance_after, idempotency_key, related_order_id, created_at)
         VALUES ($1, $2, 'purchase', 2000, 2000, $3, $4, $5)`,
        [ledgerId, userId, `${scope}purchase`, orderId, now]
      );
      await pool.query(
        `INSERT INTO payment_events (id, provider, provider_event_id, order_id, event_type, payload_json, processed_at, created_at)
         VALUES ($1, 'mock_alipay', $2, $3, 'payment_succeeded', '{}', $4, $4)`,
        [eventId, `${scope}event`, orderId, now]
      );
      await pool.query(
        `INSERT INTO referral_codes (id, user_id, code, status, created_at)
         VALUES ($1, $2, $3, 'active', $4)`,
        [referralCodeId, userId, `${scope.toUpperCase()}CODE`, now]
      );
      await pool.query(
        `INSERT INTO usage_daily (id, user_id, business_date, plan_id_snapshot, daily_limit, used_count, created_at, updated_at)
         VALUES ($1, $2, '2026-05-29', 'advanced', 200, 1, $3, $3)`,
        [usageDayId, userId, now]
      );
      await pool.query(
        `INSERT INTO usage_monthly (id, user_id, business_month, plan_id_snapshot, used_count, created_at, updated_at)
         VALUES ($1, $2, '2026-05', 'advanced', 1, $3, $3)`,
        [usageMonthId, userId, now]
      );
      await pool.query(
        `INSERT INTO workspace_leases (id, user_id, device_id, workspace_kind, process_nonce, status, expires_at, created_at)
         VALUES ($1, $2, 'cleanup-device', 'secondary', 'cleanup-nonce', 'released', $3, $3)`,
        [leaseId, userId, now]
      );
      await pool.query(
        `INSERT INTO admin_audit_logs (id, admin_user_id, target_type, target_id, action, before_json, after_json, created_at)
         VALUES ($1, 'admin-preview', 'user', $2, 'test.cleanup', '{}', '{}', $3)`,
        [auditLogId, userId, now]
      );

      const result = await cleanupPostgresTestData({ databaseUrl, usernamePrefix: scope });

      assert.equal(result.users, 1);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM users WHERE username LIKE $1", [`${scope}%`]), 0);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM orders WHERE id = $1", [orderId]), 0);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM payment_events WHERE id = $1", [eventId]), 0);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM credit_ledger WHERE id = $1", [ledgerId]), 0);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM workspace_leases WHERE id = $1", [leaseId]), 0);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM admin_audit_logs WHERE id = $1", [auditLogId]), 0);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM plans"), 4);
      assert.equal(await count(pool, "SELECT COUNT(*) FROM admin_users WHERE username = 'admin-preview'"), 1);
    } finally {
      await pool.end();
    }
  });
});
