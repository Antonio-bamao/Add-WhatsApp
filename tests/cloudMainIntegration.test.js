const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CloudApiClient } = require('../src/core/cloudApiClient');
const { CloudSessionStore } = require('../src/core/cloudSessionStore');

test('cloud login saves session and maps entitlements for the desktop subscription state', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-flow-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/v1/auth/login')) {
        return response(200, {
          user: { id: 'user-1', username: 'cloud-user' },
          accessToken: 'access-1',
          refreshToken: 'refresh-1'
        });
      }
      if (url.endsWith('/v1/me/entitlements')) {
        assert.equal(options.headers.authorization, 'Bearer access-1');
        return response(200, {
          userId: 'user-1',
          planId: 'advanced',
          balanceCredits: 2000,
          usedToday: 7,
          usedThisMonth: 70,
          availableToday: 193,
          resetAt: '2026-05-29T00:00:00+08:00'
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });

  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });
  const result = await controller.login({ username: 'cloud-user', password: 'StrongPass123' });

  assert.equal(result.ok, true);
  assert.equal(result.cloud.authenticated, true);
  assert.equal(result.subscription.plan.id, 'advanced');
  assert.equal(result.subscription.availableNow, 193);
  assert.equal(sessionStore.load().accessToken, 'access-1');
});

test('cloud register creates the database account and saves it as the desktop session', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-register-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/v1/auth/register')) {
        assert.deepEqual(JSON.parse(options.body), {
          username: 'new-user',
          password: 'StrongPass123',
          deviceId: 'desktop-1',
          planId: 'advanced'
        });
        return response(201, {
          user: { id: 'user-new', username: 'new-user' },
          accessToken: 'access-new',
          refreshToken: 'refresh-new'
        });
      }
      if (url.endsWith('/v1/me/entitlements')) {
        assert.equal(options.headers.authorization, 'Bearer access-new');
        return response(200, {
          userId: 'user-new',
          planId: 'advanced',
          balanceCredits: 2000,
          usedToday: 0,
          usedThisMonth: 0,
          availableToday: 200
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });

  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });
  const result = await controller.register({ username: 'new-user', password: 'StrongPass123' });

  assert.equal(result.ok, true);
  assert.equal(result.cloud.user.id, 'user-new');
  assert.equal(result.subscription.plan.id, 'advanced');
  assert.equal(sessionStore.load().user.username, 'new-user');
  assert.equal(sessionStore.load().accessToken, 'access-new');
});

test('cloud controller reports auth-required when refreshing without a token', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-empty-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({
    sessionStore,
    client: new CloudApiClient({ baseUrl: 'http://api.test', fetchImpl: async () => response(500, {}) })
  });

  const result = await controller.refreshEntitlements();

  assert.equal(result.ok, false);
  assert.equal(result.authRequired, true);
});

test('cloud controller consumes one credit per successful desktop send only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-consume-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 2000, usedToday: 0, usedThisMonth: 0 }
  });
  const consumed = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/v1/credits/consume')) {
        assert.equal(options.headers.authorization, 'Bearer access-1');
        consumed.push(JSON.parse(options.body));
        return response(200, {
          userId: 'user-1',
          planId: 'advanced',
          balanceCredits: 2000 - consumed.length,
          usedToday: consumed.length,
          usedThisMonth: consumed.length,
          availableToday: 200 - consumed.length
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.consumeSuccessfulAdds({
    taskId: 'task-1',
    workspaceId: 'main',
    sentAt: '2026-05-28T12:00:00.000Z',
    sentRows: [
      { rowNumber: 1, whatsappId: '111@c.us' },
      { rowNumber: 2, whatsappId: '222@c.us' }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(consumed.length, 2);
  assert.equal(consumed[0].taskId, 'task-1');
  assert.match(consumed[0].idempotencyKey, /^desktop-send:task-1:1:/);
  assert.notEqual(consumed[0].contactHash, consumed[1].contactHash);
  assert.equal(result.subscription.usedToday, 2);
});

test('cloud controller issues workspace leases when a cloud session exists', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-lease-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'professional', balanceCredits: 2000 }
  });
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://api.test/v1/workspaces/leases');
      assert.equal(options.headers.authorization, 'Bearer access-1');
      assert.deepEqual(JSON.parse(options.body), {
        deviceId: 'desktop-1',
        workspaceKind: 'secondary',
        processNonce: 'workspace-20260528-a1b2c3d4'
      });
      return response(200, {
        leaseId: 'lease-1',
        expiresAt: '2026-05-28T12:01:00.000Z',
        activeCount: 2,
        workspaceLimit: 3
      });
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.issueWorkspaceLease({
    workspaceKind: 'secondary',
    processNonce: 'workspace-20260528-a1b2c3d4'
  });

  assert.equal(result.ok, true);
  assert.equal(result.lease.leaseId, 'lease-1');
  assert.equal(result.lease.workspaceLimit, 3);
});

test('cloud controller skips workspace leases without a cloud session', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-lease-empty-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({
    sessionStore,
    client: new CloudApiClient({ baseUrl: 'http://api.test', fetchImpl: async () => response(500, {}) })
  });

  const result = await controller.issueWorkspaceLease({
    workspaceKind: 'secondary',
    processNonce: 'workspace-1'
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.authRequired, true);
});

test('cloud controller renews and releases workspace leases', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-lease-cycle-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'professional', balanceCredits: 2000 }
  });
  const paths = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      assert.equal(options.headers.authorization, 'Bearer access-1');
      paths.push(url);
      if (url.endsWith('/v1/workspaces/leases/lease-1/renew')) {
        return response(200, { leaseId: 'lease-1', status: 'active', expiresAt: '2026-05-28T12:02:00.000Z' });
      }
      if (url.endsWith('/v1/workspaces/leases/lease-1/release')) {
        return response(200, { leaseId: 'lease-1', status: 'released', releasedAt: '2026-05-28T12:01:10.000Z' });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const renewed = await controller.renewWorkspaceLease({ leaseId: 'lease-1' });
  const released = await controller.releaseWorkspaceLease({ leaseId: 'lease-1' });

  assert.equal(renewed.ok, true);
  assert.equal(renewed.lease.status, 'active');
  assert.equal(released.lease.status, 'released');
  assert.deepEqual(paths, [
    'http://api.test/v1/workspaces/leases/lease-1/renew',
    'http://api.test/v1/workspaces/leases/lease-1/release'
  ]);
});

test('cloud controller creates an Alipay top-up payment for the selected package', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-pay-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 2000 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
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
          amountCents: 150,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-1/payments/alipay/page-pay')) {
        return response(200, {
          provider: 'alipay',
          orderId: 'order-1',
          orderNo: '202606010001',
          paymentUrl: 'https://openapi.alipay.com/gateway.do?sign=abc'
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createAlipayTopUp({ planId: 'professional' });

  assert.equal(result.ok, true);
  assert.equal(result.order.orderNo, '202606010001');
  assert.equal(result.payment.paymentUrl, 'https://openapi.alipay.com/gateway.do?sign=abc');
  assert.deepEqual(calls.map(call => call.url), [
    'http://api.test/v1/orders',
    'http://api.test/v1/orders/order-1/payments/alipay/page-pay'
  ]);
});

test('cloud controller creates a ZPAY top-up payment for the selected package', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-zpay-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        assert.deepEqual(JSON.parse(options.body), {
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000
        });
        return response(201, {
          id: 'order-zpay-1',
          orderNo: '202606020002',
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-zpay-1/payments/zpay/page-pay')) {
        return response(200, {
          provider: 'zpay',
          orderId: 'order-zpay-1',
          orderNo: '202606020002',
          amountCents: 80000,
          paymentUrl: 'https://zpayz.cn/submit.php?pid=2026060213344566'
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createZpayTopUp({ planId: 'advanced' });

  assert.equal(result.ok, true);
  assert.equal(result.order.orderNo, '202606020002');
  assert.equal(result.payment.provider, 'zpay');
  assert.equal(result.payment.paymentUrl, 'https://zpayz.cn/submit.php?pid=2026060213344566');
  assert.deepEqual(calls.map(call => call.url), [
    'http://api.test/v1/orders',
    'http://api.test/v1/orders/order-zpay-1/payments/zpay/page-pay'
  ]);
});

test('cloud controller creates a WeChat Native top-up payment for the selected package', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-wechat-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        assert.deepEqual(JSON.parse(options.body), {
          planId: 'professional',
          credits: 5000,
          amountCents: 150000
        });
        return response(201, {
          id: 'order-wechat-1',
          orderNo: '202606030001',
          planId: 'professional',
          credits: 5000,
          amountCents: 150000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-wechat-1/payments/wechat/native-pay')) {
        return response(200, {
          provider: 'wechat',
          orderId: 'order-wechat-1',
          orderNo: '202606030001',
          amountCents: 150000,
          paymentUrl: 'weixin://wxpay/bizpayurl?pr=test-token',
          codeUrl: 'weixin://wxpay/bizpayurl?pr=test-token'
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createWechatTopUp({ planId: 'professional' });

  assert.equal(result.ok, true);
  assert.equal(result.order.orderNo, '202606030001');
  assert.equal(result.payment.provider, 'wechat');
  assert.equal(result.payment.codeUrl, 'weixin://wxpay/bizpayurl?pr=test-token');
  assert.deepEqual(calls.map(call => call.url), [
    'http://api.test/v1/orders',
    'http://api.test/v1/orders/order-wechat-1/payments/wechat/native-pay'
  ]);
});

test('cloud controller creates quota top-ups with current plan pricing and rejects lower package purchases', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-quota-wechat-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'business', balanceCredits: 5000 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        assert.deepEqual(JSON.parse(options.body), {
          planId: 'business',
          credits: 2000,
          amountCents: 40000
        });
        return response(201, {
          id: 'order-wechat-quota-1',
          orderNo: '202606030004',
          planId: 'business',
          credits: 2000,
          amountCents: 40000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-wechat-quota-1/payments/wechat/native-pay')) {
        return response(200, {
          provider: 'wechat',
          orderId: 'order-wechat-quota-1',
          orderNo: '202606030004',
          amountCents: 40000,
          codeUrl: 'weixin://wxpay/bizpayurl?pr=quota-token'
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const rejected = await controller.createWechatTopUp({ planId: 'professional' });
  const quota = await controller.createWechatTopUp({ planId: 'business', credits: 2000 });

  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /低于当前套餐/);
  assert.equal(quota.ok, true);
  assert.equal(quota.plan.id, 'business');
  assert.equal(quota.plan.credits, 2000);
  assert.equal(quota.plan.amountCents, 40000);
  assert.deepEqual(calls.map(call => call.url), [
    'http://api.test/v1/orders',
    'http://api.test/v1/orders/order-wechat-quota-1/payments/wechat/native-pay'
  ]);
});

test('cloud controller reads and cancels active payment orders', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-order-close-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders/order-wechat-1') && options.method === 'GET') {
        return response(200, {
          id: 'order-wechat-1',
          orderNo: '202606030001',
          status: 'created',
          expiresAt: '2026-06-03T07:25:00.000Z'
        });
      }
      if (url.endsWith('/v1/orders/order-wechat-1/close')) {
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(options.body), { reason: 'canceled' });
        return response(200, {
          id: 'order-wechat-1',
          orderNo: '202606030001',
          status: 'canceled',
          closedAt: '2026-06-03T07:21:00.000Z'
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const status = await controller.getPaymentOrderStatus({ orderId: 'order-wechat-1' });
  const closed = await controller.closePaymentOrder({ orderId: 'order-wechat-1', reason: 'canceled' });

  assert.equal(status.ok, true);
  assert.equal(status.order.expiresAt, '2026-06-03T07:25:00.000Z');
  assert.equal(closed.ok, true);
  assert.equal(closed.order.status, 'canceled');
  assert.deepEqual(calls.map(call => call.url), [
    'http://api.test/v1/orders/order-wechat-1',
    'http://api.test/v1/orders/order-wechat-1/close'
  ]);
});

test('cloud controller reports a deployment hint when the WeChat Native payment route is missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-wechat-missing-route-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        return response(201, {
          id: 'order-wechat-missing-route',
          orderNo: '202606030003',
          planId: 'business',
          credits: 20000,
          amountCents: 400000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-wechat-missing-route/payments/wechat/native-pay')) {
        return response(404, { error: 'NOT_FOUND' });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createWechatTopUp({ planId: 'business' });

  assert.equal(result.ok, false);
  assert.equal(result.error, '线上 API 还没有部署微信支付接口，请先更新服务器后再生成微信支付订单。');
  assert.equal(result.serverError, 'NOT_FOUND');
  assert.equal(result.paymentProvider, 'wechat');
  assert.equal(result.order.orderNo, '202606030003');
});

test('cloud controller clears expired cloud session when WeChat payment order creation is unauthorized', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-wechat-expired-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'expired-access',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      assert.equal(options.headers.authorization, 'Bearer expired-access');
      if (url.endsWith('/v1/orders')) {
        return response(401, { error: 'UNAUTHORIZED' });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createWechatTopUp({ planId: 'advanced' });

  assert.equal(result.ok, false);
  assert.equal(result.authRequired, true);
  assert.equal(result.error, 'UNAUTHORIZED');
  assert.equal(sessionStore.load().authenticated, false);
});

test('cloud controller refreshes an expired session and retries WeChat payment creation once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-wechat-refresh-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'expired-access',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, authorization: options.headers && options.headers.authorization });
      if (url.endsWith('/v1/orders') && options.headers.authorization === 'Bearer expired-access') {
        return response(401, { error: 'UNAUTHORIZED' });
      }
      if (url.endsWith('/v1/auth/refresh')) {
        assert.deepEqual(JSON.parse(options.body), {
          refreshToken: 'refresh-1',
          deviceId: 'desktop-1'
        });
        return response(200, {
          user: { id: 'user-1', username: 'cloud-user' },
          accessToken: 'access-2',
          refreshToken: 'refresh-2'
        });
      }
      if (url.endsWith('/v1/orders') && options.headers.authorization === 'Bearer access-2') {
        return response(201, {
          id: 'order-wechat-refresh',
          orderNo: '202606030099',
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-wechat-refresh/payments/wechat/native-pay')) {
        assert.equal(options.headers.authorization, 'Bearer access-2');
        return response(200, {
          provider: 'wechat',
          orderId: 'order-wechat-refresh',
          orderNo: '202606030099',
          paymentUrl: 'weixin://wxpay/bizpayurl?pr=refresh-token',
          codeUrl: 'weixin://wxpay/bizpayurl?pr=refresh-token',
          amountCents: 80000
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createWechatTopUp({ planId: 'advanced' });

  assert.equal(result.ok, true);
  assert.equal(result.order.orderNo, '202606030099');
  assert.equal(result.payment.codeUrl, 'weixin://wxpay/bizpayurl?pr=refresh-token');
  assert.equal(sessionStore.load().accessToken, 'access-2');
  assert.equal(sessionStore.load().refreshToken, 'refresh-2');
  assert.deepEqual(calls.map(call => call.authorization || 'none'), [
    'Bearer expired-access',
    'none',
    'Bearer access-2',
    'Bearer access-2'
  ]);
});

test('cloud controller clears expired cloud session when ZPAY cashier creation is unauthorized', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-zpay-expired-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'expired-access',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push(url);
      assert.equal(options.headers.authorization, 'Bearer expired-access');
      if (url.endsWith('/v1/orders')) {
        return response(201, {
          id: 'order-zpay-expired',
          orderNo: '202606030002',
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-zpay-expired/payments/zpay/page-pay')) {
        return response(401, { error: 'UNAUTHORIZED' });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createZpayTopUp({ planId: 'advanced' });

  assert.equal(result.ok, false);
  assert.equal(result.authRequired, true);
  assert.equal(result.error, 'UNAUTHORIZED');
  assert.deepEqual(calls, [
    'http://api.test/v1/orders',
    'http://api.test/v1/orders/order-zpay-expired/payments/zpay/page-pay',
    'http://api.test/v1/auth/refresh'
  ]);
  assert.equal(sessionStore.load().authenticated, false);
});

test('cloud controller requires a cloud session before creating WeChat payments', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-wechat-empty-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({
    sessionStore,
    client: new CloudApiClient({ baseUrl: 'http://api.test', fetchImpl: async () => response(500, {}) })
  });

  const result = await controller.createWechatTopUp({ planId: 'advanced' });

  assert.equal(result.ok, false);
  assert.equal(result.authRequired, true);
});

test('cloud controller creates a manual top-up order and payment instructions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-manual-pay-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  sessionStore.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { userId: 'user-1', planId: 'advanced', balanceCredits: 0 }
  });
  const calls = [];
  const client = new CloudApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        assert.deepEqual(JSON.parse(options.body), {
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000
        });
        return response(201, {
          id: 'order-manual-1',
          orderNo: '202606020001',
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-manual-1/payments/manual')) {
        return response(200, {
          provider: 'manual',
          orderId: 'order-manual-1',
          orderNo: '202606020001',
          amountCents: 80000,
          paymentNote: 'ADWA-202606020001',
          alipayQrImageUrl: 'https://addwhatsapp.com/pay/alipay.png'
        });
      }
      throw new Error(`unexpected ${url}`);
    }
  });
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({ client, sessionStore, deviceId: 'desktop-1' });

  const result = await controller.createManualTopUp({ planId: 'advanced' });

  assert.equal(result.ok, true);
  assert.equal(result.order.orderNo, '202606020001');
  assert.equal(result.payment.paymentNote, 'ADWA-202606020001');
  assert.deepEqual(calls.map(call => call.url), [
    'http://api.test/v1/orders',
    'http://api.test/v1/orders/order-manual-1/payments/manual'
  ]);
});

test('cloud controller requires a cloud session before creating manual payments', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-manual-pay-empty-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({
    sessionStore,
    client: new CloudApiClient({ baseUrl: 'http://api.test', fetchImpl: async () => response(500, {}) })
  });

  const result = await controller.createManualTopUp({ planId: 'advanced' });

  assert.equal(result.ok, false);
  assert.equal(result.authRequired, true);
});

test('cloud controller requires a cloud session before creating Alipay payments', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-pay-empty-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({
    sessionStore,
    client: new CloudApiClient({ baseUrl: 'http://api.test', fetchImpl: async () => response(500, {}) })
  });

  const result = await controller.createAlipayTopUp({ planId: 'advanced' });

  assert.equal(result.ok, false);
  assert.equal(result.authRequired, true);
});

test('cloud controller requires a cloud session before creating ZPAY payments', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-zpay-empty-'));
  const sessionStore = new CloudSessionStore(path.join(dir, 'cloud-session.json'));
  const { createCloudDesktopController } = require('../src/main/cloudDesktopController');
  const controller = createCloudDesktopController({
    sessionStore,
    client: new CloudApiClient({ baseUrl: 'http://api.test', fetchImpl: async () => response(500, {}) })
  });

  const result = await controller.createZpayTopUp({ planId: 'advanced' });

  assert.equal(result.ok, false);
  assert.equal(result.authRequired, true);
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
