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
    referralCodes: new Map(),
    workspaceLeases: new Map(),
    auditLogs: [],
    accessTokens: new Map(),
    adminUsers: new Map([
      [
        "admin-preview",
        {
          id: "admin-preview",
          username: "admin-preview",
          passwordHash: hashPassword("AdminPass123"),
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
  store.adminAccessTokens.set(adminAccessToken, admin.id);
  return { admin: { id: admin.id, username: admin.username, role: admin.role }, adminAccessToken };
}

export function authenticateAdminToken(store, accessToken) {
  const adminUserId = store.adminAccessTokens.get(accessToken);
  if (adminUserId) return adminUserId;
  if (store.accessTokens.has(accessToken)) throw new Error("ADMIN_FORBIDDEN");
  throw new Error("ADMIN_UNAUTHORIZED");
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
    orderNo: `${String(store.orders.size + 1).padStart(12, "0")}`,
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

export function getOrderForPayment(store, { userId, orderId }) {
  getUser(store, userId);
  const order = store.orders.get(orderId);
  if (!order || order.userId !== userId) throw new Error("ORDER_NOT_FOUND");
  if (order.status === "paid") throw new Error("ORDER_ALREADY_PAID");
  if (order.closedAt || order.status === "closed") throw new Error("ORDER_CLOSED");
  return { ...order };
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
  const order = store.orders.get(orderId);
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
  const user = findUser(store, userId);
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
  return items.length > 0 ? items.map(mapper) : [["暂无记录", "empty", "等待 API 写入", "本地预览"]];
}

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
  const leases = [...store.workspaceLeases.values()];
  const dailyUsage = [...store.usageDaily.values()];
  const referralCodes = [...store.referralCodes.values()];
  const auditTrail = auditPreviewRows(listAuditLogs(store));

  const modules = {
    users: {
      metric: String(users.length),
      status: "本地 API 预览",
      records: tableRows(users, (user) => {
        const subscription = getSubscription(store, user.id);
        return [user.username, user.status, subscription.planId, `${[...store.sessions.values()].filter((session) => session.userId === user.id).length} sessions`];
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
    getEntitlements: (userId) => getEntitlements(store, userId),
    consumeCredit: (body) => consumeCredit(store, body),
    createOrder: (body) => createOrder(store, body),
    getOrderForPayment: (body) => getOrderForPayment(store, body),
    markOrderPaid: (body) => markOrderPaid(store, body),
    processPaymentEvent: (body) => processPaymentEvent(store, body),
    processPendingOrderCredits: (body) => processPendingOrderCredits(store, body),
    listPaymentEvents: (query) => listPaymentEvents(store, query),
    adjustCredits: (body) => adjustCredits(store, body),
    issueWorkspaceLease: (body) => issueWorkspaceLease(store, body),
    renewWorkspaceLease: (body) => renewWorkspaceLease(store, body),
    releaseWorkspaceLease: (body) => releaseWorkspaceLease(store, body),
    adminReleaseWorkspaceLease: (body) => adminReleaseWorkspaceLease(store, body),
    setUserStatus: (body) => setUserStatus(store, body),
    listAuditLogs: () => listAuditLogs(store),
    getAdminConsoleSnapshot: () => getAdminConsoleSnapshot(store)
  };
}
