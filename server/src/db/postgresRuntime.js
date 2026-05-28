import crypto from "node:crypto";
import { Pool } from "pg";

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isoNow() {
  return new Date().toISOString();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [, salt, expected] = String(passwordHash).split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), actual);
}

function normalizeUsername(username) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) throw new Error("USERNAME_INVALID");
  return normalized;
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    status: row.status,
    createdAt: row.created_at
  };
}

function referralCodeFor(username) {
  const clean = username.replace(/[^a-z0-9]/g, "").slice(0, 6).toUpperCase();
  return `ADWA${clean || "USER"}`;
}

function businessParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const businessDate = formatter.format(new Date());
  return { businessDate, businessMonth: businessDate.slice(0, 7) };
}

function toPlan(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    cardTier: row.card_tier,
    unitPriceCents: Number(row.unit_price_cents),
    dailyLimit: Number(row.daily_limit),
    workspaceLimit: Number(row.workspace_limit),
    minimumTopUpCredits: Number(row.minimum_top_up_credits),
    templateLimit: Number(row.template_limit),
    status: row.status
  };
}

function toAuditPreview(row) {
  return {
    at: String(row.created_at).replace("T", " ").slice(0, 16),
    actor: row.admin_user_id,
    action: row.action,
    target: `${row.target_type}:${row.target_id}`,
    before: row.before_json,
    after: row.after_json
  };
}

function tableRows(items, mapper) {
  return items.length > 0 ? items.map(mapper) : [["暂无记录", "empty", "等待 API 写入", "PostgreSQL"]];
}

async function requireActiveUser(client, userId) {
  const result = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
  const user = result.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.status !== "active") throw new Error("USER_NOT_ACTIVE");
  return user;
}

async function getSubscription(client, userId) {
  const result = await client.query(
    "SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1",
    [userId]
  );
  return result.rows[0] || null;
}

async function getPlan(client, planId) {
  const result = await client.query("SELECT * FROM plans WHERE id = $1", [planId || "free"]);
  if (result.rows[0]) return toPlan(result.rows[0]);
  const fallback = await client.query("SELECT * FROM plans WHERE id = 'free'");
  return toPlan(fallback.rows[0]);
}

async function balanceFor(client, userId) {
  const result = await client.query("SELECT COALESCE(SUM(amount), 0)::int AS balance FROM credit_ledger WHERE user_id = $1", [userId]);
  return Number(result.rows[0]?.balance || 0);
}

async function getOrCreateUsage(client, userId, plan) {
  const { businessDate, businessMonth } = businessParts();
  const now = isoNow();
  await client.query(
    `INSERT INTO usage_daily (id, user_id, business_date, plan_id_snapshot, daily_limit, used_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $6)
     ON CONFLICT (user_id, business_date) DO NOTHING`,
    [createId("usage_day"), userId, businessDate, plan.id, plan.dailyLimit, now]
  );
  await client.query(
    `INSERT INTO usage_monthly (id, user_id, business_month, plan_id_snapshot, used_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, $5, $5)
     ON CONFLICT (user_id, business_month) DO NOTHING`,
    [createId("usage_month"), userId, businessMonth, plan.id, now]
  );
  const daily = await client.query("SELECT * FROM usage_daily WHERE user_id = $1 AND business_date = $2", [userId, businessDate]);
  const monthly = await client.query("SELECT * FROM usage_monthly WHERE user_id = $1 AND business_month = $2", [userId, businessMonth]);
  return { daily: daily.rows[0], monthly: monthly.rows[0] };
}

async function appendLedger(client, { userId, type, amount, idempotencyKey, relatedOrderId = null, relatedTaskId = null, relatedContactHash = null, note = "" }) {
  const existing = await client.query("SELECT * FROM credit_ledger WHERE idempotency_key = $1", [idempotencyKey]);
  if (existing.rows[0]) return { entry: existing.rows[0], idempotentReplay: true };

  const balanceAfter = (await balanceFor(client, userId)) + Number(amount);
  if (balanceAfter < 0) throw new Error("INSUFFICIENT_CREDITS");

  const entry = {
    id: createId("ledger"),
    userId,
    type,
    amount: Number(amount),
    balanceAfter,
    idempotencyKey,
    relatedOrderId,
    relatedTaskId,
    relatedContactHash,
    note,
    createdAt: isoNow()
  };
  await client.query(
    `INSERT INTO credit_ledger
      (id, user_id, type, amount, balance_after, idempotency_key, related_order_id, related_task_id, related_contact_hash, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      entry.id,
      entry.userId,
      entry.type,
      entry.amount,
      entry.balanceAfter,
      entry.idempotencyKey,
      entry.relatedOrderId,
      entry.relatedTaskId,
      entry.relatedContactHash,
      entry.note,
      entry.createdAt
    ]
  );
  return { entry, idempotentReplay: false };
}

async function appendAuditLog(client, { adminUserId, action, targetType, targetId, before, after, ip }) {
  const entry = {
    id: createId("audit"),
    adminUserId,
    action,
    targetType,
    targetId,
    beforeJson: JSON.stringify(before ?? null),
    afterJson: JSON.stringify(after ?? null),
    ip: ip || "127.0.0.1",
    createdAt: isoNow()
  };
  await client.query(
    `INSERT INTO admin_audit_logs
      (id, admin_user_id, target_type, target_id, action, before_json, after_json, ip, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [entry.id, entry.adminUserId, entry.targetType, entry.targetId, entry.action, entry.beforeJson, entry.afterJson, entry.ip, entry.createdAt]
  );
  return entry;
}

export function createPostgresRuntime({ databaseUrl, pool } = {}) {
  const db = pool || new Pool({ connectionString: databaseUrl || process.env.DATABASE_URL });
  const accessTokens = new Map();
  const adminAccessTokens = new Map();

  return {
    mode: "postgres",
    close: () => pool ? Promise.resolve() : db.end(),

    async authenticateAccessToken(accessToken) {
      const userId = accessTokens.get(accessToken);
      if (!userId) throw new Error("UNAUTHORIZED");
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        return userId;
      } finally {
        client.release();
      }
    },

    async authenticateAdminToken(accessToken) {
      const adminUserId = adminAccessTokens.get(accessToken);
      if (adminUserId) return adminUserId;
      if (accessTokens.has(accessToken)) throw new Error("ADMIN_FORBIDDEN");
      throw new Error("ADMIN_UNAUTHORIZED");
    },

    async registerUser({ username, password, planId = "free", referredByUserId = null }) {
      const normalized = normalizeUsername(username);
      if (String(password || "").length < 8) throw new Error("PASSWORD_TOO_WEAK");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query("SELECT id FROM users WHERE username = $1", [normalized]);
        if (existing.rows[0]) throw new Error("USERNAME_EXISTS");

        const now = isoNow();
        const user = {
          id: createId("user"),
          username: normalized,
          passwordHash: hashPassword(password),
          status: "active",
          referredByUserId,
          createdAt: now,
          updatedAt: now
        };
        await client.query(
          `INSERT INTO users (id, username, password_hash, status, referred_by_user_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.id, user.username, user.passwordHash, user.status, user.referredByUserId, user.createdAt, user.updatedAt]
        );

        const plan = await getPlan(client, planId);
        await client.query(
          `INSERT INTO subscriptions (id, user_id, plan_id, status, started_at, ends_at, changed_at)
           VALUES ($1, $2, $3, 'active', $4, NULL, $4)`,
          [createId("sub"), user.id, plan.id, now]
        );
        await client.query(
          `INSERT INTO referral_codes (id, user_id, code, status, created_at)
           VALUES ($1, $2, $3, 'active', $4)
           ON CONFLICT (code) DO NOTHING`,
          [createId("refcode"), user.id, referralCodeFor(normalized), now]
        );
        await client.query("COMMIT");
        return publicUser({ id: user.id, username: user.username, status: user.status, created_at: user.createdAt });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async loginUser({ username, password, deviceId = "unknown-device" }) {
      const normalized = normalizeUsername(username);
      const client = await db.connect();
      try {
        const result = await client.query("SELECT * FROM users WHERE username = $1", [normalized]);
        const user = result.rows[0];
        if (!user || user.status !== "active" || !verifyPassword(password, user.password_hash)) throw new Error("AUTH_FAILED");

        const accessToken = createId("token");
        const refreshToken = createId("refresh");
        accessTokens.set(accessToken, user.id);
        await client.query(
          `INSERT INTO sessions (id, user_id, refresh_token_hash, device_id, expires_at, revoked_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
          [
            createId("session"),
            user.id,
            crypto.createHash("sha256").update(refreshToken).digest("hex"),
            deviceId,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isoNow()
          ]
        );
        return { user: publicUser(user), accessToken, refreshToken };
      } finally {
        client.release();
      }
    },

    async loginAdmin({ username, password }) {
      const normalized = normalizeUsername(username);
      const client = await db.connect();
      try {
        const result = await client.query("SELECT * FROM admin_users WHERE username = $1", [normalized]);
        const admin = result.rows[0];
        if (!admin || admin.status !== "active" || !verifyPassword(password, admin.password_hash)) throw new Error("AUTH_FAILED");

        const adminAccessToken = createId("admin_token");
        const refreshToken = createId("admin_refresh");
        adminAccessTokens.set(adminAccessToken, admin.id);
        await client.query(
          `INSERT INTO admin_sessions (id, admin_user_id, refresh_token_hash, expires_at, revoked_at, created_at)
           VALUES ($1, $2, $3, $4, NULL, $5)`,
          [
            createId("admin_session"),
            admin.id,
            crypto.createHash("sha256").update(refreshToken).digest("hex"),
            new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            isoNow()
          ]
        );
        return {
          admin: { id: admin.id, username: admin.username, role: admin.role },
          adminAccessToken
        };
      } finally {
        client.release();
      }
    },

    async getEntitlements(userId) {
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        const subscription = await getSubscription(client, userId);
        const plan = await getPlan(client, subscription?.plan_id || "free");
        const { daily, monthly } = await getOrCreateUsage(client, userId, plan);
        const balanceCredits = await balanceFor(client, userId);
        const remainingByLimit = Math.max(0, Number(daily.daily_limit) - Number(daily.used_count));
        const referral = await client.query("SELECT code FROM referral_codes WHERE user_id = $1 LIMIT 1", [userId]);

        return {
          userId,
          planId: plan.id,
          planName: plan.displayName,
          cardTier: plan.cardTier,
          unitPriceCents: plan.unitPriceCents,
          balanceCredits,
          dailyLimit: Number(daily.daily_limit),
          usedToday: Number(daily.used_count),
          usedThisMonth: Number(monthly.used_count),
          availableToday: Math.min(balanceCredits, remainingByLimit),
          workspaceLimit: plan.workspaceLimit,
          templateLimit: plan.templateLimit,
          referralCode: referral.rows[0]?.code || null,
          businessDate: daily.business_date,
          resetAt: `${daily.business_date}T24:00:00+08:00`
        };
      } finally {
        client.release();
      }
    },

    async adjustCredits({ adminUserId, userId, amount, reason, ip }) {
      const numericAmount = Number(amount);
      if (!Number.isInteger(numericAmount) || numericAmount === 0) throw new Error("ADJUSTMENT_AMOUNT_INVALID");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await requireActiveUser(client, userId);
        const before = { balanceCredits: await balanceFor(client, userId) };
        const { entry } = await appendLedger(client, {
          userId,
          type: "admin_adjustment",
          amount: numericAmount,
          idempotencyKey: `admin_adjustment:${adminUserId}:${userId}:${reason}:${numericAmount}:${Date.now()}`,
          note: reason || "admin adjustment"
        });
        const after = { balanceCredits: entry.balanceAfter };
        await appendAuditLog(client, {
          adminUserId,
          action: "credit.adjustment",
          targetType: "user",
          targetId: userId,
          before,
          after,
          ip
        });
        await client.query("COMMIT");
        return after;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async consumeCredit({ userId, idempotencyKey, taskId, contactHash, workspaceId, sentAt }) {
      if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query("SELECT id FROM credit_ledger WHERE idempotency_key = $1", [idempotencyKey]);
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return { ...(await this.getEntitlements(userId)), idempotentReplay: true, ledgerId: existing.rows[0].id };
        }
        const entitlement = await this.getEntitlements(userId);
        if (entitlement.availableToday <= 0) throw new Error("NO_AVAILABLE_CREDITS");
        const { entry } = await appendLedger(client, {
          userId,
          type: "consume",
          amount: -1,
          idempotencyKey,
          relatedTaskId: taskId,
          relatedContactHash: contactHash,
          note: `workspace=${workspaceId};sent_at=${sentAt}`
        });
        const subscription = await getSubscription(client, userId);
        const plan = await getPlan(client, subscription?.plan_id || "free");
        const { daily, monthly } = await getOrCreateUsage(client, userId, plan);
        await client.query("UPDATE usage_daily SET used_count = used_count + 1, updated_at = $1 WHERE id = $2", [isoNow(), daily.id]);
        await client.query("UPDATE usage_monthly SET used_count = used_count + 1, updated_at = $1 WHERE id = $2", [isoNow(), monthly.id]);
        await client.query("COMMIT");
        return { ...(await this.getEntitlements(userId)), idempotentReplay: false, ledgerId: entry.id };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createOrder({ userId, planId, credits, amountCents }) {
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        const plan = await getPlan(client, planId);
        const order = {
          id: createId("order"),
          orderNo: `ADWA-${Date.now()}`,
          userId,
          planId: plan.id,
          credits: Number(credits),
          amountCents: Number(amountCents),
          status: "created",
          paymentProvider: "manual",
          createdAt: isoNow()
        };
        if (!Number.isInteger(order.credits) || order.credits <= 0) throw new Error("ORDER_CREDITS_INVALID");
        if (!Number.isInteger(order.amountCents) || order.amountCents < 0) throw new Error("ORDER_AMOUNT_INVALID");
        await client.query(
          `INSERT INTO orders (id, order_no, user_id, plan_id, credits, amount_cents, status, payment_provider, provider_trade_no, created_at, paid_at, closed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, NULL, NULL)`,
          [order.id, order.orderNo, order.userId, order.planId, order.credits, order.amountCents, order.status, order.paymentProvider, order.createdAt]
        );
        return { ...order, providerTradeNo: null, paidAt: null, closedAt: null };
      } finally {
        client.release();
      }
    },

    async markOrderPaid({ orderId, adminUserId, providerTradeNo, ip }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const orderResult = await client.query("SELECT * FROM orders WHERE id = $1", [orderId]);
        const order = orderResult.rows[0];
        if (!order) throw new Error("ORDER_NOT_FOUND");
        const before = { status: order.status, balanceCredits: await balanceFor(client, order.user_id) };
        if (order.status !== "paid") {
          await client.query("UPDATE orders SET status = 'paid', provider_trade_no = $1, paid_at = $2 WHERE id = $3", [providerTradeNo || null, isoNow(), order.id]);
          await appendLedger(client, {
            userId: order.user_id,
            type: "purchase",
            amount: Number(order.credits),
            idempotencyKey: `purchase:${order.id}`,
            relatedOrderId: order.id,
            note: `manual payment ${providerTradeNo || ""}`.trim()
          });
        }
        const after = { status: "paid", balanceCredits: await balanceFor(client, order.user_id) };
        await appendAuditLog(client, { adminUserId, action: "order.mark_paid", targetType: "order", targetId: order.id, before, after, ip });
        await client.query("COMMIT");
        return { ...order, status: "paid", providerTradeNo: providerTradeNo || null, balanceCredits: after.balanceCredits };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async issueWorkspaceLease({ userId, deviceId, workspaceKind, processNonce }) {
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        const subscription = await getSubscription(client, userId);
        const plan = await getPlan(client, subscription?.plan_id || "free");
        const active = await client.query(
          "SELECT COUNT(*)::int AS count FROM workspace_leases WHERE user_id = $1 AND status = 'active' AND expires_at > $2",
          [userId, isoNow()]
        );
        const activeCount = Number(active.rows[0].count || 0);
        if (activeCount >= plan.workspaceLimit) throw new Error("WORKSPACE_LIMIT_REACHED");
        const lease = {
          id: createId("lease"),
          expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
          now: isoNow()
        };
        await client.query(
          `INSERT INTO workspace_leases (id, user_id, device_id, workspace_kind, process_nonce, status, expires_at, created_at, renewed_at, released_at)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $7, NULL)`,
          [lease.id, userId, deviceId, workspaceKind, processNonce, lease.expiresAt, lease.now]
        );
        return { leaseId: lease.id, expiresAt: lease.expiresAt, activeCount: activeCount + 1, workspaceLimit: plan.workspaceLimit };
      } finally {
        client.release();
      }
    },

    async listAuditLogs() {
      const result = await db.query("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100");
      return result.rows.map((row) => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        targetType: row.target_type,
        targetId: row.target_id,
        action: row.action,
        beforeJson: row.before_json,
        afterJson: row.after_json,
        ip: row.ip,
        createdAt: row.created_at
      }));
    },

    async getAdminConsoleSnapshot() {
      const client = await db.connect();
      try {
        const users = await client.query("SELECT * FROM users ORDER BY created_at DESC LIMIT 50");
        const plans = await client.query("SELECT * FROM plans ORDER BY unit_price_cents, id");
        const ledger = await client.query("SELECT * FROM credit_ledger ORDER BY created_at DESC LIMIT 50");
        const dailyUsage = await client.query("SELECT * FROM usage_daily ORDER BY business_date DESC LIMIT 50");
        const orders = await client.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50");
        const referralCodes = await client.query("SELECT * FROM referral_codes ORDER BY created_at DESC LIMIT 50");
        const leases = await client.query("SELECT * FROM workspace_leases ORDER BY created_at DESC LIMIT 50");
        const auditLogs = await client.query("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50");
        const planRows = plans.rows.map(toPlan);
        const auditTrail = auditLogs.rows.map(toAuditPreview);
        return {
          source: "postgres",
          generatedAt: isoNow(),
          summary: {
            users: users.rows.length,
            plans: plans.rows.length,
            creditEntries: ledger.rows.length,
            orders: orders.rows.length,
            activeLeases: leases.rows.filter((lease) => lease.status === "active").length,
            auditLogs: auditLogs.rows.length
          },
          modules: {
            users: {
              metric: String(users.rows.length),
              status: "PostgreSQL 已接",
              records: tableRows(users.rows, (user) => [user.username, user.status, user.id, user.created_at])
            },
            plans: {
              metric: String(planRows.length),
              status: "PostgreSQL 已接",
              records: planRows.map((plan) => [plan.cardTier, `${plan.dailyLimit} / 天`, `${plan.workspaceLimit} 工作台`, `${plan.unitPriceCents / 100} 元`])
            },
            credits: {
              metric: String(ledger.rows.reduce((sum, entry) => sum + Math.max(0, Number(entry.amount)), 0)),
              status: "PostgreSQL 已接",
              records: tableRows(ledger.rows, (entry) => [entry.type, String(entry.amount), entry.idempotency_key, `balance ${entry.balance_after}`])
            },
            usage: {
              metric: String(dailyUsage.rows.reduce((sum, entry) => sum + Number(entry.used_count), 0)),
              status: "PostgreSQL 已接",
              records: tableRows(dailyUsage.rows, (entry) => [entry.business_date, entry.plan_id_snapshot, String(entry.used_count), `${Math.max(0, entry.daily_limit - entry.used_count)} remaining`])
            },
            orders: {
              metric: String(orders.rows.filter((order) => order.status !== "paid").length),
              status: "PostgreSQL 已接",
              records: tableRows(orders.rows, (order) => [order.order_no, order.status, `${order.credits} credits`, order.provider_trade_no || "manual"])
            },
            referrals: {
              metric: String(referralCodes.rows.length),
              status: "PostgreSQL 已接",
              records: tableRows(referralCodes.rows, (code) => [code.code, code.status, code.user_id, "等待首充奖励规则"])
            },
            workspaces: {
              metric: String(leases.rows.filter((lease) => lease.status === "active").length),
              status: "PostgreSQL 已接",
              records: tableRows(leases.rows, (lease) => [lease.id, lease.workspace_kind, lease.status, `expires ${lease.expires_at?.slice?.(11, 19) || lease.expires_at}`])
            },
            audit: {
              metric: "100%",
              status: "PostgreSQL 已接",
              records: tableRows(auditTrail, (entry) => [entry.action, entry.target, entry.before, entry.after])
            }
          },
          actionQueue: [
            {
              label: "PostgreSQL 持久化",
              target: "server runtime",
              detail: "API 运行时正在读取项目数据库",
              severity: "info"
            }
          ],
          auditTrail
        };
      } finally {
        client.release();
      }
    }
  };
}
