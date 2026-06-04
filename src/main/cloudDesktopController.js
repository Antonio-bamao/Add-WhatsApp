const { getPlan } = require('../core/billingPlans');
const { mapCloudEntitlements } = require('../core/cloudApiClient');
const crypto = require('node:crypto');

const PLAN_RANKS = Object.freeze({
  free: 0,
  advanced: 1,
  professional: 2,
  business: 3
});

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
    const subscription = mapCloudEntitlements(entitlements);
    sessionStore.save({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      entitlements
    });
    return {
      ok: true,
      cloud: publicCloudState({ ...sessionStore.load(), entitlements }),
      subscription
    };
  }

  async function login({ username, password }) {
    const session = await client.login({ username, password, deviceId });
    const entitlements = await client.getEntitlements(session.accessToken);
    const subscription = mapCloudEntitlements(entitlements);
    sessionStore.save({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      entitlements
    });
    return {
      ok: true,
      cloud: publicCloudState({ ...sessionStore.load(), entitlements }),
      subscription
    };
  }

  async function refreshEntitlements() {
    try {
      return await withFreshSession(async (session) => {
        const entitlements = await client.getEntitlements(session.accessToken);
        const subscription = mapCloudEntitlements(entitlements);
        sessionStore.save({ ...session, entitlements });
        return {
          ok: true,
          cloud: publicCloudState({ ...session, entitlements }),
          subscription
        };
      });
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function consumeSuccessfulAdds({ taskId, sentRows = [], workspaceId = 'main', sentAt }) {
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
            contactHash,
            workspaceId,
            sentAt
          }), {
            missingResult: { ok: false, authRequired: true, error: '请先登录账号。' }
          });
          if (!entitlements || entitlements.ok === false) return entitlements;
        }
        const subscription = mapCloudEntitlements(entitlements);
        sessionStore.save({ ...sessionStore.load(), entitlements });
        return {
          ok: true,
          consumed: rows.length,
          cloud: publicCloudState({ ...sessionStore.load(), entitlements }),
          subscription
        };
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
    entitlements: session && session.authenticated ? session.entitlements : null
  };
}

module.exports = {
  createCloudDesktopController,
  publicCloudState
};

