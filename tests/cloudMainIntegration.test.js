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
          amountCents: 150000,
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

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
