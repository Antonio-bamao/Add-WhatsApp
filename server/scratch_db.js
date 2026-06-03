import { Pool } from 'pg';
import crypto from 'node:crypto';

async function main() {
  const connectionString = "postgres://addwhatsapp:addwhatsapp_dev_password@127.0.0.1:55433/addwhatsapp";
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query("SELECT id, username, password_hash, status FROM users");
    console.log("=== PostgreSQL USERS ===");
    console.log(result.rows);
  } catch (error) {
    console.error("PostgreSQL query failed:", error.message);
  } finally {
    await pool.end();
  }
}

main();
