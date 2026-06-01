const { createEntitlementState } = require('./billingPlans');

const DEFAULT_API_BASE_URL = 'https://api.addwhatsapp.com';

class CloudApiClient {
  constructor({ baseUrl = DEFAULT_API_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = String(baseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
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
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload && payload.error ? payload.error : `CLOUD_API_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
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
    resetPolicy: '每日上限按服务器 Asia/Shanghai 业务日重置，未使用账户余额长期保留。'
  };
}

module.exports = {
  CloudApiClient,
  DEFAULT_API_BASE_URL,
  mapCloudEntitlements
};
