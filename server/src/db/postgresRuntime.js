import crypto from "node:crypto";
import zlib from "node:zlib";
import { Pool } from "pg";
import {
  GMAPS_PLAN_CATALOG,
  GMAPS_SKU_CATALOG
} from "../services/billingService.js";
import {
  BILLING_POLICY_KEY,
  billingPolicyValueJson,
  buildBillingPolicyUpdate,
  createDefaultBillingPolicy,
  entitlementBillingOverlay,
  normalizeBillingPolicyRecord,
  resolveBillingPolicyForNow,
  signedAppPolicyResponse
} from "../services/billingPolicy.js";

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isoNow() {
  return new Date().toISOString();
}

const ORDER_PAYMENT_TTL_MS = 5 * 60 * 1000;
const ADMIN_ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const CONTACT_IMPORT_MAX_BYTES = 25 * 1024 * 1024;
const migratedOrderLifecyclePools = new WeakSet();
const migratedContactImportPools = new WeakSet();
const migratedBillingPolicyPools = new WeakSet();
const migratedProductBillingPools = new WeakSet();
const PLAN_RANKS = Object.freeze({
  free: 0,
  advanced: 1,
  professional: 2,
  business: 3
});

function planRank(planId) {
  return PLAN_RANKS[planId] ?? PLAN_RANKS.free;
}

function calculateOrderAmountCents(plan, credits) {
  const normalizedCredits = Number(credits);
  if (!Number.isInteger(normalizedCredits) || normalizedCredits <= 0) throw new Error("ORDER_CREDITS_INVALID");
  const unitPriceCents = Number(plan?.unitPriceCents || 0);
  const amountCents = Math.round(normalizedCredits * unitPriceCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("ORDER_AMOUNT_INVALID");
  return amountCents;
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
    uid: shortUserUid(row.id),
    username: row.username,
    status: row.status,
    createdAt: row.created_at
  };
}

function shortUserUid(userId) {
  const digest = crypto.createHash("sha256").update(String(userId || "")).digest("hex");
  const number = Number.parseInt(digest.slice(0, 12), 16) % 100000000;
  return String(number).padStart(8, "0");
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

function toOrder(row, balanceCredits = undefined) {
  const order = {
    id: row.id,
    orderNo: row.order_no,
    userId: row.user_id,
    planId: row.plan_id,
    credits: Number(row.credits),
    amountCents: Number(row.amount_cents),
    status: row.status,
    paymentProvider: row.payment_provider,
    providerTradeNo: row.provider_trade_no,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    closedAt: row.closed_at,
    productCode: row.product_code || "whatsapp",
    sku: row.sku || null
  };
  if (balanceCredits !== undefined) order.balanceCredits = balanceCredits;
  return order;
}

function toPaymentEvent(row) {
  return {
    id: row.id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    orderId: row.order_id,
    eventType: row.event_type,
    payloadJson: row.payload_json,
    processedAt: row.processed_at,
    createdAt: row.created_at
  };
}

function toPaymentEventItem(row) {
  return {
    id: row.id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    orderId: row.order_id,
    eventType: row.event_type,
    payloadJson: row.payload_json,
    processedAt: row.processed_at || null,
    createdAt: row.created_at
  };
}

function tableRows(items, mapper) {
  return items.length > 0 ? items.map(mapper) : [];
}

function paymentEventRows(rows) {
  return tableRows(rows, (event) => [
    event.provider,
    event.event_type,
    event.provider_event_id,
    event.order_id,
    event.processed_at || "pending"
  ]);
}

function safeFileName(value, fallback = "contact-import") {
  const clean = String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback;
}

function normalizeOriginalFormat(value, fileName) {
  const explicit = String(value || "").trim().toLowerCase().replace(/^\./, "");
  if (explicit) return explicit.slice(0, 16);
  const match = /\.([a-z0-9]+)$/i.exec(String(fileName || ""));
  return match ? match[1].toLowerCase() : "unknown";
}

function normalizeParsedRows(body = {}) {
  if (typeof body.parsedRowsGzipBase64 === "string" && body.parsedRowsGzipBase64.trim()) {
    const rawJson = zlib.gunzipSync(Buffer.from(body.parsedRowsGzipBase64, "base64")).toString("utf8");
    const rows = JSON.parse(rawJson);
    if (!Array.isArray(rows)) throw new Error("CONTACT_IMPORT_PARSED_ROWS_INVALID");
    return rows;
  }
  return Array.isArray(body.parsedRows) ? body.parsedRows : [];
}

function normalizeClientImportKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "";
  if (!/^[a-f0-9]{32,128}$/.test(key)) throw new Error("CONTACT_IMPORT_CLIENT_KEY_INVALID");
  return key.slice(0, 128);
}

function decodeOriginalFileBytes(body = {}) {
  if (body.originalGzipBase64) {
    return zlib.gunzipSync(Buffer.from(String(body.originalGzipBase64), "base64"));
  }
  return Buffer.from(String(body.originalBase64 || ""), "base64");
}

function normalizeContactImportBody(body = {}) {
  const originalFileName = safeFileName(body.originalFileName, "contact-import");
  const originalFormat = normalizeOriginalFormat(body.originalFormat, originalFileName);
  const originalMimeType = String(body.originalMimeType || "application/octet-stream").slice(0, 200);
  const originalBytes = decodeOriginalFileBytes(body);
  if (!originalBytes.length) throw new Error("CONTACT_IMPORT_FILE_REQUIRED");
  if (originalBytes.length > CONTACT_IMPORT_MAX_BYTES) throw new Error("CONTACT_IMPORT_FILE_TOO_LARGE");
  const originalSizeBytes = Number(body.originalSizeBytes || originalBytes.length);
  if (originalSizeBytes !== originalBytes.length) throw new Error("CONTACT_IMPORT_SIZE_MISMATCH");
  const originalSha256 = crypto.createHash("sha256").update(originalBytes).digest("hex");
  const expectedSha256 = String(body.originalSha256 || originalSha256).trim().toLowerCase();
  if (expectedSha256 && expectedSha256 !== originalSha256) throw new Error("CONTACT_IMPORT_SHA_MISMATCH");
  return {
    originalFileName,
    originalFormat,
    originalMimeType,
    clientImportKey: normalizeClientImportKey(body.clientImportKey),
    originalSizeBytes: originalBytes.length,
    originalSha256,
    originalBytes,
    columns: body.columns || {},
    stats: body.stats || {},
    importOptions: body.importOptions || {},
    parsedRows: normalizeParsedRows(body)
  };
}

function publicContactImport(row) {
  const parsedRows = safeJsonParse(row.parsed_rows_json, []);
  return {
    id: row.id,
    userId: row.user_id,
    clientImportKey: row.client_import_key || "",
    account: row.username || row.user_id,
    originalFileName: row.original_file_name,
    originalFormat: row.original_format,
    originalMimeType: row.original_mime_type,
    originalSizeBytes: Number(row.original_size_bytes),
    originalSha256: row.original_sha256,
    parsedRowCount: parsedRows.length,
    stats: safeJsonParse(row.stats_json, {}),
    columns: safeJsonParse(row.columns_json, {}),
    createdAt: row.created_at,
    originalDownloadUrl: `/v1/admin/contact-imports/${row.id}/download?kind=original`,
    parsedDownloadUrl: `/v1/admin/contact-imports/${row.id}/download?kind=parsed`
  };
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function shouldKeepExcelText(header, value) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  if (!text) return false;
  const normalizedHeader = String(header || "").toLowerCase();
  const digitCount = (text.match(/\d/g) || []).length;
  const phoneHeader = normalizedHeader === "e164" || /phone|mobile|tel|电话|号码|手机|手机号/.test(normalizedHeader);
  const numericLike = /^[+\d][\d\s().-]*$/.test(text);
  return (phoneHeader && digitCount >= 6) || (numericLike && digitCount >= 10);
}

function excelFriendlyCsvValue(header, value) {
  const text = value === undefined || value === null ? "" : String(value);
  return shouldKeepExcelText(header, text) ? `\t${text}` : text;
}

function parsedRowsCsv(rows = []) {
  const sourceKeys = [];
  for (const row of rows) {
    for (const key of Object.keys(row && row.source ? row.source : {})) {
      if (!sourceKeys.includes(key)) sourceKeys.push(key);
    }
  }
  const headers = ["rowNumber", "status", "e164", "countryIso", "language", ...sourceKeys.map((key) => `source_${key}`)];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => {
      if (header.startsWith("source_")) return csvEscape(excelFriendlyCsvValue(header, row.source?.[header.slice(7)]));
      return csvEscape(excelFriendlyCsvValue(header, row[header]));
    }).join(","));
  }
  return `\ufeff${lines.join("\r\n")}\r\n`;
}

function parsedDownloadFileName(originalFileName) {
  return `${safeFileName(originalFileName.replace(/\.[^.]+$/, ""), "contact-import")}-parsed.csv`;
}

async function requireActiveUser(client, userId) {
  const result = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
  const user = result.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.status !== "active") throw new Error("USER_NOT_ACTIVE");
  return user;
}

async function requireActiveUserForAdmin(client, { userId, account }) {
  if (userId) return requireActiveUser(client, userId);
  const normalized = String(account || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) throw new Error("USERNAME_INVALID");
  const result = await client.query("SELECT * FROM users WHERE username = $1", [normalized]);
  const user = result.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.status !== "active") throw new Error("USER_NOT_ACTIVE");
  return user;
}

async function requireUser(client, userId) {
  const result = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
  const user = result.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

async function requireUserForAdminIdentifier(client, identifier) {
  const clean = String(identifier || "").trim();
  if (!clean) throw new Error("USER_IDENTIFIER_REQUIRED");

  const byId = await client.query("SELECT * FROM users WHERE id = $1", [clean]);
  if (byId.rows[0]) return byId.rows[0];

  if (/^\d{8}$/.test(clean)) {
    const candidates = await client.query("SELECT * FROM users ORDER BY created_at DESC LIMIT 1000");
    const byUid = candidates.rows.find((user) => shortUserUid(user.id) === clean);
    if (byUid) return byUid;
  }

  const normalized = String(clean).toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) throw new Error("USERNAME_INVALID");
  const byUsername = await client.query("SELECT * FROM users WHERE username = $1", [normalized]);
  const user = byUsername.rows[0];
  if (!user) throw new Error("USER_NOT_FOUND");
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

function normalizeProduct(product = "gmaps") {
  const normalized = String(product || "gmaps").trim().toLowerCase();
  if (normalized !== "gmaps") throw new Error("PRODUCT_UNSUPPORTED");
  return normalized;
}

function gmapsPlan(planId) {
  return GMAPS_PLAN_CATALOG[planId] || GMAPS_PLAN_CATALOG.free;
}

function productPackages() {
  return Object.values(GMAPS_SKU_CATALOG).map((sku) => ({
    sku: sku.sku,
    planId: sku.planId,
    credits: sku.credits,
    amountCents: sku.amountCents
  }));
}

async function productBalanceFor(client, userId, product = "gmaps") {
  const result = await client.query(
    "SELECT COALESCE(SUM(amount), 0)::int AS balance FROM product_credit_ledger WHERE user_id = $1 AND product_code = $2",
    [userId, normalizeProduct(product)]
  );
  return Number(result.rows[0]?.balance || 0);
}

async function appendProductLedger(client, { userId, product = "gmaps", type, amount, idempotencyKey, relatedOrderId = null, relatedReservationId = null, note = "" }) {
  const productCode = normalizeProduct(product);
  const existing = await client.query("SELECT * FROM product_credit_ledger WHERE idempotency_key = $1", [idempotencyKey]);
  if (existing.rows[0]) return { entry: existing.rows[0], idempotentReplay: true };

  const balanceAfter = (await productBalanceFor(client, userId, productCode)) + Number(amount);
  if (balanceAfter < 0) throw new Error("INSUFFICIENT_CREDITS");
  const entry = {
    id: createId("product_ledger"),
    userId,
    productCode,
    type,
    amount: Number(amount),
    balanceAfter,
    idempotencyKey,
    relatedOrderId,
    relatedReservationId,
    note,
    createdAt: isoNow()
  };
  await client.query(
    `INSERT INTO product_credit_ledger
      (id, user_id, product_code, type, amount, balance_after, idempotency_key, related_order_id, related_reservation_id, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      entry.id,
      entry.userId,
      entry.productCode,
      entry.type,
      entry.amount,
      entry.balanceAfter,
      entry.idempotencyKey,
      entry.relatedOrderId,
      entry.relatedReservationId,
      entry.note,
      entry.createdAt
    ]
  );
  return { entry, idempotentReplay: false };
}

async function getProductSubscription(client, userId, product = "gmaps") {
  const result = await client.query(
    `SELECT * FROM product_subscriptions
     WHERE user_id = $1 AND product_code = $2 AND status = 'active'
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId, normalizeProduct(product)]
  );
  return result.rows[0] || null;
}

async function ensureProductAccount(client, userId, product = "gmaps") {
  const productCode = normalizeProduct(product);
  const now = isoNow();
  const existing = await getProductSubscription(client, userId, productCode);
  if (!existing) {
    await client.query(
      `INSERT INTO product_subscriptions (id, user_id, product_code, plan_id, status, started_at, ends_at, changed_at)
       VALUES ($1, $2, $3, 'free', 'active', $4, NULL, $4)`,
      [createId("product_sub"), userId, productCode, now]
    );
  }
  await appendProductLedger(client, {
    userId,
    product: productCode,
    type: "free_grant",
    amount: 20,
    idempotencyKey: `free_grant:${productCode}:${userId}`,
    note: "BizFinder free credits"
  });
}

async function getOrCreateProductDailyUsage(client, userId, product = "gmaps", plan = GMAPS_PLAN_CATALOG.free) {
  const productCode = normalizeProduct(product);
  const { businessDate } = businessParts();
  const now = isoNow();
  await client.query(
    `INSERT INTO product_usage_daily
      (id, user_id, product_code, business_date, plan_id_snapshot, daily_limit, used_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $7)
     ON CONFLICT (user_id, product_code, business_date) DO NOTHING`,
    [createId("product_usage_day"), userId, productCode, businessDate, plan.id, plan.dailyLimit, now]
  );
  const result = await client.query(
    "SELECT * FROM product_usage_daily WHERE user_id = $1 AND product_code = $2 AND business_date = $3",
    [userId, productCode, businessDate]
  );
  return result.rows[0];
}

async function reservedProductUnits(client, userId, product = "gmaps") {
  const result = await client.query(
    `SELECT COALESCE(SUM(reserved_count - confirmed_count - released_count), 0)::int AS reserved
     FROM quota_reservations
     WHERE user_id = $1 AND product_code = $2 AND status = 'active'`,
    [userId, normalizeProduct(product)]
  );
  return Math.max(0, Number(result.rows[0]?.reserved || 0));
}

async function getProductEntitlementsForClient(client, { userId, product = "gmaps" }) {
  const productCode = normalizeProduct(product);
  await ensureProductAccount(client, userId, productCode);
  const subscription = await getProductSubscription(client, userId, productCode);
  const plan = gmapsPlan(subscription?.plan_id || "free");
  const daily = await getOrCreateProductDailyUsage(client, userId, productCode, plan);
  const balanceCredits = await productBalanceFor(client, userId, productCode);
  const reservedCount = await reservedProductUnits(client, userId, productCode);
  const remainingByLimit = Math.max(0, Number(daily.daily_limit) - Number(daily.used_count) - reservedCount);
  return {
    product: productCode,
    userId,
    planId: plan.id,
    planName: plan.displayName,
    cardTier: plan.cardTier,
    balanceCredits,
    dailyLimit: plan.dailyLimit,
    taskLimit: plan.taskLimit,
    batchGroupLimit: plan.batchGroupLimit,
    proxyLimit: plan.proxyLimit,
    deviceLimit: plan.deviceLimit,
    deviceExpansionLimit: plan.deviceExpansionLimit,
    usedToday: Number(daily.used_count),
    reservedCount,
    availableToday: Math.min(balanceCredits, remainingByLimit),
    businessDate: daily.business_date,
    resetAt: `${daily.business_date}T24:00:00+08:00`,
    capabilities: plan.capabilities,
    plannedCapabilities: plan.plannedCapabilities,
    packages: productPackages()
  };
}

async function orderBalanceFor(client, order) {
  return (order.product_code || "whatsapp") === "gmaps"
    ? productBalanceFor(client, order.user_id, "gmaps")
    : balanceFor(client, order.user_id);
}

function publicTaskBillingSession(row) {
  return {
    sessionId: row.id,
    taskId: row.task_id,
    workspaceId: row.workspace_id,
    mode: row.mode,
    policyVersion: Number(row.policy_version),
    planIdSnapshot: row.plan_id_snapshot,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    closedAt: row.closed_at,
    status: row.status
  };
}

async function insertTaskUsageEvent(client, { userId, taskId, billingSessionId, mode, idempotencyKey, contactHash }) {
  const existing = await client.query("SELECT * FROM task_usage_events WHERE idempotency_key = $1", [idempotencyKey]);
  if (existing.rows[0]) return { event: existing.rows[0], idempotentReplay: true };
  const event = {
    id: createId("usage_event"),
    userId,
    taskId,
    billingSessionId,
    mode,
    idempotencyKey,
    contactHash: contactHash || null,
    createdAt: isoNow()
  };
  await client.query(
    `INSERT INTO task_usage_events
      (id, user_id, task_id, billing_session_id, mode, idempotency_key, contact_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [event.id, userId, taskId, billingSessionId, mode, idempotencyKey, event.contactHash, event.createdAt]
  );
  return { event, idempotentReplay: false };
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

async function ensureBillingPolicyTables(client, db) {
  if (!db || migratedBillingPolicyPools.has(db)) return;
  await client.query(
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS task_billing_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      task_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      policy_version INTEGER NOT NULL,
      plan_id_snapshot TEXT,
      client_version TEXT,
      device_id TEXT,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      closed_at TEXT,
      status TEXT NOT NULL,
      UNIQUE (user_id, task_id)
    )`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS task_usage_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      task_id TEXT NOT NULL,
      billing_session_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      contact_hash TEXT,
      created_at TEXT NOT NULL
    )`
  );
  migratedBillingPolicyPools.add(db);
}

async function getBillingPolicyForClient(client, { forUpdate = false, db = null } = {}) {
  await ensureBillingPolicyTables(client, db);
  const lock = forUpdate ? " FOR UPDATE" : "";
  const result = await client.query(`SELECT * FROM system_settings WHERE key = $1${lock}`, [BILLING_POLICY_KEY]);
  if (result.rows[0]) {
    return normalizeBillingPolicyRecord({
      valueJson: result.rows[0].value_json,
      version: result.rows[0].version,
      updatedAt: result.rows[0].updated_at,
      updatedBy: result.rows[0].updated_by,
      now: new Date()
    });
  }
  const policy = createDefaultBillingPolicy(new Date(), { mode: "paid" });
  await client.query(
    "INSERT INTO system_settings (key, value_json, version, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (key) DO NOTHING",
    [BILLING_POLICY_KEY, billingPolicyValueJson(policy), policy.version, policy.updatedAt, policy.updatedBy]
  );
  return resolveBillingPolicyForNow(policy);
}

async function ensureOrderLifecycleColumns(client, db) {
  if (migratedOrderLifecyclePools.has(db)) return;
  await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TEXT");
  await client.query("UPDATE orders SET expires_at = created_at WHERE expires_at IS NULL");
  migratedOrderLifecyclePools.add(db);
}

async function ensureProductBillingTables(client, db) {
  if (migratedProductBillingPools.has(db)) return;
  await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_code TEXT NOT NULL DEFAULT 'whatsapp'");
  await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS sku TEXT");
  await client.query(
    `CREATE TABLE IF NOT EXISTS product_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      product_code TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ends_at TEXT,
      changed_at TEXT NOT NULL
    )`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS product_subscriptions_user_product_idx
     ON product_subscriptions (user_id, product_code, status, started_at DESC)`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS product_credit_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      product_code TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      related_order_id TEXT,
      related_reservation_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    )`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS product_credit_ledger_user_product_idx
     ON product_credit_ledger (user_id, product_code, created_at DESC)`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS product_usage_daily (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      product_code TEXT NOT NULL,
      business_date TEXT NOT NULL,
      plan_id_snapshot TEXT NOT NULL,
      daily_limit INTEGER NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, product_code, business_date)
    )`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS quota_reservations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      product_code TEXT NOT NULL,
      plan_id_snapshot TEXT NOT NULL,
      requested_count INTEGER NOT NULL,
      reserved_count INTEGER NOT NULL,
      confirmed_count INTEGER NOT NULL DEFAULT 0,
      released_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS quota_reservations_user_product_idx
     ON quota_reservations (user_id, product_code, status, created_at DESC)`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS quota_reservation_items (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL REFERENCES quota_reservations(id),
      place_index INTEGER NOT NULL,
      decision TEXT NOT NULL,
      charged INTEGER NOT NULL,
      ledger_entry_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (reservation_id, place_index)
    )`
  );
  migratedProductBillingPools.add(db);
}

async function ensureContactImportColumns(client, db) {
  if (migratedContactImportPools.has(db)) return;
  await client.query("ALTER TABLE contact_imports ADD COLUMN IF NOT EXISTS client_import_key TEXT");
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS contact_imports_user_client_import_key_idx
     ON contact_imports (user_id, client_import_key)
     WHERE client_import_key IS NOT NULL`
  );
  migratedContactImportPools.add(db);
}

async function orderByIdOrNumber(client, { orderId, orderNo, forUpdate = false }) {
  const lock = forUpdate ? " FOR UPDATE" : "";
  if (orderId) {
    const result = await client.query(`SELECT * FROM orders WHERE id = $1 OR order_no = $1${lock}`, [orderId]);
    return result.rows[0] || null;
  }
  if (orderNo) {
    const result = await client.query(`SELECT * FROM orders WHERE order_no = $1${lock}`, [orderNo]);
    return result.rows[0] || null;
  }
  return null;
}

async function creditPaidOrder(client, order, { providerTradeNo, notePrefix = "payment" } = {}) {
  const now = isoNow();
  await client.query(
    "UPDATE orders SET status = 'paid', provider_trade_no = COALESCE($1, provider_trade_no), paid_at = COALESCE(paid_at, $2) WHERE id = $3",
    [providerTradeNo || null, now, order.id]
  );
  if ((order.product_code || "whatsapp") === "gmaps") {
    try {
      await appendProductLedger(client, {
        userId: order.user_id,
        product: "gmaps",
        type: "purchase",
        amount: Number(order.credits),
        idempotencyKey: `purchase:gmaps:${order.id}`,
        relatedOrderId: order.id,
        note: `${notePrefix} ${providerTradeNo || order.provider_trade_no || ""}`.trim()
      });
    } catch (error) {
      await client.query("UPDATE orders SET status = 'paid_pending_credit' WHERE id = $1", [order.id]);
      throw error;
    }
    const currentSubscription = await getProductSubscription(client, order.user_id, "gmaps");
    const currentPlanId = currentSubscription?.plan_id || "free";
    if (planRank(order.plan_id) > planRank(currentPlanId)) {
      await client.query(
        "UPDATE product_subscriptions SET status = 'inactive', ends_at = $1, changed_at = $1 WHERE user_id = $2 AND product_code = 'gmaps' AND status = 'active'",
        [now, order.user_id]
      );
      await client.query(
        `INSERT INTO product_subscriptions (id, user_id, product_code, plan_id, status, started_at, ends_at, changed_at)
         VALUES ($1, $2, 'gmaps', $3, 'active', $4, NULL, $4)`,
        [createId("product_sub"), order.user_id, order.plan_id, now]
      );
    }
    const updated = await client.query("SELECT * FROM orders WHERE id = $1", [order.id]);
    return updated.rows[0];
  }
  try {
    await appendLedger(client, {
      userId: order.user_id,
      type: "purchase",
      amount: Number(order.credits),
      idempotencyKey: `purchase:${order.id}`,
      relatedOrderId: order.id,
      note: `${notePrefix} ${providerTradeNo || order.provider_trade_no || ""}`.trim()
    });
  } catch (error) {
    await client.query("UPDATE orders SET status = 'paid_pending_credit' WHERE id = $1", [order.id]);
    throw error;
  }
  const currentSubscription = await getSubscription(client, order.user_id);
  const currentPlanId = currentSubscription?.plan_id || "free";
  if (planRank(order.plan_id) > planRank(currentPlanId)) {
    await client.query(
      "UPDATE subscriptions SET status = 'inactive', ends_at = $1, changed_at = $1 WHERE user_id = $2 AND status = 'active'",
      [now, order.user_id]
    );
    await client.query(
      `INSERT INTO subscriptions (id, user_id, plan_id, status, started_at, ends_at, changed_at)
       VALUES ($1, $2, $3, 'active', $4, NULL, $4)`,
      [createId("sub"), order.user_id, order.plan_id, now]
    );
  }
  const updated = await client.query("SELECT * FROM orders WHERE id = $1", [order.id]);
  return updated.rows[0];
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
      const session = adminAccessTokens.get(accessToken);
      if (session) {
        if (new Date(session.expiresAt) > new Date()) return session.adminUserId;
        adminAccessTokens.delete(accessToken);
      }
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

    async refreshUserSession({ refreshToken, deviceId = "unknown-device" }) {
      const refreshTokenHash = crypto.createHash("sha256").update(String(refreshToken || "")).digest("hex");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const sessionResult = await client.query(
          `SELECT sessions.*, users.username, users.status, users.created_at
           FROM sessions
           JOIN users ON users.id = sessions.user_id
           WHERE sessions.refresh_token_hash = $1
           FOR UPDATE`,
          [refreshTokenHash]
        );
        const session = sessionResult.rows[0];
        if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) throw new Error("UNAUTHORIZED");
        if (session.status !== "active") throw new Error("USER_NOT_ACTIVE");

        const accessToken = createId("token");
        const nextRefreshToken = createId("refresh");
        const now = isoNow();
        accessTokens.set(accessToken, session.user_id);
        await client.query("UPDATE sessions SET revoked_at = $1 WHERE id = $2", [now, session.id]);
        await client.query(
          `INSERT INTO sessions (id, user_id, refresh_token_hash, device_id, expires_at, revoked_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
          [
            createId("session"),
            session.user_id,
            crypto.createHash("sha256").update(nextRefreshToken).digest("hex"),
            deviceId || session.device_id || "unknown-device",
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            now
          ]
        );
        await client.query("COMMIT");
        return {
          user: publicUser({
            id: session.user_id,
            username: session.username,
            status: session.status,
            created_at: session.created_at
          }),
          accessToken,
          refreshToken: nextRefreshToken
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
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
        const expiresAt = new Date(Date.now() + ADMIN_ACCESS_TOKEN_TTL_MS).toISOString();
        adminAccessTokens.set(adminAccessToken, { adminUserId: admin.id, expiresAt });
        await client.query(
          `INSERT INTO admin_sessions (id, admin_user_id, refresh_token_hash, expires_at, revoked_at, created_at)
           VALUES ($1, $2, $3, $4, NULL, $5)`,
          [
            createId("admin_session"),
            admin.id,
            crypto.createHash("sha256").update(refreshToken).digest("hex"),
            expiresAt,
            isoNow()
          ]
        );
        return {
          admin: { id: admin.id, username: admin.username, role: admin.role },
          adminAccessToken,
          expiresAt
        };
      } finally {
        client.release();
      }
    },

    async logoutAdmin(accessToken) {
      adminAccessTokens.delete(accessToken);
      return { loggedOut: true };
    },

    async getEntitlements(userId, product = undefined) {
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        if (product) {
          await ensureProductBillingTables(client, db);
          return await getProductEntitlementsForClient(client, { userId, product });
        }
        const subscription = await getSubscription(client, userId);
        const plan = await getPlan(client, subscription?.plan_id || "free");
        const billingPolicy = await getBillingPolicyForClient(client, { db });
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
          resetAt: `${daily.business_date}T24:00:00+08:00`,
          ...entitlementBillingOverlay(billingPolicy, plan)
        };
      } finally {
        client.release();
      }
    },

    async getBillingPolicy() {
      const client = await db.connect();
      try {
        return await getBillingPolicyForClient(client, { db });
      } finally {
        client.release();
      }
    },

    async getAppPolicy() {
      return signedAppPolicyResponse(await this.getBillingPolicy());
    },

    async updateBillingPolicy({ adminUserId, mode, effectiveAt = null, expectedVersion, reason, ip }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const before = await getBillingPolicyForClient(client, { forUpdate: true, db });
        const after = buildBillingPolicyUpdate(before, {
          mode,
          effectiveAt,
          expectedVersion,
          adminUserId
        });
        await client.query(
          "UPDATE system_settings SET value_json = $1, version = $2, updated_at = $3, updated_by = $4 WHERE key = $5",
          [billingPolicyValueJson(after), after.version, after.updatedAt, after.updatedBy, BILLING_POLICY_KEY]
        );
        await appendAuditLog(client, {
          adminUserId,
          action: "billing.policy_update",
          targetType: "system_setting",
          targetId: BILLING_POLICY_KEY,
          before,
          after: { ...after, reason: reason || "billing policy update" },
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

    async adjustCredits({ adminUserId, userId, account, amount, reason, ip }) {
      const numericAmount = Number(amount);
      if (!Number.isInteger(numericAmount) || numericAmount === 0) throw new Error("ADJUSTMENT_AMOUNT_INVALID");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const user = await requireUserForAdminIdentifier(client, userId || account);
        userId = user.id;
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
        return { userId, account: user.username, ...after };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createTaskBillingSession({ userId, taskId, workspaceId = "main", clientVersion, deviceId }) {
      if (!taskId) throw new Error("TASK_ID_REQUIRED");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureBillingPolicyTables(client, db);
        await requireActiveUser(client, userId);
        const existing = await client.query("SELECT * FROM task_billing_sessions WHERE user_id = $1 AND task_id = $2", [userId, taskId]);
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return publicTaskBillingSession(existing.rows[0]);
        }
        const subscription = await getSubscription(client, userId);
        const policy = await getBillingPolicyForClient(client, { db });
        const startedAt = isoNow();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const id = createId("billing_session");
        const inserted = await client.query(
          `INSERT INTO task_billing_sessions
            (id, user_id, task_id, workspace_id, mode, policy_version, plan_id_snapshot, client_version, device_id, started_at, expires_at, closed_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, 'active')
           RETURNING *`,
          [
            id,
            userId,
            taskId,
            workspaceId,
            policy.mode,
            policy.version,
            subscription?.plan_id || "free",
            clientVersion || "",
            deviceId || "",
            startedAt,
            expiresAt
          ]
        );
        await client.query("COMMIT");
        return publicTaskBillingSession(inserted.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async closeTaskBillingSession({ userId, sessionId }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureBillingPolicyTables(client, db);
        const existing = await client.query("SELECT * FROM task_billing_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE", [sessionId, userId]);
        const session = existing.rows[0];
        if (!session) throw new Error("TASK_BILLING_SESSION_MISMATCH");
        const closedAt = session.closed_at || isoNow();
        const updated = await client.query(
          "UPDATE task_billing_sessions SET status = 'closed', closed_at = $1 WHERE id = $2 RETURNING *",
          [closedAt, sessionId]
        );
        await client.query("COMMIT");
        return publicTaskBillingSession(updated.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async consumeCredit({ userId, idempotencyKey, taskId, billingSessionId, contactHash, workspaceId, sentAt }) {
      if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureBillingPolicyTables(client, db);
        if (billingSessionId) {
          const existingUsage = await client.query("SELECT id FROM task_usage_events WHERE idempotency_key = $1", [idempotencyKey]);
          if (existingUsage.rows[0]) {
            await client.query("COMMIT");
            return { ...(await this.getEntitlements(userId)), idempotentReplay: true, usageEventId: existingUsage.rows[0].id };
          }
        }
        const existing = await client.query("SELECT id FROM credit_ledger WHERE idempotency_key = $1", [idempotencyKey]);
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return { ...(await this.getEntitlements(userId)), idempotentReplay: true, ledgerId: existing.rows[0].id };
        }
        const subscription = await getSubscription(client, userId);
        const plan = await getPlan(client, subscription?.plan_id || "free");
        if (billingSessionId) {
          const sessionResult = await client.query("SELECT * FROM task_billing_sessions WHERE id = $1 FOR UPDATE", [billingSessionId]);
          const session = sessionResult.rows[0];
          if (!session || session.user_id !== userId || session.task_id !== taskId || session.workspace_id !== workspaceId) {
            throw new Error("TASK_BILLING_SESSION_MISMATCH");
          }
          if (session.status === "closed") throw new Error("TASK_BILLING_SESSION_CLOSED");
          if (new Date(session.expires_at) <= new Date()) {
            await client.query("UPDATE task_billing_sessions SET status = 'expired' WHERE id = $1", [billingSessionId]);
            throw new Error("TASK_BILLING_SESSION_EXPIRED");
          }
          const policy = await getBillingPolicyForClient(client, { db });
          if (session.mode === "free_access" || policy.mode === "free_access") {
            const { event } = await insertTaskUsageEvent(client, {
              userId,
              taskId,
              billingSessionId,
              mode: "free_access",
              idempotencyKey,
              contactHash
            });
            const { daily, monthly } = await getOrCreateUsage(client, userId, plan);
            await client.query("UPDATE usage_daily SET used_count = used_count + 1, updated_at = $1 WHERE id = $2", [isoNow(), daily.id]);
            await client.query("UPDATE usage_monthly SET used_count = used_count + 1, updated_at = $1 WHERE id = $2", [isoNow(), monthly.id]);
            await client.query("COMMIT");
            return { ...(await this.getEntitlements(userId)), idempotentReplay: false, usageEventId: event.id };
          }
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

    async reserveProductQuota({ userId, product = "gmaps", units }) {
      const normalizedUnits = Number(units);
      if (!Number.isInteger(normalizedUnits) || normalizedUnits <= 0) throw new Error("QUOTA_UNITS_INVALID");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const productCode = normalizeProduct(product);
        const entitlements = await getProductEntitlementsForClient(client, { userId, product: productCode });
        if (normalizedUnits > entitlements.taskLimit) throw new Error("TASK_LIMIT_REACHED");
        if (normalizedUnits > entitlements.availableToday) throw new Error("NO_AVAILABLE_CREDITS");
        const now = isoNow();
        const reservationId = createId("quota_reservation");
        await client.query(
          `INSERT INTO quota_reservations
            (id, user_id, product_code, plan_id_snapshot, requested_count, reserved_count, confirmed_count, released_count, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5, 0, 0, 'active', $6, $6)`,
          [reservationId, userId, productCode, entitlements.planId, normalizedUnits, now]
        );
        await client.query("COMMIT");
        return {
          reservation_id: reservationId,
          reserved_count: normalizedUnits,
          remaining_balance: entitlements.balanceCredits - normalizedUnits
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async confirmProductQuota(body) {
      if (body.decision !== "confirmed_phone") throw new Error("QUOTA_CONFIRM_DECISION_INVALID");
      return this.settleProductQuota({ ...body, charge: true });
    },

    async releaseProductQuota(body) {
      return this.settleProductQuota({ ...body, charge: false });
    },

    async settleProductQuota({ userId, product = "gmaps", reservationId, placeIndex, decision, charge }) {
      const normalizedPlaceIndex = Number(placeIndex);
      if (!Number.isInteger(normalizedPlaceIndex) || normalizedPlaceIndex < 0) throw new Error("QUOTA_PLACE_INDEX_INVALID");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const productCode = normalizeProduct(product);
        const reservationResult = await client.query(
          "SELECT * FROM quota_reservations WHERE id = $1 AND user_id = $2 AND product_code = $3 FOR UPDATE",
          [reservationId, userId, productCode]
        );
        const reservation = reservationResult.rows[0];
        if (!reservation) throw new Error("QUOTA_RESERVATION_NOT_FOUND");
        if (normalizedPlaceIndex >= Number(reservation.reserved_count)) throw new Error("QUOTA_PLACE_INDEX_INVALID");

        const existing = await client.query(
          "SELECT * FROM quota_reservation_items WHERE reservation_id = $1 AND place_index = $2",
          [reservationId, normalizedPlaceIndex]
        );
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return {
            idempotentReplay: true,
            balanceCredits: await productBalanceFor(client, userId, productCode),
            item: {
              id: existing.rows[0].id,
              reservationId,
              placeIndex: Number(existing.rows[0].place_index),
              decision: existing.rows[0].decision,
              outcome: existing.rows[0].charged ? "confirmed" : "released",
              ledgerId: existing.rows[0].ledger_entry_id,
              createdAt: existing.rows[0].created_at
            }
          };
        }

        let ledgerId = null;
        if (charge) {
          const { entry } = await appendProductLedger(client, {
            userId,
            product: productCode,
            type: "consume",
            amount: -1,
            idempotencyKey: `quota_confirm:${reservationId}:${normalizedPlaceIndex}`,
            relatedReservationId: reservationId,
            note: decision
          });
          ledgerId = entry.id;
          const plan = gmapsPlan(reservation.plan_id_snapshot);
          const usage = await getOrCreateProductDailyUsage(client, userId, productCode, plan);
          await client.query("UPDATE product_usage_daily SET used_count = used_count + 1, updated_at = $1 WHERE id = $2", [isoNow(), usage.id]);
        }

        const now = isoNow();
        const itemId = createId("quota_item");
        await client.query(
          `INSERT INTO quota_reservation_items
            (id, reservation_id, place_index, decision, charged, ledger_entry_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [itemId, reservationId, normalizedPlaceIndex, decision || "", charge ? 1 : 0, ledgerId, now]
        );
        await client.query(
          `UPDATE quota_reservations
           SET confirmed_count = confirmed_count + $1,
               released_count = released_count + $2,
               status = CASE WHEN confirmed_count + released_count + 1 >= reserved_count THEN 'closed' ELSE status END,
               updated_at = $3
           WHERE id = $4`,
          [charge ? 1 : 0, charge ? 0 : 1, now, reservationId]
        );
        await client.query("COMMIT");
        return {
          idempotentReplay: false,
          balanceCredits: await productBalanceFor(client, userId, productCode),
          item: {
            id: itemId,
            reservationId,
            placeIndex: normalizedPlaceIndex,
            decision,
            outcome: charge ? "confirmed" : "released",
            ledgerId,
            createdAt: now
          }
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createOrder({ userId, planId, credits, amountCents, product = "whatsapp", sku = null }) {
      const client = await db.connect();
      try {
        await ensureOrderLifecycleColumns(client, db);
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const productCode = String(product || "whatsapp").trim().toLowerCase();
        const packageSku = productCode === "gmaps" ? GMAPS_SKU_CATALOG[String(sku || "")] : null;
        if (productCode === "gmaps" && (!packageSku || packageSku.credits !== Number(credits) || packageSku.amountCents !== Number(amountCents))) {
          throw new Error("PRODUCT_SKU_MISMATCH");
        }
        if (productCode !== "whatsapp" && productCode !== "gmaps") throw new Error("PRODUCT_UNSUPPORTED");
        const plan = productCode === "gmaps" ? gmapsPlan(packageSku.planId) : await getPlan(client, planId);
        const normalizedCredits = Number(productCode === "gmaps" ? packageSku.credits : credits);
        const order = {
          id: createId("order"),
          orderNo: `${Date.now()}`,
          userId,
          planId: plan.id,
          credits: normalizedCredits,
          amountCents: productCode === "gmaps" ? packageSku.amountCents : calculateOrderAmountCents(plan, normalizedCredits),
          status: "created",
          paymentProvider: "manual",
          createdAt: isoNow(),
          productCode,
          sku: productCode === "gmaps" ? packageSku.sku : null
        };
        order.expiresAt = new Date(new Date(order.createdAt).getTime() + ORDER_PAYMENT_TTL_MS).toISOString();
        await client.query(
          `INSERT INTO orders (id, order_no, user_id, plan_id, credits, amount_cents, status, payment_provider, provider_trade_no, created_at, expires_at, paid_at, closed_at, product_code, sku)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10, NULL, NULL, $11, $12)`,
          [
            order.id,
            order.orderNo,
            order.userId,
            order.planId,
            order.credits,
            order.amountCents,
            order.status,
            order.paymentProvider,
            order.createdAt,
            order.expiresAt,
            order.productCode,
            order.sku
          ]
        );
        return { ...order, providerTradeNo: null, paidAt: null, closedAt: null };
      } finally {
        client.release();
      }
    },

    async getOrderForPayment({ userId, orderId }) {
      const client = await db.connect();
      try {
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const result = await client.query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [orderId, userId]);
        const order = result.rows[0];
        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.status === "paid") throw new Error("ORDER_ALREADY_PAID");
        if (order.expires_at && new Date(order.expires_at) <= new Date()) {
          await this.closeOrder({ userId, orderId, reason: "expired" });
          throw new Error("ORDER_CLOSED");
        }
        if (order.closed_at || ["closed", "canceled", "expired"].includes(order.status)) throw new Error("ORDER_CLOSED");
        return toOrder(order);
      } finally {
        client.release();
      }
    },

    async getOrderStatus({ userId, orderId }) {
      const client = await db.connect();
      try {
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const result = await client.query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [orderId, userId]);
        const order = result.rows[0];
        if (!order) throw new Error("ORDER_NOT_FOUND");
        return toOrder(order, await orderBalanceFor(client, order));
      } finally {
        client.release();
      }
    },

    async listOrders({ userId, limit = 20, offset = 0 } = {}) {
      const client = await db.connect();
      try {
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const normalizedOffset = Math.max(Number(offset) || 0, 0);
        const count = await client.query("SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1", [userId]);
        const result = await client.query(
          "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC, order_no DESC LIMIT $2 OFFSET $3",
          [userId, normalizedLimit, normalizedOffset]
        );
        return {
          items: result.rows.map((row) => toOrder(row)),
          total: count.rows[0].total,
          limit: normalizedLimit,
          offset: normalizedOffset
        };
      } finally {
        client.release();
      }
    },

    async markOrderPaymentProvider({ userId, orderId, provider }) {
      const client = await db.connect();
      try {
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const result = await client.query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [orderId, userId]);
        const order = result.rows[0];
        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.status === "paid") throw new Error("ORDER_ALREADY_PAID");
        if (order.closed_at || ["closed", "canceled", "expired"].includes(order.status)) throw new Error("ORDER_CLOSED");
        const normalizedProvider = String(provider || order.payment_provider || "manual").trim().toLowerCase();
        const updated = await client.query("UPDATE orders SET payment_provider = $1 WHERE id = $2 RETURNING *", [normalizedProvider, orderId]);
        return toOrder(updated.rows[0]);
      } finally {
        client.release();
      }
    },

    async closeOrder({ userId, orderId, reason = "canceled" }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureProductBillingTables(client, db);
        await requireActiveUser(client, userId);
        const order = await orderByIdOrNumber(client, { orderId, forUpdate: true });
        if (!order || order.user_id !== userId) throw new Error("ORDER_NOT_FOUND");
        if (order.status === "paid") throw new Error("ORDER_ALREADY_PAID");
        if (order.closed_at || ["closed", "canceled", "expired"].includes(order.status)) {
          await client.query("COMMIT");
          return toOrder(order, await orderBalanceFor(client, order));
        }
        const status = String(reason || "canceled").trim().toLowerCase() === "expired" ? "expired" : "canceled";
        const closedAt = isoNow();
        const updated = await client.query(
          "UPDATE orders SET status = $1, closed_at = $2 WHERE id = $3 RETURNING *",
          [status, closedAt, order.id]
        );
        await client.query("COMMIT");
        return toOrder(updated.rows[0], await orderBalanceFor(client, updated.rows[0]));
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async expireOrder({ userId, orderId }) {
      return this.closeOrder({ userId, orderId, reason: "expired" });
    },

    async markOrderPaid({ orderId, adminUserId, providerTradeNo, ip }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureProductBillingTables(client, db);
        const order = await orderByIdOrNumber(client, { orderId, forUpdate: true });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        const before = { status: order.status, balanceCredits: await orderBalanceFor(client, order) };
        if (order.status !== "paid") {
          await creditPaidOrder(client, order, { providerTradeNo, notePrefix: "manual payment" });
        }
        const updatedForBalance = await orderByIdOrNumber(client, { orderId: order.id });
        const after = { status: "paid", balanceCredits: await orderBalanceFor(client, updatedForBalance) };
        await appendAuditLog(client, { adminUserId, action: "order.mark_paid", targetType: "order", targetId: order.id, before, after, ip });
        await client.query("COMMIT");
        const updated = await orderByIdOrNumber(client, { orderId });
        return toOrder(updated, after.balanceCredits);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async getOrderForAdmin({ orderId }) {
      const client = await db.connect();
      try {
        await ensureProductBillingTables(client, db);
        const order = await orderByIdOrNumber(client, { orderId });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        return toOrder(order, await orderBalanceFor(client, order));
      } finally {
        client.release();
      }
    },

    async processPaymentEvent({ provider, providerEventId, orderId, orderNo, eventType, providerTradeNo, payload }) {
      const normalizedProvider = String(provider || "").trim().toLowerCase();
      const normalizedEventId = String(providerEventId || "").trim();
      if (!normalizedProvider) throw new Error("PAYMENT_PROVIDER_REQUIRED");
      if (!normalizedEventId) throw new Error("PAYMENT_EVENT_ID_REQUIRED");
      if (!eventType) throw new Error("PAYMENT_EVENT_TYPE_REQUIRED");

      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await ensureProductBillingTables(client, db);
        const existing = await client.query("SELECT * FROM payment_events WHERE provider_event_id = $1", [normalizedEventId]);
        if (existing.rows[0]) {
          const existingOrder = await orderByIdOrNumber(client, { orderId: existing.rows[0].order_id });
          const balanceCredits = existingOrder ? await orderBalanceFor(client, existingOrder) : undefined;
          await client.query("COMMIT");
          return {
            event: toPaymentEvent(existing.rows[0]),
            order: existingOrder ? toOrder(existingOrder, balanceCredits) : null,
            idempotentReplay: true
          };
        }

        const order = await orderByIdOrNumber(client, { orderId, orderNo, forUpdate: true });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        const event = {
          id: createId("payment_event"),
          provider: normalizedProvider,
          providerEventId: normalizedEventId,
          orderId: order.id,
          eventType,
          payloadJson: JSON.stringify(payload ?? {}),
          processedAt: null,
          createdAt: isoNow()
        };
        await client.query(
          `INSERT INTO payment_events (id, provider, provider_event_id, order_id, event_type, payload_json, processed_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)`,
          [event.id, event.provider, event.providerEventId, event.orderId, event.eventType, event.payloadJson, event.createdAt]
        );

        let updatedOrder = order;
        if (["payment_succeeded", "paid", "trade_success"].includes(String(eventType))) {
          updatedOrder = await creditPaidOrder(client, order, { providerTradeNo, notePrefix: `${normalizedProvider} payment` });
          event.processedAt = isoNow();
          await client.query("UPDATE payment_events SET processed_at = $1 WHERE id = $2", [event.processedAt, event.id]);
        }
        const balanceCredits = await orderBalanceFor(client, updatedOrder);
        await client.query("COMMIT");
        return {
          event,
          order: toOrder(updatedOrder, balanceCredits),
          idempotentReplay: false,
          creditStatus: updatedOrder.status === "paid_pending_credit" ? "pending" : "credited"
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async processPendingOrderCredits({ limit = 20 } = {}) {
      const client = await db.connect();
      const failures = [];
      let processedCount = 0;
      try {
        await ensureProductBillingTables(client, db);
        const pending = await client.query("SELECT * FROM orders WHERE status = 'paid_pending_credit' ORDER BY paid_at, created_at LIMIT $1", [Number(limit) || 20]);
        for (const order of pending.rows) {
          try {
            await client.query("BEGIN");
            const locked = await orderByIdOrNumber(client, { orderId: order.id, forUpdate: true });
            if (locked?.status === "paid_pending_credit") {
              await creditPaidOrder(client, locked, { providerTradeNo: locked.provider_trade_no, notePrefix: "payment compensation" });
              processedCount += 1;
            }
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            failures.push({ orderId: order.id, error: error.message });
          }
        }
        return { processedCount, failedCount: failures.length, failures };
      } finally {
        client.release();
      }
    },

    async listPaymentEvents({ provider, eventType, processed, q, limit = 50, offset = 0 } = {}) {
      const numericLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
      const numericOffset = Math.max(Number(offset) || 0, 0);
      const conditions = [];
      const values = [];
      function addCondition(sql, value) {
        values.push(value);
        conditions.push(sql.replace("?", `$${values.length}`));
      }

      if (provider) addCondition("provider = ?", String(provider).toLowerCase());
      if (eventType) addCondition("event_type = ?", String(eventType));
      if (processed === "processed") conditions.push("processed_at IS NOT NULL");
      if (processed === "pending") conditions.push("processed_at IS NULL");
      if (q) {
        values.push(`%${String(q).toLowerCase()}%`);
        const index = `$${values.length}`;
        conditions.push(`LOWER(provider || ' ' || provider_event_id || ' ' || order_id || ' ' || event_type) LIKE ${index}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const count = await db.query(`SELECT COUNT(*)::int AS total FROM payment_events ${where}`, values);
      const rows = await db.query(
        `SELECT * FROM payment_events ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, numericLimit, numericOffset]
      );
      return {
        total: Number(count.rows[0]?.total || 0),
        limit: numericLimit,
        offset: numericOffset,
        items: rows.rows.map(toPaymentEventItem)
      };
    },

    async createContactImport(body) {
      const userId = body.userId;
      const normalized = normalizeContactImportBody(body);
      const client = await db.connect();
      try {
        await ensureContactImportColumns(client, db);
        await requireActiveUser(client, userId);
        if (normalized.clientImportKey) {
          const existing = await client.query(
            "SELECT ci.*, u.username FROM contact_imports ci JOIN users u ON u.id = ci.user_id WHERE ci.user_id = $1 AND ci.client_import_key = $2 LIMIT 1",
            [userId, normalized.clientImportKey]
          );
          if (existing.rows[0]) return publicContactImport(existing.rows[0]);
        }
        const record = {
          id: createId("contact_import"),
          userId,
          createdAt: isoNow(),
          ...normalized
        };
        await client.query(
          `INSERT INTO contact_imports (
            id,
            user_id,
            original_file_name,
            original_format,
            original_mime_type,
            original_size_bytes,
            original_sha256,
            client_import_key,
            original_file_bytes,
            columns_json,
            stats_json,
            import_options_json,
            parsed_rows_json,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            record.id,
            record.userId,
            record.originalFileName,
            record.originalFormat,
            record.originalMimeType,
            record.originalSizeBytes,
            record.originalSha256,
            record.clientImportKey || null,
            record.originalBytes,
            JSON.stringify(record.columns),
            JSON.stringify(record.stats),
            JSON.stringify(record.importOptions),
            JSON.stringify(record.parsedRows),
            record.createdAt
          ]
        );
        return publicContactImport({
          id: record.id,
          user_id: record.userId,
          username: (await requireActiveUser(client, userId)).username,
          client_import_key: record.clientImportKey || "",
          original_file_name: record.originalFileName,
          original_format: record.originalFormat,
          original_mime_type: record.originalMimeType,
          original_size_bytes: record.originalSizeBytes,
          original_sha256: record.originalSha256,
          columns_json: JSON.stringify(record.columns),
          stats_json: JSON.stringify(record.stats),
          parsed_rows_json: JSON.stringify(record.parsedRows),
          created_at: record.createdAt
        });
      } finally {
        client.release();
      }
    },

    async listContactImports({ q, limit = 50, offset = 0 } = {}) {
      const numericLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
      const numericOffset = Math.max(Number(offset) || 0, 0);
      const values = [];
      const conditions = [];
      if (q) {
        values.push(`%${String(q).toLowerCase()}%`);
        const index = `$${values.length}`;
        conditions.push(`LOWER(u.username || ' ' || ci.user_id || ' ' || ci.original_file_name || ' ' || ci.original_format || ' ' || ci.original_sha256) LIKE ${index}`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const count = await db.query(
        `SELECT COUNT(*)::int AS total FROM contact_imports ci JOIN users u ON u.id = ci.user_id ${where}`,
        values
      );
      const rows = await db.query(
        `SELECT ci.*, u.username
         FROM contact_imports ci
         JOIN users u ON u.id = ci.user_id
         ${where}
         ORDER BY ci.created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, numericLimit, numericOffset]
      );
      return {
        total: Number(count.rows[0]?.total || 0),
        limit: numericLimit,
        offset: numericOffset,
        items: rows.rows.map(publicContactImport)
      };
    },

    async getContactImportDownload({ importId, kind = "original" }) {
      const result = await db.query("SELECT * FROM contact_imports WHERE id = $1", [importId]);
      const record = result.rows[0];
      if (!record) throw new Error("CONTACT_IMPORT_NOT_FOUND");
      if (kind === "parsed") {
        return {
          body: Buffer.from(parsedRowsCsv(safeJsonParse(record.parsed_rows_json, [])), "utf8"),
          contentType: "text/csv; charset=utf-8",
          fileName: parsedDownloadFileName(record.original_file_name)
        };
      }
      return {
        body: Buffer.isBuffer(record.original_file_bytes) ? record.original_file_bytes : Buffer.from(record.original_file_bytes),
        contentType: record.original_mime_type || "application/octet-stream",
        fileName: record.original_file_name
      };
    },

    async issueWorkspaceLease({ userId, deviceId, workspaceKind, processNonce }) {
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        const subscription = await getSubscription(client, userId);
        const plan = await getPlan(client, subscription?.plan_id || "free");
        const billingPolicy = await getBillingPolicyForClient(client, { db });
        const workspaceLimit = billingPolicy.mode === "free_access" ? 5 : plan.workspaceLimit;
        const active = await client.query(
          "SELECT COUNT(*)::int AS count FROM workspace_leases WHERE user_id = $1 AND status = 'active' AND expires_at > $2",
          [userId, isoNow()]
        );
        const activeCount = Number(active.rows[0].count || 0);
        if (activeCount >= workspaceLimit) throw new Error("WORKSPACE_LIMIT_REACHED");
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
        return { leaseId: lease.id, expiresAt: lease.expiresAt, activeCount: activeCount + 1, workspaceLimit };
      } finally {
        client.release();
      }
    },

    async renewWorkspaceLease({ userId, leaseId }) {
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        const existing = await client.query("SELECT * FROM workspace_leases WHERE id = $1 AND user_id = $2", [leaseId, userId]);
        const lease = existing.rows[0];
        if (!lease) throw new Error("WORKSPACE_LEASE_NOT_FOUND");
        if (lease.status !== "active") throw new Error("WORKSPACE_LEASE_NOT_ACTIVE");
        const now = isoNow();
        const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
        await client.query(
          "UPDATE workspace_leases SET expires_at = $1, renewed_at = $2 WHERE id = $3",
          [expiresAt, now, leaseId]
        );
        return { leaseId, status: "active", expiresAt, renewedAt: now };
      } finally {
        client.release();
      }
    },

    async releaseWorkspaceLease({ userId, leaseId }) {
      const client = await db.connect();
      try {
        await requireActiveUser(client, userId);
        const existing = await client.query("SELECT * FROM workspace_leases WHERE id = $1 AND user_id = $2", [leaseId, userId]);
        const lease = existing.rows[0];
        if (!lease) throw new Error("WORKSPACE_LEASE_NOT_FOUND");
        const releasedAt = lease.released_at || isoNow();
        if (lease.status !== "released") {
          await client.query(
            "UPDATE workspace_leases SET status = 'released', released_at = $1 WHERE id = $2",
            [releasedAt, leaseId]
          );
        }
        return { leaseId, status: "released", releasedAt };
      } finally {
        client.release();
      }
    },

    async adminReleaseWorkspaceLease({ leaseId, adminUserId, reason, ip }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query("SELECT * FROM workspace_leases WHERE id = $1", [leaseId]);
        const lease = existing.rows[0];
        if (!lease) throw new Error("WORKSPACE_LEASE_NOT_FOUND");
        const before = { status: lease.status, releasedAt: lease.released_at };
        const releasedAt = lease.released_at || isoNow();
        if (lease.status !== "released") {
          await client.query(
            "UPDATE workspace_leases SET status = 'released', released_at = $1 WHERE id = $2",
            [releasedAt, leaseId]
          );
        }
        await appendAuditLog(client, {
          adminUserId,
          action: "workspace.release",
          targetType: "workspace_lease",
          targetId: leaseId,
          before,
          after: { status: "released", releasedAt, reason: reason || "admin release" },
          ip
        });
        await client.query("COMMIT");
        return { leaseId, status: "released", releasedAt };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async setUserStatus({ userId, status, adminUserId, reason, ip }) {
      if (!["active", "frozen"].includes(status)) throw new Error("USER_STATUS_INVALID");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const user = await requireUserForAdminIdentifier(client, userId);
        userId = user.id;
        const before = { status: user.status };
        const updatedAt = isoNow();
        await client.query("UPDATE users SET status = $1, updated_at = $2 WHERE id = $3", [status, updatedAt, userId]);
        await appendAuditLog(client, {
          adminUserId,
          action: "user.status_update",
          targetType: "user",
          targetId: userId,
          before,
          after: { status, reason: reason || "admin status update" },
          ip
        });
        await client.query("COMMIT");
        return { userId, username: user.username, status, updatedAt };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateUserPlan({ userId, planId, adminUserId, reason, ip }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const user = await requireUserForAdminIdentifier(client, userId);
        const plan = await getPlan(client, planId);
        const currentSubscription = await getSubscription(client, user.id);
        const now = isoNow();
        await client.query(
          "UPDATE subscriptions SET status = 'inactive', ends_at = $1, changed_at = $1 WHERE user_id = $2 AND status = 'active'",
          [now, user.id]
        );
        await client.query(
          `INSERT INTO subscriptions (id, user_id, plan_id, status, started_at, ends_at, changed_at)
           VALUES ($1, $2, $3, 'active', $4, NULL, $4)`,
          [createId("sub"), user.id, plan.id, now]
        );
        await appendAuditLog(client, {
          adminUserId,
          action: "user.plan_update",
          targetType: "user",
          targetId: user.id,
          before: { planId: currentSubscription?.plan_id || "free" },
          after: { planId: plan.id, reason: reason || "admin plan update" },
          ip
        });
        await client.query("COMMIT");
        return { userId: user.id, username: user.username, planId: plan.id, updatedAt: now };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async revokeUserSessions({ userId, adminUserId, reason, ip }) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const user = await requireUserForAdminIdentifier(client, userId);
        const before = await client.query("SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1 AND revoked_at IS NULL", [user.id]);
        const revokedAt = isoNow();
        await client.query("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL", [revokedAt, user.id]);
        await appendAuditLog(client, {
          adminUserId,
          action: "user.sessions_revoke",
          targetType: "user",
          targetId: user.id,
          before: { activeSessions: Number(before.rows[0]?.count || 0) },
          after: { activeSessions: 0, reason: reason || "admin sessions revoke" },
          ip
        });
        await client.query("COMMIT");
        return { userId: user.id, username: user.username, revokedCount: Number(before.rows[0]?.count || 0), revokedAt };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
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
        const userIds = users.rows.map((user) => user.id);
        const subscriptions = userIds.length
          ? await client.query(
              "SELECT DISTINCT ON (user_id) user_id, plan_id FROM subscriptions WHERE user_id = ANY($1::text[]) AND status = 'active' ORDER BY user_id, started_at DESC",
              [userIds]
            )
          : { rows: [] };
        const balances = userIds.length
          ? await client.query("SELECT user_id, COALESCE(SUM(amount), 0)::int AS balance FROM credit_ledger WHERE user_id = ANY($1::text[]) GROUP BY user_id", [userIds])
          : { rows: [] };
        const sessions = userIds.length
          ? await client.query("SELECT user_id, COUNT(*)::int AS count FROM sessions WHERE user_id = ANY($1::text[]) AND revoked_at IS NULL GROUP BY user_id", [userIds])
          : { rows: [] };
        const subscriptionByUser = new Map(subscriptions.rows.map((row) => [row.user_id, row.plan_id]));
        const balanceByUser = new Map(balances.rows.map((row) => [row.user_id, Number(row.balance || 0)]));
        const sessionsByUser = new Map(sessions.rows.map((row) => [row.user_id, Number(row.count || 0)]));
        const plans = await client.query("SELECT * FROM plans ORDER BY unit_price_cents, id");
        const ledger = await client.query("SELECT * FROM credit_ledger ORDER BY created_at DESC LIMIT 50");
        const dailyUsage = await client.query("SELECT * FROM usage_daily ORDER BY business_date DESC LIMIT 50");
        const orders = await client.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50");
        const paymentEvents = await client.query("SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 50");
        const contactImports = await client.query(
          `SELECT ci.*, u.username
           FROM contact_imports ci
           JOIN users u ON u.id = ci.user_id
           ORDER BY ci.created_at DESC
           LIMIT 50`
        );
        const referralCodes = await client.query("SELECT * FROM referral_codes ORDER BY created_at DESC LIMIT 50");
        const leases = await client.query("SELECT * FROM workspace_leases ORDER BY created_at DESC LIMIT 50");
        const auditLogs = await client.query("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50");
        const billingPolicy = await getBillingPolicyForClient(client, { db });
        const planRows = plans.rows.map(toPlan);
        const auditTrail = auditLogs.rows.map(toAuditPreview);
        return {
          source: "postgres",
          generatedAt: isoNow(),
          billingPolicy,
          pendingUnpaidOrderCount: orders.rows.filter((order) => order.status !== "paid").length,
          summary: {
            users: users.rows.length,
            plans: plans.rows.length,
            creditEntries: ledger.rows.length,
            orders: orders.rows.length,
            paymentEvents: paymentEvents.rows.length,
            contactImports: contactImports.rows.length,
            activeLeases: leases.rows.filter((lease) => lease.status === "active").length,
            auditLogs: auditLogs.rows.length
          },
          modules: {
            users: {
              metric: String(users.rows.length),
              status: "PostgreSQL 已接",
              recordHeaders: ["注册时间", "UID", "账号", "状态", "套餐", "余额", "登录会话"],
              records: tableRows(users.rows, (user) => [
                user.created_at,
                shortUserUid(user.id),
                user.username,
                user.status,
                subscriptionByUser.get(user.id) || "-",
                String(balanceByUser.get(user.id) || 0),
                `${sessionsByUser.get(user.id) || 0} sessions`
              ])
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
              records: tableRows(orders.rows, (order) => [order.order_no, order.status, `${order.credits} credits`, order.provider_trade_no || "manual"]),
              paymentEvents: paymentEventRows(paymentEvents.rows)
            },
            imports: {
              metric: String(contactImports.rows.length),
              status: "PostgreSQL 已接",
              recordHeaders: ["上传时间", "账号", "原始文件", "格式", "行数", "SHA256"],
              records: tableRows(contactImports.rows.map(publicContactImport), (record) => [
                record.createdAt,
                record.account,
                record.originalFileName,
                record.originalFormat,
                String(record.parsedRowCount),
                record.originalSha256.slice(0, 16)
              ])
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
