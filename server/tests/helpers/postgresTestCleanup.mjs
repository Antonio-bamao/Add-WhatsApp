import { Pool } from "pg";

function assertSafePrefix(usernamePrefix) {
  if (!/^pg_test_[a-z0-9_]+_$/.test(String(usernamePrefix || ""))) {
    throw new Error("POSTGRES_TEST_CLEANUP_PREFIX_UNSAFE");
  }
}

async function deleteRows(client, sql, values = []) {
  const result = await client.query(sql, values);
  return Number(result.rowCount || 0);
}

export async function cleanupPostgresTestData({ databaseUrl, usernamePrefix }) {
  if (!databaseUrl) throw new Error("POSTGRES_TEST_DATABASE_URL_REQUIRED");
  assertSafePrefix(usernamePrefix);

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const users = await client.query("SELECT id FROM users WHERE username LIKE $1", [`${usernamePrefix}%`]);
    const userIds = users.rows.map((row) => row.id);
    if (userIds.length === 0) {
      await client.query("COMMIT");
      return { users: 0 };
    }

    const orders = await client.query("SELECT id FROM orders WHERE user_id = ANY($1::text[])", [userIds]);
    const orderIds = orders.rows.map((row) => row.id);
    const leases = await client.query("SELECT id FROM workspace_leases WHERE user_id = ANY($1::text[])", [userIds]);
    const leaseIds = leases.rows.map((row) => row.id);
    const targetIds = [...userIds, ...orderIds, ...leaseIds];

    const counts = {
      users: userIds.length,
      adminAuditLogs: targetIds.length
        ? await deleteRows(client, "DELETE FROM admin_audit_logs WHERE target_id = ANY($1::text[])", [targetIds])
        : 0,
      paymentEvents: orderIds.length
        ? await deleteRows(client, "DELETE FROM payment_events WHERE order_id = ANY($1::text[])", [orderIds])
        : 0,
      referralRecords: await deleteRows(
        client,
        "DELETE FROM referral_records WHERE referrer_user_id = ANY($1::text[]) OR referred_user_id = ANY($1::text[])",
        [userIds]
      ),
      referralCodes: await deleteRows(client, "DELETE FROM referral_codes WHERE user_id = ANY($1::text[])", [userIds]),
      workspaceLeases: await deleteRows(client, "DELETE FROM workspace_leases WHERE user_id = ANY($1::text[])", [userIds]),
      usageDaily: await deleteRows(client, "DELETE FROM usage_daily WHERE user_id = ANY($1::text[])", [userIds]),
      usageMonthly: await deleteRows(client, "DELETE FROM usage_monthly WHERE user_id = ANY($1::text[])", [userIds]),
      creditLedger: await deleteRows(client, "DELETE FROM credit_ledger WHERE user_id = ANY($1::text[])", [userIds]),
      orders: await deleteRows(client, "DELETE FROM orders WHERE user_id = ANY($1::text[])", [userIds]),
      sessions: await deleteRows(client, "DELETE FROM sessions WHERE user_id = ANY($1::text[])", [userIds]),
      devices: await deleteRows(client, "DELETE FROM devices WHERE user_id = ANY($1::text[])", [userIds]),
      subscriptions: await deleteRows(client, "DELETE FROM subscriptions WHERE user_id = ANY($1::text[])", [userIds]),
      userRows: await deleteRows(client, "DELETE FROM users WHERE id = ANY($1::text[])", [userIds])
    };

    await client.query("COMMIT");
    return counts;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
