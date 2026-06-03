import crypto from "node:crypto";

export const PLAN_CATALOG = Object.freeze({
  free: {
    id: "free",
    displayName: "免费版",
    cardTier: "FREE",
    unitPriceCents: 0,
    dailyLimit: 10,
    workspaceLimit: 1,
    minimumTopUpCredits: 0,
    templateLimit: 1
  },
  advanced: {
    id: "advanced",
    displayName: "进阶版",
    cardTier: "PLUS",
    unitPriceCents: 40,
    dailyLimit: 200,
    workspaceLimit: 2,
    minimumTopUpCredits: 2000,
    templateLimit: 2
  },
  professional: {
    id: "professional",
    displayName: "专业版",
    cardTier: "PRO",
    unitPriceCents: 30,
    dailyLimit: 500,
    workspaceLimit: 3,
    minimumTopUpCredits: 5000,
    templateLimit: 4
  },
  business: {
    id: "business",
    displayName: "商业版",
    cardTier: "ULTRA",
    unitPriceCents: 20,
    dailyLimit: 1000,
    workspaceLimit: 5,
    minimumTopUpCredits: 20000,
    templateLimit: 8
  }
});

function isoNow(store) {
  return store.now().toISOString();
}

const ORDER_PAYMENT_TTL_MS = 5 * 60 * 1000;
const ADMIN_ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const CONTACT_IMPORT_MAX_BYTES = 25 * 1024 * 1024;

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
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

function businessParts(store) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const businessDate = formatter.format(store.now());
  return { businessDate, businessMonth: businessDate.slice(0, 7) };
}

function publicUser(user) {
  return {
    id: user.id,
    uid: shortUserUid(user.id),
    username: user.username,
    status: user.status,
    createdAt: user.createdAt
  };
}

function shortUserUid(userId) {
  const digest = crypto.createHash("sha256").update(String(userId || "")).digest("hex");
  const number = Number.parseInt(digest.slice(0, 12), 16) % 100000000;
  return String(number).padStart(8, "0");
}

function normalizeUsername(username) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) {
    throw new Error("USERNAME_INVALID");
  }
  return normalized;
}

function getPlan(planId) {
  const plan = PLAN_CATALOG[planId] || PLAN_CATALOG.free;
  return plan;
}

function getUser(store, userId) {
  const user = store.users.get(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.status !== "active") throw new Error("USER_NOT_ACTIVE");
  return user;
}

function resolveUserForAdmin(store, { userId, account }) {
  const identifier = String(userId || account || "").trim();
  if (!identifier) throw new Error("USER_IDENTIFIER_REQUIRED");
  if (store.users.has(identifier)) return findUser(store, identifier);
  const shortUidMatch = [...store.users.values()].find((item) => shortUserUid(item.id) === identifier);
  if (shortUidMatch) return shortUidMatch;
  const normalized = normalizeUsername(identifier);
  const user = [...store.users.values()].find((item) => item.username === normalized);
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

function findUser(store, userId) {
  const user = store.users.get(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

function getSubscription(store, userId) {
  return store.subscriptions.get(userId) || {
    id: createId("sub"),
    userId,
    planId: "free",
    status: "active",
    startedAt: isoNow(store),
    changedAt: isoNow(store)
  };
}

function balanceFor(store, userId) {
  return store.creditLedger
    .filter((entry) => entry.userId === userId)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

function appendAuditLog(store, { adminUserId, action, targetType, targetId, before, after, ip }) {
  const entry = {
    id: createId("audit"),
    adminUserId,
    action,
    targetType,
    targetId,
    beforeJson: JSON.stringify(before ?? null),
    afterJson: JSON.stringify(after ?? null),
    ip: ip || "127.0.0.1",
    createdAt: isoNow(store)
  };
  store.auditLogs.push(entry);
  return entry;
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

function normalizeContactImportPayload(store, body = {}) {
  const originalFileName = safeFileName(body.originalFileName, "contact-import");
  const originalFormat = normalizeOriginalFormat(body.originalFormat, originalFileName);
  const originalMimeType = String(body.originalMimeType || "application/octet-stream").slice(0, 200);
  const originalBytes = Buffer.from(String(body.originalBase64 || ""), "base64");
  if (!originalBytes.length) throw new Error("CONTACT_IMPORT_FILE_REQUIRED");
  if (originalBytes.length > CONTACT_IMPORT_MAX_BYTES) throw new Error("CONTACT_IMPORT_FILE_TOO_LARGE");
  const originalSizeBytes = Number(body.originalSizeBytes || originalBytes.length);
  if (originalSizeBytes !== originalBytes.length) throw new Error("CONTACT_IMPORT_SIZE_MISMATCH");
  const originalSha256 = crypto.createHash("sha256").update(originalBytes).digest("hex");
  const expectedSha256 = String(body.originalSha256 || originalSha256).trim().toLowerCase();
  if (expectedSha256 && expectedSha256 !== originalSha256) throw new Error("CONTACT_IMPORT_SHA_MISMATCH");
  const parsedRows = Array.isArray(body.parsedRows) ? body.parsedRows : [];
  return {
    id: createId("contact_import"),
    userId: body.userId,
    originalFileName,
    originalFormat,
    originalMimeType,
    originalSizeBytes: originalBytes.length,
    originalSha256,
    originalBase64: originalBytes.toString("base64"),
    columns: body.columns || {},
    stats: body.stats || {},
    importOptions: body.importOptions || {},
    parsedRows,
    createdAt: isoNow(store)
  };
}

function publicContactImport(store, record) {
  const user = store.users.get(record.userId);
  return {
    id: record.id,
    userId: record.userId,
    account: user ? user.username : record.userId,
    originalFileName: record.originalFileName,
    originalFormat: record.originalFormat,
    originalMimeType: record.originalMimeType,
    originalSizeBytes: record.originalSizeBytes,
    originalSha256: record.originalSha256,
    parsedRowCount: record.parsedRows.length,
    stats: record.stats,
    columns: record.columns,
    createdAt: record.createdAt,
    originalDownloadUrl: `/v1/admin/contact-imports/${record.id}/download?kind=original`,
    parsedDownloadUrl: `/v1/admin/contact-imports/${record.id}/download?kind=parsed`
  };
}

function createContactImport(store, body) {
  getUser(store, body.userId);
  const record = normalizeContactImportPayload(store, body);
  store.contactImports.set(record.id, record);
  return publicContactImport(store, record);
}

function listContactImports(store, { q, limit = 50, offset = 0 } = {}) {
  const normalizedQ = String(q || "").trim().toLowerCase();
  const numericLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const numericOffset = Math.max(Number(offset) || 0, 0);
  const filtered = [...store.contactImports.values()]
    .map((record) => publicContactImport(store, record))
    .filter((record) => {
      if (!normalizedQ) return true;
      return [
        record.account,
        record.userId,
        record.originalFileName,
        record.originalFormat,
        record.originalSha256
      ].join(" ").toLowerCase().includes(normalizedQ);
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    total: filtered.length,
    limit: numericLimit,
    offset: numericOffset,
    items: filtered.slice(numericOffset, numericOffset + numericLimit)
  };
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
      if (header.startsWith("source_")) {
        return csvEscape(excelFriendlyCsvValue(header, row.source?.[header.slice(7)]));
      }
      return csvEscape(excelFriendlyCsvValue(header, row[header]));
    }).join(","));
  }
  return `\ufeff${lines.join("\r\n")}\r\n`;
}

function parsedDownloadFileName(originalFileName) {
  return safeFileName(originalFileName.replace(/\.[^.]+$/, ""), "contact-import") + "-parsed.csv";
}

function getContactImportDownload(store, { importId, kind = "original" }) {
  const record = store.contactImports.get(importId);
  if (!record) throw new Error("CONTACT_IMPORT_NOT_FOUND");
  if (kind === "parsed") {
    return {
      body: Buffer.from(parsedRowsCsv(record.parsedRows), "utf8"),
      contentType: "text/csv; charset=utf-8",
      fileName: parsedDownloadFileName(record.originalFileName)
    };
  }
  return {
    body: Buffer.from(record.originalBase64, "base64"),
    contentType: record.originalMimeType || "application/octet-stream",
    fileName: record.originalFileName
  };
}

function appendLedger(store, { userId, type, amount, idempotencyKey, relatedOrderId, relatedTaskId, relatedContactHash, note }) {
  const existing = store.creditLedger.find((entry) => entry.idempotencyKey === idempotencyKey);
  if (existing) return { entry: existing, idempotentReplay: true };

  const balanceAfter = balanceFor(store, userId) + amount;
  if (balanceAfter < 0) throw new Error("INSUFFICIENT_CREDITS");

  const entry = {
    id: createId("ledger"),
    userId,
    type,
    amount,
    balanceAfter,
    idempotencyKey,
    relatedOrderId,
    relatedTaskId,
    relatedContactHash,
    note: note || "",
    createdAt: isoNow(store)
  };
  store.creditLedger.push(entry);
  return { entry, idempotentReplay: false };
}

function getOrCreateDailyUsage(store, userId, plan) {
  const { businessDate } = businessParts(store);
  const key = `${userId}:${businessDate}`;
  if (!store.usageDaily.has(key)) {
    store.usageDaily.set(key, {
      id: createId("usage_day"),
      userId,
      businessDate,
      planIdSnapshot: plan.id,
      dailyLimit: plan.dailyLimit,
      usedCount: 0,
      createdAt: isoNow(store),
      updatedAt: isoNow(store)
    });
  }
  return store.usageDaily.get(key);
}

function getOrCreateMonthlyUsage(store, userId, plan) {
  const { businessMonth } = businessParts(store);
  const key = `${userId}:${businessMonth}`;
  if (!store.usageMonthly.has(key)) {
    store.usageMonthly.set(key, {
      id: createId("usage_month"),
      userId,
      businessMonth,
      planIdSnapshot: plan.id,
      usedCount: 0,
      createdAt: isoNow(store),
      updatedAt: isoNow(store)
    });
  }
  return store.usageMonthly.get(key);
}

function referralCodeFor(username) {
  const clean = username.replace(/[^a-z0-9]/g, "").slice(0, 6).toUpperCase();
  return `ADWA${clean || "USER"}`;
}

export function createCloudStore(options = {}) {
  const fixedNow = options.now ? new Date(options.now) : null;
  return {
    users: new Map(),
    usersByUsername: new Map(),
    sessions: new Map(),
    subscriptions: new Map(),
    creditLedger: [],
    usageDaily: new Map(),
    usageMonthly: new Map(),
    orders: new Map(),
    paymentEvents: new Map(),
    contactImports: new Map(),
    referralCodes: new Map(),
    workspaceLeases: new Map(),
    auditLogs: [],
    accessTokens: new Map(),
    adminUsers: new Map([
      [
        "yojiro",
        {
          id: "admin-preview",
          username: "yojiro",
          passwordHash: "scrypt:addwhatsappdevsalt0011223344:f364dc6d774e4c1d1ea990f0cef9a65b5b7d0bba1c2909db2740744068b96ab89be89431031225da73fe988fd37bfec57954c330405ae36e3fd2fb5547c20631",
          role: "owner",
          status: "active",
          createdAt: "2026-05-26T00:00:00.000Z"
        }
      ]
    ]),
    adminAccessTokens: new Map(),
    now: () => fixedNow || new Date()
  };
}

export function registerUser(store, { username, password, planId = "free", referredByUserId = null }) {
  const normalized = normalizeUsername(username);
  if (store.usersByUsername.has(normalized)) throw new Error("USERNAME_EXISTS");
  if (String(password || "").length < 8) throw new Error("PASSWORD_TOO_WEAK");

  const now = isoNow(store);
  const user = {
    id: createId("user"),
    username: normalized,
    passwordHash: hashPassword(password),
    status: "active",
    referredByUserId,
    createdAt: now,
    updatedAt: now
  };
  store.users.set(user.id, user);
  store.usersByUsername.set(normalized, user.id);

  const plan = getPlan(planId);
  store.subscriptions.set(user.id, {
    id: createId("sub"),
    userId: user.id,
    planId: plan.id,
    status: "active",
    startedAt: now,
    endsAt: null,
    changedAt: now
  });

  store.referralCodes.set(user.id, {
    id: createId("refcode"),
    userId: user.id,
    code: referralCodeFor(normalized),
    status: "active",
    createdAt: now
  });

  return publicUser(user);
}

export function loginUser(store, { username, password, deviceId = "unknown-device" }) {
  const normalized = normalizeUsername(username);
  const userId = store.usersByUsername.get(normalized);
  if (!userId) throw new Error("AUTH_FAILED");
  const user = getUser(store, userId);
  if (!verifyPassword(password, user.passwordHash)) throw new Error("AUTH_FAILED");

  const accessToken = createId("token");
  const refreshToken = createId("refresh");
  store.accessTokens.set(accessToken, user.id);
  store.sessions.set(refreshToken, {
    id: createId("session"),
    userId: user.id,
    refreshTokenHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
    deviceId,
    expiresAt: new Date(store.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
    createdAt: isoNow(store)
  });

  return { user: publicUser(user), accessToken, refreshToken };
}

export function authenticateAccessToken(store, accessToken) {
  const userId = store.accessTokens.get(accessToken);
  if (!userId) throw new Error("UNAUTHORIZED");
  getUser(store, userId);
  return userId;
}

export function loginAdmin(store, { username, password }) {
  const normalized = normalizeUsername(username);
  const admin = store.adminUsers.get(normalized);
  if (!admin || admin.status !== "active" || !verifyPassword(password, admin.passwordHash)) {
    throw new Error("AUTH_FAILED");
  }
  const adminAccessToken = createId("admin_token");
  const expiresAt = new Date(store.now().getTime() + ADMIN_ACCESS_TOKEN_TTL_MS).toISOString();
  store.adminAccessTokens.set(adminAccessToken, { adminUserId: admin.id, expiresAt });
  return { admin: { id: admin.id, username: admin.username, role: admin.role }, adminAccessToken, expiresAt };
}

export function authenticateAdminToken(store, accessToken) {
  const session = store.adminAccessTokens.get(accessToken);
  if (session) {
    if (new Date(session.expiresAt) > store.now()) return session.adminUserId;
    store.adminAccessTokens.delete(accessToken);
  }
  if (store.accessTokens.has(accessToken)) throw new Error("ADMIN_FORBIDDEN");
  throw new Error("ADMIN_UNAUTHORIZED");
}

export function logoutAdmin(store, accessToken) {
  store.adminAccessTokens.delete(accessToken);
  return { loggedOut: true };
}

export function getEntitlements(store, userId) {
  getUser(store, userId);
  const subscription = getSubscription(store, userId);
  const plan = getPlan(subscription.planId);
  const balanceCredits = balanceFor(store, userId);
  const dailyUsage = getOrCreateDailyUsage(store, userId, plan);
  const monthlyUsage = getOrCreateMonthlyUsage(store, userId, plan);
  const remainingByLimit = Math.max(0, dailyUsage.dailyLimit - dailyUsage.usedCount);
  const referralCode = store.referralCodes.get(userId)?.code || null;

  return {
    userId,
    planId: plan.id,
    planName: plan.displayName,
    cardTier: plan.cardTier,
    unitPriceCents: plan.unitPriceCents,
    balanceCredits,
    dailyLimit: dailyUsage.dailyLimit,
    usedToday: dailyUsage.usedCount,
    usedThisMonth: monthlyUsage.usedCount,
    availableToday: Math.min(balanceCredits, remainingByLimit),
    workspaceLimit: plan.workspaceLimit,
    templateLimit: plan.templateLimit,
    referralCode,
    businessDate: dailyUsage.businessDate,
    resetAt: `${dailyUsage.businessDate}T24:00:00+08:00`
  };
}

export function adjustCredits(store, { adminUserId, userId, account, amount, reason, ip }) {
  const user = resolveUserForAdmin(store, { userId, account });
  userId = user.id;
  const numericAmount = Number(amount);
  if (!Number.isInteger(numericAmount) || numericAmount === 0) throw new Error("ADJUSTMENT_AMOUNT_INVALID");
  const before = { balanceCredits: balanceFor(store, userId) };
  const { entry } = appendLedger(store, {
    userId,
    type: "admin_adjustment",
    amount: numericAmount,
    idempotencyKey: `admin_adjustment:${adminUserId}:${userId}:${reason}:${numericAmount}:${store.auditLogs.length + 1}`,
    note: reason || "admin adjustment"
  });
  const after = { balanceCredits: entry.balanceAfter };
  appendAuditLog(store, {
    adminUserId,
    action: "credit.adjustment",
    targetType: "user",
    targetId: userId,
    before,
    after,
    ip
  });
  return { userId, account: user.username, ...after };
}

export function consumeCredit(store, { userId, idempotencyKey, taskId, contactHash, workspaceId, sentAt }) {
  getUser(store, userId);
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  const existing = store.creditLedger.find((entry) => entry.idempotencyKey === idempotencyKey);
  if (existing) {
    const entitlement = getEntitlements(store, userId);
    return { ...entitlement, idempotentReplay: true, ledgerId: existing.id };
  }

  const entitlement = getEntitlements(store, userId);
  if (entitlement.availableToday <= 0) throw new Error("NO_AVAILABLE_CREDITS");

  const subscription = getSubscription(store, userId);
  const plan = getPlan(subscription.planId);
  const dailyUsage = getOrCreateDailyUsage(store, userId, plan);
  const monthlyUsage = getOrCreateMonthlyUsage(store, userId, plan);
  const { entry } = appendLedger(store, {
    userId,
    type: "consume",
    amount: -1,
    idempotencyKey,
    relatedTaskId: taskId,
    relatedContactHash: contactHash,
    note: `workspace=${workspaceId};sent_at=${sentAt}`
  });

  dailyUsage.usedCount += 1;
  dailyUsage.updatedAt = isoNow(store);
  monthlyUsage.usedCount += 1;
  monthlyUsage.updatedAt = isoNow(store);

  return { ...getEntitlements(store, userId), idempotentReplay: false, ledgerId: entry.id };
}

export function createOrder(store, { userId, planId, credits, amountCents }) {
  getUser(store, userId);
  const plan = getPlan(planId);
  const order = {
    id: createId("order"),
    orderNo: `${String(store.orders.size + 1).padStart(12, "0")}`,
    userId,
    planId: plan.id,
    credits: Number(credits),
    amountCents: Number(amountCents),
    status: "created",
    paymentProvider: "manual",
    providerTradeNo: null,
    createdAt: isoNow(store),
    expiresAt: new Date(store.now().getTime() + ORDER_PAYMENT_TTL_MS).toISOString(),
    paidAt: null,
    closedAt: null
  };
  if (!Number.isInteger(order.credits) || order.credits <= 0) throw new Error("ORDER_CREDITS_INVALID");
  if (!Number.isInteger(order.amountCents) || order.amountCents < 0) throw new Error("ORDER_AMOUNT_INVALID");
  store.orders.set(order.id, order);
  return { ...order };
}

export function getOrderForPayment(store, { userId, orderId }) {
  getUser(store, userId);
  const order = store.orders.get(orderId);
  if (!order || order.userId !== userId) throw new Error("ORDER_NOT_FOUND");
  if (order.status === "paid") throw new Error("ORDER_ALREADY_PAID");
  if (order.expiresAt && new Date(order.expiresAt) <= store.now()) {
    closeOrder(store, { userId, orderId, reason: "expired" });
    throw new Error("ORDER_CLOSED");
  }
  if (order.closedAt || ["closed", "canceled", "expired"].includes(order.status)) throw new Error("ORDER_CLOSED");
  return { ...order };
}

export function getOrderStatus(store, { userId, orderId }) {
  getUser(store, userId);
  const order = store.orders.get(orderId);
  if (!order || order.userId !== userId) throw new Error("ORDER_NOT_FOUND");
  return { ...store.orders.get(orderId), balanceCredits: balanceFor(store, userId) };
}

export function listOrders(store, { userId, limit = 20, offset = 0 } = {}) {
  getUser(store, userId);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const normalizedOffset = Math.max(Number(offset) || 0, 0);
  const orders = [...store.orders.values()]
    .filter((order) => order.userId === userId)
    .sort((left, right) => {
      const byCreatedAt = String(right.createdAt).localeCompare(String(left.createdAt));
      return byCreatedAt || String(right.orderNo).localeCompare(String(left.orderNo));
    });
  return {
    items: orders.slice(normalizedOffset, normalizedOffset + normalizedLimit).map((order) => ({ ...order })),
    total: orders.length,
    limit: normalizedLimit,
    offset: normalizedOffset
  };
}

export function markOrderPaymentProvider(store, { userId, orderId, provider }) {
  getUser(store, userId);
  const order = store.orders.get(orderId);
  if (!order || order.userId !== userId) throw new Error("ORDER_NOT_FOUND");
  if (order.status === "paid") throw new Error("ORDER_ALREADY_PAID");
  if (order.closedAt || ["closed", "canceled", "expired"].includes(order.status)) throw new Error("ORDER_CLOSED");
  order.paymentProvider = String(provider || order.paymentProvider || "manual").trim().toLowerCase();
  return { ...order };
}

export function closeOrder(store, { userId, orderId, reason = "canceled" }) {
  getUser(store, userId);
  const order = store.orders.get(orderId);
  if (!order || order.userId !== userId) throw new Error("ORDER_NOT_FOUND");
  if (order.status === "paid") throw new Error("ORDER_ALREADY_PAID");
  if (order.closedAt || ["closed", "canceled", "expired"].includes(order.status)) return { ...order, balanceCredits: balanceFor(store, userId) };
  const normalizedReason = String(reason || "canceled").trim().toLowerCase();
  order.status = normalizedReason === "expired" ? "expired" : "canceled";
  order.closedAt = isoNow(store);
  return { ...order, balanceCredits: balanceFor(store, userId) };
}

export function expireOrder(store, { userId, orderId }) {
  return closeOrder(store, { userId, orderId, reason: "expired" });
}

function orderByIdOrNumber(store, { orderId, orderNo }) {
  if (orderId) return store.orders.get(orderId);
  if (orderNo) return [...store.orders.values()].find((order) => order.orderNo === orderNo);
  return null;
}

function creditPaidOrder(store, order, { providerTradeNo, notePrefix = "payment" } = {}) {
  const beforeStatus = order.status;
  order.status = "paid";
  order.providerTradeNo = providerTradeNo || order.providerTradeNo || null;
  order.paidAt = order.paidAt || isoNow(store);
  try {
    appendLedger(store, {
      userId: order.userId,
      type: "purchase",
      amount: order.credits,
      idempotencyKey: `purchase:${order.id}`,
      relatedOrderId: order.id,
      note: `${notePrefix} ${order.providerTradeNo || ""}`.trim()
    });
  } catch (error) {
    order.status = "paid_pending_credit";
    throw error;
  }
  return { beforeStatus, order };
}

export function markOrderPaid(store, { orderId, adminUserId, providerTradeNo, ip }) {
  const order = store.orders.get(orderId) || orderByIdOrNumber(store, { orderNo: orderId });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const before = { status: order.status, balanceCredits: balanceFor(store, order.userId) };

  if (order.status !== "paid") {
    creditPaidOrder(store, order, { providerTradeNo, notePrefix: "manual payment" });
  }

  appendAuditLog(store, {
    adminUserId,
    action: "order.mark_paid",
    targetType: "order",
    targetId: order.id,
    before,
    after: { status: order.status, balanceCredits: balanceFor(store, order.userId) },
    ip
  });
  return { ...order, balanceCredits: balanceFor(store, order.userId) };
}

export function getOrderForAdmin(store, { orderId }) {
  const order = store.orders.get(orderId) || orderByIdOrNumber(store, { orderNo: orderId });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  return { ...order, balanceCredits: balanceFor(store, order.userId) };
}

export function processPaymentEvent(store, { provider, providerEventId, orderId, orderNo, eventType, providerTradeNo, payload }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedEventId = String(providerEventId || "").trim();
  if (!normalizedProvider) throw new Error("PAYMENT_PROVIDER_REQUIRED");
  if (!normalizedEventId) throw new Error("PAYMENT_EVENT_ID_REQUIRED");
  if (!eventType) throw new Error("PAYMENT_EVENT_TYPE_REQUIRED");

  const existing = store.paymentEvents.get(normalizedEventId);
  if (existing) {
    const existingOrder = store.orders.get(existing.orderId);
    return {
      event: { ...existing },
      order: existingOrder ? { ...existingOrder, balanceCredits: balanceFor(store, existingOrder.userId) } : null,
      idempotentReplay: true
    };
  }

  const order = orderByIdOrNumber(store, { orderId, orderNo });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const event = {
    id: createId("payment_event"),
    provider: normalizedProvider,
    providerEventId: normalizedEventId,
    orderId: order.id,
    eventType,
    payloadJson: JSON.stringify(payload ?? {}),
    processedAt: null,
    createdAt: isoNow(store)
  };
  store.paymentEvents.set(normalizedEventId, event);

  if (["payment_succeeded", "paid", "trade_success"].includes(String(eventType))) {
    try {
      creditPaidOrder(store, order, { providerTradeNo, notePrefix: `${normalizedProvider} payment` });
      event.processedAt = isoNow(store);
    } catch (error) {
      event.processedAt = null;
      return {
        event: { ...event },
        order: { ...order, balanceCredits: balanceFor(store, order.userId) },
        idempotentReplay: false,
        creditStatus: "pending",
        error: error.message
      };
    }
  }

  return {
    event: { ...event },
    order: { ...order, balanceCredits: balanceFor(store, order.userId) },
    idempotentReplay: false,
    creditStatus: order.status === "paid_pending_credit" ? "pending" : "credited"
  };
}

export function processPendingOrderCredits(store, { limit = 20 } = {}) {
  const pendingOrders = [...store.orders.values()]
    .filter((order) => order.status === "paid_pending_credit")
    .slice(0, Number(limit) || 20);
  const failures = [];
  let processedCount = 0;

  for (const order of pendingOrders) {
    try {
      creditPaidOrder(store, order, { providerTradeNo: order.providerTradeNo, notePrefix: "payment compensation" });
      processedCount += 1;
    } catch (error) {
      failures.push({ orderId: order.id, error: error.message });
    }
  }

  return { processedCount, failedCount: failures.length, failures };
}

export function issueWorkspaceLease(store, { userId, deviceId, workspaceKind, processNonce }) {
  getUser(store, userId);
  const plan = getPlan(getSubscription(store, userId).planId);
  const activeLeases = [...store.workspaceLeases.values()].filter(
    (lease) => lease.userId === userId && lease.status === "active" && new Date(lease.expiresAt) > store.now()
  );
  if (activeLeases.length >= plan.workspaceLimit) {
    throw new Error("WORKSPACE_LIMIT_REACHED");
  }

  const lease = {
    id: createId("lease"),
    userId,
    deviceId,
    workspaceKind,
    processNonce,
    status: "active",
    expiresAt: new Date(store.now().getTime() + 60 * 1000).toISOString(),
    createdAt: isoNow(store),
    renewedAt: isoNow(store),
    releasedAt: null
  };
  store.workspaceLeases.set(lease.id, lease);
  return { leaseId: lease.id, expiresAt: lease.expiresAt, activeCount: activeLeases.length + 1, workspaceLimit: plan.workspaceLimit };
}

export function renewWorkspaceLease(store, { userId, leaseId }) {
  const lease = workspaceLeaseForUser(store, userId, leaseId);
  if (lease.status !== "active") throw new Error("WORKSPACE_LEASE_NOT_ACTIVE");
  lease.expiresAt = new Date(store.now().getTime() + 60 * 1000).toISOString();
  lease.renewedAt = isoNow(store);
  return { leaseId: lease.id, status: lease.status, expiresAt: lease.expiresAt, renewedAt: lease.renewedAt };
}

export function releaseWorkspaceLease(store, { userId, leaseId }) {
  const lease = workspaceLeaseForUser(store, userId, leaseId);
  if (lease.status !== "released") {
    lease.status = "released";
    lease.releasedAt = isoNow(store);
  }
  return { leaseId: lease.id, status: lease.status, releasedAt: lease.releasedAt };
}

export function adminReleaseWorkspaceLease(store, { leaseId, adminUserId, reason, ip }) {
  const lease = store.workspaceLeases.get(leaseId);
  if (!lease) throw new Error("WORKSPACE_LEASE_NOT_FOUND");
  const before = { status: lease.status, releasedAt: lease.releasedAt };
  if (lease.status !== "released") {
    lease.status = "released";
    lease.releasedAt = isoNow(store);
  }
  const after = { status: lease.status, releasedAt: lease.releasedAt, reason: reason || "admin release" };
  appendAuditLog(store, {
    adminUserId,
    action: "workspace.release",
    targetType: "workspace_lease",
    targetId: lease.id,
    before,
    after,
    ip
  });
  return { leaseId: lease.id, status: lease.status, releasedAt: lease.releasedAt };
}

export function setUserStatus(store, { userId, status, adminUserId, reason, ip }) {
  if (!["active", "frozen"].includes(status)) throw new Error("USER_STATUS_INVALID");
  const user = resolveUserForAdmin(store, { userId });
  userId = user.id;
  const before = { status: user.status };
  user.status = status;
  user.updatedAt = isoNow(store);
  const after = { status: user.status, reason: reason || "admin status update" };
  appendAuditLog(store, {
    adminUserId,
    action: "user.status_update",
    targetType: "user",
    targetId: user.id,
    before,
    after,
    ip
  });
  return { userId: user.id, username: user.username, status: user.status, updatedAt: user.updatedAt };
}

export function updateUserPlan(store, { userId, planId, adminUserId, reason, ip }) {
  const user = resolveUserForAdmin(store, { userId });
  const plan = getPlan(planId);
  const beforeSubscription = getSubscription(store, user.id);
  const now = isoNow(store);
  store.subscriptions.set(user.id, {
    ...beforeSubscription,
    id: beforeSubscription.id || createId("sub"),
    userId: user.id,
    planId: plan.id,
    status: "active",
    changedAt: now
  });
  appendAuditLog(store, {
    adminUserId,
    action: "user.plan_update",
    targetType: "user",
    targetId: user.id,
    before: { planId: beforeSubscription.planId },
    after: { planId: plan.id, reason: reason || "admin plan update" },
    ip
  });
  return { userId: user.id, username: user.username, planId: plan.id, updatedAt: now };
}

export function revokeUserSessions(store, { userId, adminUserId, reason, ip }) {
  const user = resolveUserForAdmin(store, { userId });
  const revokedAt = isoNow(store);
  let revokedCount = 0;
  for (const session of store.sessions.values()) {
    if (session.userId === user.id && !session.revokedAt) {
      session.revokedAt = revokedAt;
      revokedCount += 1;
    }
  }
  appendAuditLog(store, {
    adminUserId,
    action: "user.sessions_revoke",
    targetType: "user",
    targetId: user.id,
    before: { activeSessions: revokedCount },
    after: { activeSessions: 0, reason: reason || "admin sessions revoke" },
    ip
  });
  return { userId: user.id, username: user.username, revokedCount, revokedAt };
}

function workspaceLeaseForUser(store, userId, leaseId) {
  getUser(store, userId);
  const lease = store.workspaceLeases.get(leaseId);
  if (!lease || lease.userId !== userId) throw new Error("WORKSPACE_LEASE_NOT_FOUND");
  return lease;
}

export function listAuditLogs(store) {
  return [...store.auditLogs].reverse();
}

function tableRows(items, mapper) {
  return items.length > 0 ? items.map(mapper) : [];
}

const USER_RECORD_HEADERS = ["注册时间", "UID", "账号", "状态", "套餐", "余额", "登录会话"];

function auditPreviewRows(auditLogs) {
  return auditLogs.map((entry) => ({
    at: entry.createdAt.replace("T", " ").slice(0, 16),
    actor: entry.adminUserId,
    action: entry.action,
    target: `${entry.targetType}:${entry.targetId}`,
    before: entry.beforeJson,
    after: entry.afterJson
  }));
}

function paymentEventRows(paymentEvents) {
  return tableRows(paymentEvents.slice(-20).reverse(), (event) => [
    event.provider,
    event.eventType,
    event.providerEventId,
    event.orderId,
    event.processedAt || "pending"
  ]);
}

function normalizePaymentEvent(event) {
  return {
    id: event.id,
    provider: event.provider,
    providerEventId: event.providerEventId,
    orderId: event.orderId,
    eventType: event.eventType,
    payloadJson: event.payloadJson,
    processedAt: event.processedAt || null,
    createdAt: event.createdAt
  };
}

export function listPaymentEvents(store, { provider, eventType, processed, q, limit = 50, offset = 0 } = {}) {
  const normalizedProvider = provider ? String(provider).toLowerCase() : "";
  const normalizedEventType = eventType ? String(eventType) : "";
  const normalizedProcessed = processed ? String(processed) : "";
  const query = q ? String(q).toLowerCase() : "";
  const numericLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const numericOffset = Math.max(Number(offset) || 0, 0);

  const filtered = [...store.paymentEvents.values()]
    .map(normalizePaymentEvent)
    .filter((event) => !normalizedProvider || event.provider === normalizedProvider)
    .filter((event) => !normalizedEventType || event.eventType === normalizedEventType)
    .filter((event) => {
      if (normalizedProcessed === "processed") return Boolean(event.processedAt);
      if (normalizedProcessed === "pending") return !event.processedAt;
      return true;
    })
    .filter((event) => {
      if (!query) return true;
      return [event.provider, event.providerEventId, event.orderId, event.eventType].join(" ").toLowerCase().includes(query);
    })
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));

  return {
    total: filtered.length,
    limit: numericLimit,
    offset: numericOffset,
    items: filtered.slice(numericOffset, numericOffset + numericLimit)
  };
}

export function getAdminConsoleSnapshot(store) {
  const users = [...store.users.values()];
  const plans = Object.values(PLAN_CATALOG);
  const orders = [...store.orders.values()];
  const paymentEvents = [...store.paymentEvents.values()];
  const contactImports = [...store.contactImports.values()];
  const leases = [...store.workspaceLeases.values()];
  const dailyUsage = [...store.usageDaily.values()];
  const referralCodes = [...store.referralCodes.values()];
  const auditTrail = auditPreviewRows(listAuditLogs(store));

  const modules = {
    users: {
      metric: String(users.length),
      status: "本地 API 预览",
      recordHeaders: USER_RECORD_HEADERS,
      records: tableRows(users, (user) => {
        const subscription = getSubscription(store, user.id);
        const sessions = [...store.sessions.values()].filter((session) => session.userId === user.id).length;
        return [
          user.createdAt,
          shortUserUid(user.id),
          user.username,
          user.status,
          subscription.planId,
          String(balanceFor(store, user.id)),
          `${sessions} sessions`
        ];
      })
    },
    plans: {
      metric: String(plans.length),
      status: "API 已接",
      records: plans.map((plan) => [
        plan.cardTier,
        `${plan.dailyLimit} / 天`,
        `${plan.workspaceLimit} 工作台`,
        `${plan.unitPriceCents / 100} 元`
      ])
    },
    credits: {
      metric: String(store.creditLedger.reduce((sum, entry) => sum + Math.max(0, entry.amount), 0)),
      status: "API 已接",
      records: tableRows(store.creditLedger.slice(-6).reverse(), (entry) => [
        entry.type,
        String(entry.amount),
        entry.idempotencyKey,
        `balance ${entry.balanceAfter}`
      ])
    },
    usage: {
      metric: `${dailyUsage.reduce((sum, entry) => sum + entry.usedCount, 0)}`,
      status: "API 已接",
      records: tableRows(dailyUsage, (entry) => [
        entry.businessDate,
        entry.planIdSnapshot,
        String(entry.usedCount),
        `${Math.max(0, entry.dailyLimit - entry.usedCount)} remaining`
      ])
    },
    orders: {
      metric: String(orders.filter((order) => order.status !== "paid").length),
      status: "API 已接",
      records: tableRows(orders, (order) => [
        order.orderNo,
        order.status,
        `${order.credits} credits`,
        order.providerTradeNo || "manual"
      ]),
      paymentEvents: paymentEventRows(paymentEvents)
    },
    imports: {
      metric: String(contactImports.length),
      status: "API 已接",
      recordHeaders: ["上传时间", "账号", "原始文件", "格式", "行数", "SHA256"],
      records: tableRows(contactImports.map((record) => publicContactImport(store, record)), (record) => [
        record.createdAt,
        record.account,
        record.originalFileName,
        record.originalFormat,
        String(record.parsedRowCount),
        record.originalSha256.slice(0, 16)
      ])
    },
    referrals: {
      metric: String(referralCodes.length),
      status: "API 已接",
      records: tableRows(referralCodes, (code) => [
        code.code,
        code.status,
        code.userId,
        "等待首充奖励规则"
      ])
    },
    workspaces: {
      metric: String(leases.filter((lease) => lease.status === "active").length),
      status: "API 已接",
      records: tableRows(leases, (lease) => [
        lease.id,
        lease.workspaceKind,
        lease.status,
        `expires ${lease.expiresAt.slice(11, 19)}`
      ])
    },
    audit: {
      metric: "100%",
      status: "API 已接",
      records: tableRows(auditTrail, (entry) => [
        entry.action,
        entry.target,
        entry.before,
        entry.after
      ])
    }
  };

  return {
    source: "server-local-preview",
    generatedAt: isoNow(store),
    summary: {
      users: users.length,
      plans: plans.length,
      creditEntries: store.creditLedger.length,
      orders: orders.length,
      paymentEvents: paymentEvents.length,
      contactImports: contactImports.length,
      activeLeases: leases.filter((lease) => lease.status === "active").length,
      auditLogs: auditTrail.length
    },
    modules,
    actionQueue: [
      {
        label: "API 联调",
        target: "admin -> server",
        detail: "后台管理台正在读取本地 API 快照",
        severity: "info"
      },
      {
        label: "数据库迁移",
        target: "PostgreSQL schema",
        detail: "下一步把 schema.sql 应用到项目专用 Postgres",
        severity: "warn"
      }
    ],
    auditTrail
  };
}

export function createMemoryRuntime(options = {}) {
  const store = options.store || createCloudStore(options);

  return {
    mode: "local-preview",
    store,
    authenticateAccessToken: (accessToken) => authenticateAccessToken(store, accessToken),
    authenticateAdminToken: (accessToken) => authenticateAdminToken(store, accessToken),
    registerUser: (body) => registerUser(store, body),
    loginUser: (body) => loginUser(store, body),
    loginAdmin: (body) => loginAdmin(store, body),
    logoutAdmin: (accessToken) => logoutAdmin(store, accessToken),
    getEntitlements: (userId) => getEntitlements(store, userId),
    consumeCredit: (body) => consumeCredit(store, body),
    createOrder: (body) => createOrder(store, body),
    getOrderForPayment: (body) => getOrderForPayment(store, body),
    getOrderStatus: (body) => getOrderStatus(store, body),
    listOrders: (body) => listOrders(store, body),
    markOrderPaymentProvider: (body) => markOrderPaymentProvider(store, body),
    closeOrder: (body) => closeOrder(store, body),
    expireOrder: (body) => expireOrder(store, body),
    getOrderForAdmin: (body) => getOrderForAdmin(store, body),
    markOrderPaid: (body) => markOrderPaid(store, body),
    processPaymentEvent: (body) => processPaymentEvent(store, body),
    processPendingOrderCredits: (body) => processPendingOrderCredits(store, body),
    listPaymentEvents: (query) => listPaymentEvents(store, query),
    createContactImport: (body) => createContactImport(store, body),
    listContactImports: (query) => listContactImports(store, query),
    getContactImportDownload: (body) => getContactImportDownload(store, body),
    adjustCredits: (body) => adjustCredits(store, body),
    issueWorkspaceLease: (body) => issueWorkspaceLease(store, body),
    renewWorkspaceLease: (body) => renewWorkspaceLease(store, body),
    releaseWorkspaceLease: (body) => releaseWorkspaceLease(store, body),
    adminReleaseWorkspaceLease: (body) => adminReleaseWorkspaceLease(store, body),
    setUserStatus: (body) => setUserStatus(store, body),
    updateUserPlan: (body) => updateUserPlan(store, body),
    revokeUserSessions: (body) => revokeUserSessions(store, body),
    listAuditLogs: () => listAuditLogs(store),
    getAdminConsoleSnapshot: () => getAdminConsoleSnapshot(store)
  };
}
