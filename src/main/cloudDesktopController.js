const { getPlan } = require('../core/billingPlans');
const { mapCloudEntitlements } = require('../core/cloudApiClient');
const crypto = require('node:crypto');

const PLAN_RANKS = Object.freeze({
  free: 0,
  advanced: 1,
  professional: 2,
  business: 3
});

const FREE_ACCESS_EFFECTIVE_CAPABILITIES = Object.freeze({
  exportPreview: true,
  secondaryWorkspace: true,
  proxySettings: true,
  customTemplates: true
});
const FREE_ACCESS_WORKSPACE_LIMIT = 5;

function planRank(planId) {
  return PLAN_RANKS[planId] ?? PLAN_RANKS.free;
}

function normalizedTopUpCredits(value, fallback) {
  const credits = Math.floor(Number(value || 0));
  return Number.isInteger(credits) && credits > 0 ? credits : Number(fallback || 0);
}

function createCloudDesktopController({ client, sessionStore, deviceId = 'desktop' }) {
  function clearExpiredSession(error) {
    sessionStore.clear();
    return {
      ok: false,
      authRequired: true,
      error: error && error.message ? error.message : 'UNAUTHORIZED',
      cloud: publicCloudState(sessionStore.load())
    };
  }

  function isUnauthorized(error) {
    return error && (error.status === 401 || error.message === 'UNAUTHORIZED');
  }

  function handleCloudError(error) {
    if (isUnauthorized(error)) {
      return clearExpiredSession(error);
    }
    throw error;
  }

  function isCloudTimeout(error) {
    return error && (error.status === 504 || /TIMEOUT/.test(error.message || ''));
  }

  function validPolicyEnvelope(appPolicy) {
    const billing = appPolicy && appPolicy.billing;
    if (!billing || !billing.mode || !Number.isFinite(Number(billing.version))) return null;
    return { ...appPolicy, billing };
  }

  function isUsableCachedPolicy(appPolicy, now = Date.now()) {
    const envelope = validPolicyEnvelope(appPolicy);
    if (!envelope) return false;
    if (envelope.billing.mode !== 'free_access') return true;
    if (!envelope.billing.signature || !envelope.billing.keyId || !envelope.billing.cacheExpiresAt) return false;
    const expiresAt = Date.parse(envelope.billing.cacheExpiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now;
  }

  function chooseNewestPolicy(currentPolicy, nextPolicy) {
    const current = validPolicyEnvelope(currentPolicy);
    const next = validPolicyEnvelope(nextPolicy);
    if (!next) return currentPolicy || null;
    if (!current) return next;
    const currentVersion = Number(current.billing.version);
    const nextVersion = Number(next.billing.version);
    if (nextVersion < currentVersion) return current;
    if (nextVersion === currentVersion) {
      const currentFetched = Date.parse(current.billing.fetchedAt || current.billing.updatedAt || 0) || 0;
      const nextFetched = Date.parse(next.billing.fetchedAt || next.billing.updatedAt || 0) || 0;
      if (nextFetched < currentFetched) return current;
    }
    return next;
  }

  function entitlementsCarryPolicy(entitlements) {
    return Boolean(
      entitlements
      && (
        entitlements.billingPolicy
        || entitlements.billingMode
        || Object.prototype.hasOwnProperty.call(entitlements, 'unlimitedDailyUsage')
        || Object.prototype.hasOwnProperty.call(entitlements, 'hideBillingNavigation')
        || Object.prototype.hasOwnProperty.call(entitlements, 'effectiveCapabilities')
        || Object.prototype.hasOwnProperty.call(entitlements, 'effectiveWorkspaceLimit')
        || Object.prototype.hasOwnProperty.call(entitlements, 'effectiveTemplateLimit')
      )
    );
  }

  function paidEntitlementOverlay(entitlements) {
    const plan = getPlan(entitlements && (entitlements.planId || (entitlements.plan && entitlements.plan.id)));
    return {
      effectiveCapabilities: {
        exportPreview: Boolean(plan.id && plan.id !== 'free'),
        secondaryWorkspace: Number(plan.workspaceLimit || 0) > 1,
        proxySettings: Boolean(plan.id && plan.id !== 'free'),
        customTemplates: Number(plan.templateLimit || 0) > 1 || plan.templateLimit === null
      },
      effectiveWorkspaceLimit: Number(plan.workspaceLimit || 1),
      effectiveTemplateLimit: plan.templateLimit === null ? null : Number(plan.templateLimit || 0)
    };
  }

  function mergeEntitlementsWithAppPolicy(entitlements, appPolicy) {
    if (!entitlements) return entitlements;
    const envelope = validPolicyEnvelope(appPolicy);
    if (!envelope) return entitlements;
    const billing = envelope.billing;
    const next = {
      ...entitlements,
      billingPolicy: billing,
      billingMode: billing.mode,
      unlimitedDailyUsage: false,
      hideBillingNavigation: false
    };
    if (billing.mode !== 'free_access' || !isUsableCachedPolicy(envelope)) {
      return { ...next, ...paidEntitlementOverlay(entitlements) };
    }
    return {
      ...next,
      unlimitedDailyUsage: true,
      hideBillingNavigation: true,
      effectiveCapabilities: { ...FREE_ACCESS_EFFECTIVE_CAPABILITIES },
      effectiveWorkspaceLimit: FREE_ACCESS_WORKSPACE_LIMIT,
      effectiveTemplateLimit: null
    };
  }

  async function applyLatestAppPolicy(session, entitlements) {
    let appPolicy = session.appPolicy || null;
    let fetchedPolicy = null;
    if (typeof client.getAppPolicy === 'function') {
      try {
        fetchedPolicy = await client.getAppPolicy(session.accessToken);
        appPolicy = chooseNewestPolicy(appPolicy, fetchedPolicy);
      } catch {
        // Entitlements are still authoritative online; policy cache is best-effort here.
      }
    }
    const overlayPolicy = fetchedPolicy || (entitlementsCarryPolicy(entitlements) ? null : appPolicy);
    return {
      appPolicy,
      entitlements: mergeEntitlementsWithAppPolicy(entitlements, overlayPolicy)
    };
  }

  function cachedPolicyFallback(error) {
    if (isUnauthorized(error)) return null;
    const session = sessionStore.load();
    if (!session.authenticated || !session.entitlements || !isUsableCachedPolicy(session.appPolicy)) return null;
    const entitlements = mergeEntitlementsWithAppPolicy(session.entitlements, session.appPolicy);
    return {
      ok: true,
      offlinePolicy: true,
      error: error && error.message ? error.message : 'CLOUD_API_UNAVAILABLE',
      cloud: publicCloudState({ ...session, entitlements }),
      subscription: mapCloudEntitlements(entitlements)
    };
  }

  function wechatPaymentErrorResult({ paymentError, order, plan, credits, amountCents }) {
    const serverError = paymentError && paymentError.message ? paymentError.message : 'WECHAT_NATIVE_PAY_FAILED';
    if (!isCloudTimeout(paymentError)) throw paymentError;
    return {
      ok: false,
      error: '微信支付二维码生成超时，订单已创建但尚未付款；请稍后重试，或取消当前订单后重新生成。',
      serverError,
      paymentProvider: 'wechat',
      order,
      plan: {
        id: plan.id,
        name: plan.name,
        credits,
        amountCents
      }
    };
  }

  async function refreshStoredSession(session, originalError) {
    if (!session.refreshToken || typeof client.refreshSession !== 'function') {
      return { ok: false, result: clearExpiredSession(originalError) };
    }
    try {
      const refreshed = await client.refreshSession({
        refreshToken: session.refreshToken,
        deviceId
      });
      const nextSession = {
        ...session,
        user: refreshed.user || session.user,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || session.refreshToken
      };
      sessionStore.save(nextSession);
      return { ok: true, session: nextSession };
    } catch {
      return { ok: false, result: clearExpiredSession(originalError) };
    }
  }

  async function withFreshSession(action, { missingResult } = {}) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return missingResult || { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    try {
      return await action(session);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      const refreshed = await refreshStoredSession(session, error);
      if (!refreshed.ok) return refreshed.result;
      try {
        return await action(refreshed.session);
      } catch (retryError) {
        return handleCloudError(retryError);
      }
    }
  }

  async function register({ username, password, planId = 'advanced' }) {
    const session = await client.register({ username, password, deviceId, planId });
    const entitlements = await client.getEntitlements(session.accessToken);
    const policyState = await applyLatestAppPolicy(session, entitlements);
    const subscription = mapCloudEntitlements(policyState.entitlements);
    sessionStore.save({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      entitlements: policyState.entitlements,
      appPolicy: policyState.appPolicy
    });
    return {
      ok: true,
      cloud: publicCloudState({ ...sessionStore.load(), entitlements: policyState.entitlements }),
      subscription
    };
  }

  async function login({ username, password }) {
    const session = await client.login({ username, password, deviceId });
    const entitlements = await client.getEntitlements(session.accessToken);
    const policyState = await applyLatestAppPolicy(session, entitlements);
    const subscription = mapCloudEntitlements(policyState.entitlements);
    sessionStore.save({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      entitlements: policyState.entitlements,
      appPolicy: policyState.appPolicy
    });
    return {
      ok: true,
      cloud: publicCloudState({ ...sessionStore.load(), entitlements: policyState.entitlements }),
      subscription
    };
  }

  async function refreshEntitlements() {
    try {
      return await withFreshSession(async (session) => {
        const entitlements = await client.getEntitlements(session.accessToken);
        const policyState = await applyLatestAppPolicy(session, entitlements);
        const subscription = mapCloudEntitlements(policyState.entitlements);
        sessionStore.save({ ...session, entitlements: policyState.entitlements, appPolicy: policyState.appPolicy });
        return {
          ok: true,
          cloud: publicCloudState({ ...session, entitlements: policyState.entitlements, appPolicy: policyState.appPolicy }),
          subscription
        };
      });
    } catch (error) {
      const fallback = cachedPolicyFallback(error);
      if (fallback) return fallback;
      return handleCloudError(error);
    }
  }

  async function consumeSuccessfulAdds({ taskId, billingSessionId, sentRows = [], workspaceId = 'main', sentAt }) {
    const rows = Array.isArray(sentRows) ? sentRows : [];
    try {
      return await withFreshSession(async (session) => {
        let entitlements = session.entitlements;
        for (const row of rows) {
          const rowKey = row && row.rowNumber ? row.rowNumber : rows.indexOf(row) + 1;
          const contactHash = hashContact(row && row.whatsappId ? row.whatsappId : `${taskId}:${rowKey}`);
          entitlements = await withFreshSession(async (currentSession) => client.consumeCredit(currentSession.accessToken, {
            idempotencyKey: `desktop-send:${taskId}:${rowKey}:${contactHash.slice(0, 16)}`,
            taskId,
            billingSessionId,
            contactHash,
            workspaceId,
            sentAt
          }), {
            missingResult: { ok: false, authRequired: true, error: '请先登录账号。' }
          });
          if (!entitlements || entitlements.ok === false) return entitlements;
        }
        const stored = sessionStore.load();
        const mergedEntitlements = mergeEntitlementsWithAppPolicy(entitlements, stored.appPolicy);
        const subscription = mapCloudEntitlements(mergedEntitlements);
        sessionStore.save({ ...stored, entitlements: mergedEntitlements });
        return {
          ok: true,
          consumed: rows.length,
          cloud: publicCloudState({ ...sessionStore.load(), entitlements: mergedEntitlements }),
          subscription
        };
      }, {
        missingResult: { ok: true, skipped: true, authRequired: true }
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function createTaskBillingSession({ taskId, workspaceId = 'main', clientVersion } = {}) {
    try {
      return await withFreshSession(async (session) => {
        const taskBillingSession = await client.createTaskBillingSession(session.accessToken, {
          taskId,
          workspaceId,
          clientVersion,
          deviceId
        });
        return { ok: true, taskBillingSession };
      }, {
        missingResult: { ok: true, skipped: true, authRequired: true }
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function closeTaskBillingSession({ sessionId } = {}) {
    if (!sessionId) return { ok: true, skipped: true };
    try {
      return await withFreshSession(async (session) => {
        const taskBillingSession = await client.closeTaskBillingSession(session.accessToken, sessionId);
        return { ok: true, taskBillingSession };
      }, {
        missingResult: { ok: true, skipped: true, authRequired: true }
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function createContactImport(payload) {
    try {
      return await withFreshSession(async (session) => {
        const contactImport = await client.createContactImport(session.accessToken, payload);
        return { ok: true, contactImport };
      }, {
        missingResult: { ok: true, skipped: true, authRequired: true }
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function issueWorkspaceLease({ workspaceKind = 'secondary', processNonce }) {
    try {
      return await withFreshSession(async (session) => {
        const lease = await client.issueWorkspaceLease(session.accessToken, {
          deviceId,
          workspaceKind,
          processNonce
        });
        return { ok: true, lease };
      }, {
        missingResult: { ok: true, skipped: true, authRequired: true }
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function renewWorkspaceLease({ leaseId }) {
    try {
      return await withFreshSession(async (session) => {
        const lease = await client.renewWorkspaceLease(session.accessToken, leaseId);
        return { ok: true, lease };
      }, {
        missingResult: { ok: true, skipped: true, authRequired: true }
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function releaseWorkspaceLease({ leaseId }) {
    try {
      return await withFreshSession(async (session) => {
        const lease = await client.releaseWorkspaceLease(session.accessToken, leaseId);
        return { ok: true, lease };
      }, {
        missingResult: { ok: true, skipped: true, authRequired: true }
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function createAlipayTopUp({ planId }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    const plan = getPlan(planId || session.entitlements?.planId || 'advanced');
    const credits = Number(plan.minimumTopUpCredits || 0);
    const amountCents = Math.round(credits * Number(plan.unitPriceCents || 0));
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要线上充值。' };
    }
    try {
      const order = await withFreshSession((currentSession) => client.createOrder(currentSession.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      }));
      if (!order || order.authRequired) return order;
      const payment = await withFreshSession((currentSession) => client.createAlipayPagePay(currentSession.accessToken, order.id));
      if (!payment || payment.authRequired) return payment;
      return {
        ok: true,
        order,
        payment,
        plan: {
          id: plan.id,
          name: plan.name,
          credits,
          amountCents
        }
      };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function createZpayTopUp({ planId }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    const plan = getPlan(planId || session.entitlements?.planId || 'advanced');
    const credits = Number(plan.minimumTopUpCredits || 0);
    const amountCents = Math.round(credits * Number(plan.unitPriceCents || 0));
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要线上充值。' };
    }
    try {
      const order = await withFreshSession((currentSession) => client.createOrder(currentSession.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      }));
      if (!order || order.authRequired) return order;
      const payment = await withFreshSession((currentSession) => client.createZpayPagePay(currentSession.accessToken, order.id));
      if (!payment || payment.authRequired) return payment;
      return {
        ok: true,
        order,
        payment,
        plan: {
          id: plan.id,
          name: plan.name,
          credits,
          amountCents
        }
      };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function createWechatTopUp({ planId, credits: requestedCredits } = {}) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    const currentPlanId = session.entitlements?.planId || 'advanced';
    const plan = getPlan(planId || currentPlanId);
    if (planId && planRank(plan.id) < planRank(currentPlanId)) {
      return { ok: false, error: '不能购买低于当前套餐的套餐；如需增加额度，请到额度页购买。' };
    }
    const credits = normalizedTopUpCredits(requestedCredits, plan.minimumTopUpCredits);
    const amountCents = Math.round(credits * Number(plan.unitPriceCents || 0));
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要线上充值。' };
    }
    try {
      const order = await withFreshSession((currentSession) => client.createOrder(currentSession.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      }));
      if (!order || order.authRequired) return order;
      let payment;
      try {
        payment = await withFreshSession((currentSession) => client.createWechatNativePay(currentSession.accessToken, order.id));
        if (!payment || payment.authRequired) return payment;
      } catch (paymentError) {
        if (paymentError && paymentError.status === 404 && paymentError.message === 'NOT_FOUND') {
          return {
            ok: false,
            error: '线上 API 还没有部署微信支付接口，请先更新服务器后再生成微信支付订单。',
            serverError: paymentError.message,
            paymentProvider: 'wechat',
            order,
            plan: {
              id: plan.id,
              name: plan.name,
              credits,
              amountCents
            }
          };
        }
        return wechatPaymentErrorResult({ paymentError, order, plan, credits, amountCents });
      }
      return {
        ok: true,
        order,
        payment,
        plan: {
          id: plan.id,
          name: plan.name,
          credits,
          amountCents
        }
      };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function getPaymentOrderStatus({ orderId }) {
    try {
      return await withFreshSession(async (session) => {
        const order = await client.getOrderStatus(session.accessToken, orderId);
        return { ok: true, order };
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function listPaymentOrders() {
    try {
      return await withFreshSession(async (session) => {
        const orders = await client.listOrders(session.accessToken);
        return { ok: true, ...orders };
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function closePaymentOrder({ orderId, reason = 'canceled' }) {
    try {
      return await withFreshSession(async (session) => {
        const order = await client.closeOrder(session.accessToken, orderId, { reason });
        return { ok: true, order };
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function createManualTopUp({ planId }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    const plan = getPlan(planId || session.entitlements?.planId || 'advanced');
    const credits = Number(plan.minimumTopUpCredits || 0);
    const amountCents = Math.round(credits * Number(plan.unitPriceCents || 0));
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要充值。' };
    }
    try {
      const order = await withFreshSession((currentSession) => client.createOrder(currentSession.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      }));
      if (!order || order.authRequired) return order;
      const payment = await withFreshSession((currentSession) => client.createManualPayment(currentSession.accessToken, order.id));
      if (!payment || payment.authRequired) return payment;
      return {
        ok: true,
        order,
        payment,
        plan: {
          id: plan.id,
          name: plan.name,
          credits,
          amountCents
        }
      };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  function logout() {
    sessionStore.clear();
    return { ok: true, cloud: publicCloudState(sessionStore.load()) };
  }

  function getState() {
    return publicCloudState(sessionStore.load());
  }

  return {
    getState,
    createContactImport,
    createTaskBillingSession,
    closeTaskBillingSession,
    consumeSuccessfulAdds,
    issueWorkspaceLease,
    renewWorkspaceLease,
    releaseWorkspaceLease,
    createManualTopUp,
    createAlipayTopUp,
    createZpayTopUp,
    createWechatTopUp,
    getPaymentOrderStatus,
    listPaymentOrders,
    closePaymentOrder,
    register,
    login,
    logout,
    refreshEntitlements
  };
}

function hashContact(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function publicCloudState(session) {
  return {
    authenticated: Boolean(session && session.authenticated),
    user: session && session.authenticated ? session.user : null,
    entitlements: session && session.authenticated ? session.entitlements : null,
    appPolicy: session && session.authenticated ? session.appPolicy || null : null
  };
}

module.exports = {
  createCloudDesktopController,
  publicCloudState
};

