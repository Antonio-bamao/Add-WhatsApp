const { getPlan } = require('../core/billingPlans');
const { mapCloudEntitlements } = require('../core/cloudApiClient');
const crypto = require('node:crypto');

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

  function handleCloudError(error) {
    if (error && (error.status === 401 || error.message === 'UNAUTHORIZED')) {
      return clearExpiredSession(error);
    }
    throw error;
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
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    try {
      const entitlements = await client.getEntitlements(session.accessToken);
      const subscription = mapCloudEntitlements(entitlements);
      sessionStore.save({ ...session, entitlements });
      return {
        ok: true,
        cloud: publicCloudState({ ...session, entitlements }),
        subscription
      };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function consumeSuccessfulAdds({ taskId, sentRows = [], workspaceId = 'main', sentAt }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: true, skipped: true, authRequired: true };
    }
    const rows = Array.isArray(sentRows) ? sentRows : [];
    let entitlements = session.entitlements;
    try {
      for (const row of rows) {
        const rowKey = row && row.rowNumber ? row.rowNumber : rows.indexOf(row) + 1;
        const contactHash = hashContact(row && row.whatsappId ? row.whatsappId : `${taskId}:${rowKey}`);
        entitlements = await client.consumeCredit(session.accessToken, {
          idempotencyKey: `desktop-send:${taskId}:${rowKey}:${contactHash.slice(0, 16)}`,
          taskId,
          contactHash,
          workspaceId,
          sentAt
        });
      }
      const subscription = mapCloudEntitlements(entitlements);
      sessionStore.save({ ...session, entitlements });
      return {
        ok: true,
        consumed: rows.length,
        cloud: publicCloudState({ ...session, entitlements }),
        subscription
      };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function issueWorkspaceLease({ workspaceKind = 'secondary', processNonce }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: true, skipped: true, authRequired: true };
    }
    try {
      const lease = await client.issueWorkspaceLease(session.accessToken, {
        deviceId,
        workspaceKind,
        processNonce
      });
      return { ok: true, lease };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function renewWorkspaceLease({ leaseId }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: true, skipped: true, authRequired: true };
    }
    try {
      const lease = await client.renewWorkspaceLease(session.accessToken, leaseId);
      return { ok: true, lease };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function releaseWorkspaceLease({ leaseId }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: true, skipped: true, authRequired: true };
    }
    try {
      const lease = await client.releaseWorkspaceLease(session.accessToken, leaseId);
      return { ok: true, lease };
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
    const amountCents = credits * Number(plan.unitPriceCents || 0);
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要线上充值。' };
    }
    try {
      const order = await client.createOrder(session.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      });
      const payment = await client.createAlipayPagePay(session.accessToken, order.id);
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
    const amountCents = credits * Number(plan.unitPriceCents || 0);
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要线上充值。' };
    }
    try {
      const order = await client.createOrder(session.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      });
      const payment = await client.createZpayPagePay(session.accessToken, order.id);
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

  async function createWechatTopUp({ planId }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    const plan = getPlan(planId || session.entitlements?.planId || 'advanced');
    const credits = Number(plan.minimumTopUpCredits || 0);
    const amountCents = credits * Number(plan.unitPriceCents || 0);
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要线上充值。' };
    }
    try {
      const order = await client.createOrder(session.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      });
      let payment;
      try {
        payment = await client.createWechatNativePay(session.accessToken, order.id);
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
        throw paymentError;
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
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    try {
      const order = await client.getOrderStatus(session.accessToken, orderId);
      return { ok: true, order };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function listPaymentOrders() {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    try {
      const orders = await client.listOrders(session.accessToken);
      return { ok: true, ...orders };
    } catch (error) {
      return handleCloudError(error);
    }
  }

  async function closePaymentOrder({ orderId, reason = 'canceled' }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录账号。' };
    }
    try {
      const order = await client.closeOrder(session.accessToken, orderId, { reason });
      return { ok: true, order };
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
    const amountCents = credits * Number(plan.unitPriceCents || 0);
    if (!credits || !amountCents) {
      return { ok: false, error: '当前套餐不需要充值。' };
    }
    try {
      const order = await client.createOrder(session.accessToken, {
        planId: plan.id,
        credits,
        amountCents
      });
      const payment = await client.createManualPayment(session.accessToken, order.id);
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

