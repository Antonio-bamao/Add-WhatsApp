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
    unitPriceCents: 30,
    dailyLimit: 200,
    workspaceLimit: 2,
    minimumTopUpCredits: 2000,
    templateLimit: 2
  },
  professional: {
    id: "professional",
    displayName: "专业版",
    cardTier: "PRO",
    unitPriceCents: 20,
    dailyLimit: 500,
    workspaceLimit: 3,
    minimumTopUpCredits: 5000,
    templateLimit: 4
  },
  business: {
    id: "business",
    displayName: "商业版",
    cardTier: "ULTRA",
    unitPriceCents: 10,
    dailyLimit: 1000,
    workspaceLimit: 5,
    minimumTopUpCredits: 20000,
    templateLimit: 8
  }
});

function isoNow(store) {
  return store.now().toISOString();
}

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
    username: user.username,
    status: user.status,
    createdAt: user.createdAt
  };
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
    referralCodes: new Map(),
    workspaceLeases: new Map(),
    auditLogs: [],
    accessTokens: new Map(),
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

export function adjustCredits(store, { adminUserId, userId, amount, reason, ip }) {
  getUser(store, userId);
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
  return after;
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
    orderNo: `ADWA-${String(store.orders.size + 1).padStart(6, "0")}`,
    userId,
    planId: plan.id,
    credits: Number(credits),
    amountCents: Number(amountCents),
    status: "created",
    paymentProvider: "manual",
    providerTradeNo: null,
    createdAt: isoNow(store),
    paidAt: null,
    closedAt: null
  };
  if (!Number.isInteger(order.credits) || order.credits <= 0) throw new Error("ORDER_CREDITS_INVALID");
  if (!Number.isInteger(order.amountCents) || order.amountCents < 0) throw new Error("ORDER_AMOUNT_INVALID");
  store.orders.set(order.id, order);
  return { ...order };
}

export function markOrderPaid(store, { orderId, adminUserId, providerTradeNo, ip }) {
  const order = store.orders.get(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const before = { status: order.status, balanceCredits: balanceFor(store, order.userId) };

  if (order.status !== "paid") {
    order.status = "paid";
    order.providerTradeNo = providerTradeNo || null;
    order.paidAt = isoNow(store);
    appendLedger(store, {
      userId: order.userId,
      type: "purchase",
      amount: order.credits,
      idempotencyKey: `purchase:${order.id}`,
      relatedOrderId: order.id,
      note: `manual payment ${providerTradeNo || ""}`.trim()
    });
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

export function listAuditLogs(store) {
  return [...store.auditLogs].reverse();
}
