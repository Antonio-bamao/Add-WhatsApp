const { createEntitlementState, planCatalog } = require('./billingPlans');

const DEFAULT_API_BASE_URL = 'https://api.addwhatsapp.com';

class CloudApiClient {
  constructor({ baseUrl = DEFAULT_API_BASE_URL, fetchImpl = globalThis.fetch, requestTimeoutMs = 12000, paymentRequestTimeoutMs = 30000, contactImportRequestTimeoutMs = 60000 } = {}) {
    this.baseUrl = String(baseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.requestTimeoutMs = Math.max(Number(requestTimeoutMs) || 12000, 1);
    this.paymentRequestTimeoutMs = Math.max(Number(paymentRequestTimeoutMs) || 30000, this.requestTimeoutMs);
    this.contactImportRequestTimeoutMs = Math.max(Number(contactImportRequestTimeoutMs) || 60000, this.requestTimeoutMs);
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('当前运行环境不支持云端 API 请求。');
    }
  }

  async login({ username, password, deviceId }) {
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: { username, password, deviceId }
    });
  }

  async register({ username, password, deviceId, planId = 'advanced' }) {
    return this.request('/v1/auth/register', {
      method: 'POST',
      body: { username, password, deviceId, planId }
    });
  }

  async refreshSession({ refreshToken, deviceId }) {
    return this.request('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken, deviceId }
    });
  }

  async getEntitlements(accessToken) {
    return this.request('/v1/me/entitlements', {
      headers: { authorization: `Bearer ${accessToken}` }
    });
  }

  async consumeCredit(accessToken, payload) {
    return this.request('/v1/credits/consume', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: payload
    });
  }

  async createContactImport(accessToken, payload) {
    return this.request('/v1/contact-imports', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: payload,
      timeoutMs: this.contactImportRequestTimeoutMs
    });
  }

  async createOrder(accessToken, payload) {
    return this.request('/v1/orders', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: payload
    });
  }

  async createAlipayPagePay(accessToken, orderId) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}/payments/alipay/page-pay`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: {}
    });
  }

  async createZpayPagePay(accessToken, orderId) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}/payments/zpay/page-pay`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: {}
    });
  }

  async createWechatNativePay(accessToken, orderId) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}/payments/wechat/native-pay`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: {},
      timeoutMs: this.paymentRequestTimeoutMs
    });
  }

  async getOrderStatus(accessToken, orderId) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
  }

  async listOrders(accessToken, { limit = 20, offset = 0 } = {}) {
    const normalizedLimit = Number(limit);
    const normalizedOffset = Number(offset);
    const query = normalizedLimit === 20 && normalizedOffset === 0
      ? ''
      : `?${new URLSearchParams({ limit: String(limit), offset: String(offset) }).toString()}`;
    return this.request(`/v1/orders${query}`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
  }

  async closeOrder(accessToken, orderId, { reason = 'canceled' } = {}) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}/close`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: { reason }
    });
  }

  async createManualPayment(accessToken, orderId) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}/payments/manual`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: {}
    });
  }

  async issueWorkspaceLease(accessToken, payload) {
    return this.request('/v1/workspaces/leases', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: payload
    });
  }

  async renewWorkspaceLease(accessToken, leaseId) {
    return this.request(`/v1/workspaces/leases/${encodeURIComponent(leaseId)}/renew`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` }
    });
  }

  async releaseWorkspaceLease(accessToken, leaseId) {
    return this.request(`/v1/workspaces/leases/${encodeURIComponent(leaseId)}/release`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` }
    });
  }

  async request(path, options = {}) {
    const headers = {
      'content-type': 'application/json',
      ...(options.headers || {})
    };
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutMs = Math.max(Number(options.timeoutMs) || this.requestTimeoutMs, 1);
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller ? controller.signal : undefined
      });
      const rawText = await response.text();
      let parsed = null;
      if (rawText) {
        try { parsed = JSON.parse(rawText); } catch { parsed = null; }
      }
      if (!response.ok) {
        const serverMsg = parsed && parsed.error ? parsed.error : null;
        const snippet = rawText ? rawText.replace(/\s+/g, ' ').slice(0, 200) : '';
        const error = new Error(serverMsg || `CLOUD_API_${response.status}${snippet ? `: ${snippet}` : ''}`);
        error.status = response.status;
        if (parsed && parsed.cause) error.cause = parsed.cause;
        throw error;
      }
      return parsed ?? {};
    } catch (error) {
      if (error && error.name === 'AbortError') {
        const timeoutError = new Error('CLOUD_API_TIMEOUT');
        timeoutError.status = 504;
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function mapCloudEntitlements(payload = {}) {
  const entitlement = createEntitlementState(payload.planId, {
    balanceCredits: payload.balanceCredits,
    usedToday: payload.usedToday,
    usedThisMonth: payload.usedThisMonth,
    nextResetAt: payload.resetAt
  });
  return {
    ...entitlement,
    cloudUserId: payload.userId,
    availableNow: Number.isFinite(Number(payload.availableToday)) ? Number(payload.availableToday) : entitlement.availableNow,
    nextResetAt: payload.resetAt || entitlement.nextResetAt,
    catalog: planCatalog(),
    resetPolicy: '每日上限按服务器 Asia/Shanghai 业务日重置，未使用账户余额长期保留。'
  };
}

module.exports = {
  CloudApiClient,
  DEFAULT_API_BASE_URL,
  mapCloudEntitlements
};
