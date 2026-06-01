const test = require('node:test');
const assert = require('node:assert/strict');

const { CloudApiClient, mapCloudEntitlements } = require('../src/core/cloudApiClient');

test('logs in to the cloud API and fetches entitlements with bearer auth', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith('/v1/auth/login')) {
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(options.body), {
          username: 'cloud-user',
          password: 'StrongPass123',
          deviceId: 'desktop-1'
        });
        return response(200, {
          user: { id: 'user-1', username: 'cloud-user', status: 'active' },
          accessToken: 'access-1',
          refreshToken: 'refresh-1'
        });
      }
      if (url.endsWith('/v1/me/entitlements')) {
        assert.equal(options.headers.authorization, 'Bearer access-1');
        return response(200, {
          planId: 'professional',
          balanceCredits: 420,
          usedToday: 120,
          usedThisMonth: 730,
          availableToday: 380,
          resetAt: '2026-05-29T00:00:00+08:00'
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }
  });

  const login = await client.login({ username: 'cloud-user', password: 'StrongPass123', deviceId: 'desktop-1' });
  const entitlement = await client.getEntitlements(login.accessToken);

  assert.equal(login.user.username, 'cloud-user');
  assert.equal(entitlement.planId, 'professional');
  assert.equal(requests.length, 2);
});

test('registers a database account and returns the issued cloud session', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:4110/v1/auth/register');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), {
        username: 'new-user',
        password: 'StrongPass123',
        deviceId: 'desktop-1',
        planId: 'advanced'
      });
      return response(201, {
        user: { id: 'user-new', username: 'new-user', status: 'active' },
        accessToken: 'access-new',
        refreshToken: 'refresh-new'
      });
    }
  });

  const registered = await client.register({
    username: 'new-user',
    password: 'StrongPass123',
    deviceId: 'desktop-1',
    planId: 'advanced'
  });

  assert.equal(registered.user.id, 'user-new');
  assert.equal(registered.accessToken, 'access-new');
  assert.equal(registered.refreshToken, 'refresh-new');
});

test('maps cloud entitlements into desktop subscription state shape', () => {
  const mapped = mapCloudEntitlements({
    planId: 'business',
    balanceCredits: 999,
    usedToday: 12,
    usedThisMonth: 80,
    resetAt: '2026-05-29T00:00:00+08:00'
  });

  assert.equal(mapped.plan.id, 'business');
  assert.equal(mapped.balanceCredits, 999);
  assert.equal(mapped.usedToday, 12);
  assert.equal(mapped.availableNow, 988);
  assert.equal(mapped.nextResetAt, '2026-05-29T00:00:00+08:00');
  assert.match(mapped.resetPolicy, /服务器 Asia\/Shanghai/);
});

test('issues workspace leases with bearer auth', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:4110/v1/workspaces/leases');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.authorization, 'Bearer access-1');
      assert.deepEqual(JSON.parse(options.body), {
        deviceId: 'desktop-1',
        workspaceKind: 'secondary',
        processNonce: 'workspace-1'
      });
      return response(200, {
        leaseId: 'lease-1',
        expiresAt: '2026-05-28T12:01:00.000Z',
        activeCount: 2,
        workspaceLimit: 3
      });
    }
  });

  const lease = await client.issueWorkspaceLease('access-1', {
    deviceId: 'desktop-1',
    workspaceKind: 'secondary',
    processNonce: 'workspace-1'
  });

  assert.equal(lease.leaseId, 'lease-1');
  assert.equal(lease.activeCount, 2);
});

test('renews and releases workspace leases with bearer auth', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/workspaces/leases/lease-1/renew')) {
        return response(200, { leaseId: 'lease-1', status: 'active', expiresAt: '2026-05-28T12:02:00.000Z' });
      }
      if (url.endsWith('/v1/workspaces/leases/lease-1/release')) {
        return response(200, { leaseId: 'lease-1', status: 'released', releasedAt: '2026-05-28T12:01:10.000Z' });
      }
      throw new Error(`unexpected url: ${url}`);
    }
  });

  const renewed = await client.renewWorkspaceLease('access-1', 'lease-1');
  const released = await client.releaseWorkspaceLease('access-1', 'lease-1');

  assert.equal(renewed.status, 'active');
  assert.equal(released.status, 'released');
  assert.equal(requests.length, 2);
});

test('creates a cloud order and requests an Alipay page-pay link with bearer auth', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(options.body), {
          planId: 'professional',
          credits: 5000,
          amountCents: 150000
        });
        return response(201, {
          id: 'order-1',
          orderNo: '202606010001',
          planId: 'professional',
          credits: 5000,
          amountCents: 150000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-1/payments/alipay/page-pay')) {
        assert.equal(options.method, 'POST');
        return response(200, {
          provider: 'alipay',
          orderId: 'order-1',
          orderNo: '202606010001',
          paymentUrl: 'https://openapi.alipay.com/gateway.do?sign=abc',
          paymentHtml: '<form></form>'
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }
  });

  const order = await client.createOrder('access-1', {
    planId: 'professional',
    credits: 5000,
    amountCents: 150000
  });
  const payment = await client.createAlipayPagePay('access-1', order.id);

  assert.equal(order.orderNo, '202606010001');
  assert.equal(payment.provider, 'alipay');
  assert.equal(payment.paymentUrl, 'https://openapi.alipay.com/gateway.do?sign=abc');
  assert.deepEqual(requests.map(item => item.url), [
    'http://127.0.0.1:4110/v1/orders',
    'http://127.0.0.1:4110/v1/orders/order-1/payments/alipay/page-pay'
  ]);
});

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
