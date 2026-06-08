const test = require('node:test');
const assert = require('node:assert/strict');

const { CloudApiClient, DEFAULT_API_BASE_URL, mapCloudEntitlements } = require('../src/core/cloudApiClient');

test('uses the production API domain by default for packaged desktop clients', () => {
  assert.equal(DEFAULT_API_BASE_URL, 'https://api.addwhatsapp.com');
});

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

test('fetches the signed app policy with bearer auth', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:4110/v1/app-policy');
      assert.equal(options.headers.authorization, 'Bearer access-1');
      return response(200, {
        billing: {
          mode: 'free_access',
          version: 3,
          effectiveAt: null,
          fetchedAt: '2026-06-08T12:00:00.000Z',
          cacheExpiresAt: '2026-06-09T12:00:00.000Z',
          keyId: 'billing-policy-2026-01',
          signature: 'signed-policy'
        },
        minimumBillingClientVersion: '0.1.6'
      });
    }
  });

  const policy = await client.getAppPolicy('access-1');

  assert.equal(policy.billing.mode, 'free_access');
  assert.equal(policy.billing.version, 3);
  assert.equal(policy.minimumBillingClientVersion, '0.1.6');
});

test('creates and closes task billing sessions with bearer auth', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url === 'http://127.0.0.1:4110/v1/task-billing-sessions') {
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.authorization, 'Bearer access-1');
        assert.deepEqual(JSON.parse(options.body), {
          taskId: 'task-1',
          workspaceId: 'main',
          clientVersion: '0.1.6',
          deviceId: 'desktop-1'
        });
        return response(201, { sessionId: 'billing-session-1', mode: 'free_access', status: 'active' });
      }
      if (url === 'http://127.0.0.1:4110/v1/task-billing-sessions/billing-session-1/close') {
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.authorization, 'Bearer access-1');
        return response(200, { sessionId: 'billing-session-1', status: 'closed' });
      }
      throw new Error(`unexpected ${url}`);
    }
  });

  const session = await client.createTaskBillingSession('access-1', {
    taskId: 'task-1',
    workspaceId: 'main',
    clientVersion: '0.1.6',
    deviceId: 'desktop-1'
  });
  const closed = await client.closeTaskBillingSession('access-1', 'billing-session-1');

  assert.equal(session.sessionId, 'billing-session-1');
  assert.equal(closed.status, 'closed');
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

test('refreshes a cloud session with the saved refresh token', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:4110/v1/auth/refresh');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), {
        refreshToken: 'refresh-1',
        deviceId: 'desktop-1'
      });
      return response(200, {
        user: { id: 'user-1', username: 'cloud-user', status: 'active' },
        accessToken: 'access-2',
        refreshToken: 'refresh-2'
      });
    }
  });

  const refreshed = await client.refreshSession({ refreshToken: 'refresh-1', deviceId: 'desktop-1' });

  assert.equal(refreshed.user.username, 'cloud-user');
  assert.equal(refreshed.accessToken, 'access-2');
  assert.equal(refreshed.refreshToken, 'refresh-2');
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

test('maps free access policy into effective desktop capabilities without replacing stored plan', () => {
  const mapped = mapCloudEntitlements({
    userId: 'user-free',
    planId: 'free',
    balanceCredits: 0,
    usedToday: 999,
    usedThisMonth: 2000,
    availableToday: 0,
    billingPolicy: { mode: 'free_access', version: 5 },
    billingMode: 'free_access',
    unlimitedDailyUsage: true,
    hideBillingNavigation: true,
    effectiveWorkspaceLimit: 5,
    effectiveTemplateLimit: null,
    effectiveCapabilities: {
      exportPreview: true,
      secondaryWorkspace: true,
      proxySettings: true,
      customTemplates: true
    }
  });

  assert.equal(mapped.plan.id, 'free');
  assert.equal(mapped.billingMode, 'free_access');
  assert.equal(mapped.hideBillingNavigation, true);
  assert.equal(mapped.unlimitedDailyUsage, true);
  assert.equal(mapped.effectiveWorkspaceLimit, 5);
  assert.equal(mapped.effectiveTemplateLimit, null);
  assert.equal(mapped.effectiveCapabilities.exportPreview, true);
  assert.equal(mapped.effectiveCapabilities.secondaryWorkspace, true);
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

test('uploads contact import audit records with original and parsed artifacts', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:4110/v1/contact-imports');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.authorization, 'Bearer access-1');
      assert.deepEqual(JSON.parse(options.body), {
        originalFileName: 'customers.xlsx',
        originalFormat: 'xlsx',
        originalMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        originalSizeBytes: 12,
        originalSha256: 'sha256-raw-file',
        originalBase64: 'cmF3LWNvbnRlbnQ=',
        columns: { phoneColumn: 'phone', countryColumn: 'country', languageColumn: 'language' },
        stats: { total: 1, valid: 1, invalid: 0 },
        importOptions: { skipChinaNumbers: true },
        parsedRows: [
          {
            rowNumber: 2,
            status: 'valid',
            e164: '+15551234567',
            countryIso: 'US',
            language: 'en',
            source: { phone: '5551234567', country: 'US' }
          }
        ]
      });
      return response(201, {
        id: 'import-1',
        originalFileName: 'customers.xlsx',
        originalFormat: 'xlsx',
        parsedRowCount: 1
      });
    }
  });

  const created = await client.createContactImport('access-1', {
    originalFileName: 'customers.xlsx',
    originalFormat: 'xlsx',
    originalMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    originalSizeBytes: 12,
    originalSha256: 'sha256-raw-file',
    originalBase64: 'cmF3LWNvbnRlbnQ=',
    columns: { phoneColumn: 'phone', countryColumn: 'country', languageColumn: 'language' },
    stats: { total: 1, valid: 1, invalid: 0 },
    importOptions: { skipChinaNumbers: true },
    parsedRows: [
      {
        rowNumber: 2,
        status: 'valid',
        e164: '+15551234567',
        countryIso: 'US',
        language: 'en',
        source: { phone: '5551234567', country: 'US' }
      }
    ]
  });

  assert.equal(created.id, 'import-1');
  assert.equal(created.parsedRowCount, 1);
});

test('uses an extended timeout for large contact import audit uploads', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    requestTimeoutMs: 5,
    contactImportRequestTimeoutMs: 35,
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:4110/v1/contact-imports');
      assert.equal(options.headers.authorization, 'Bearer access-1');
      assert.equal(options.method, 'POST');
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(response(201, { id: 'import-slow', parsedRowCount: 16630 })), 20);
        options.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }
  });

  const created = await client.createContactImport('access-1', {
    originalFileName: 'large.xlsx',
    originalFormat: 'xlsx',
    originalMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    originalSizeBytes: 12,
    originalSha256: 'sha256-raw-file',
    originalBase64: 'cmF3LWNvbnRlbnQ=',
    parsedRowsGzipBase64: 'gzip-base64'
  });

  assert.equal(created.parsedRowCount, 16630);
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

test('creates a cloud order and requests manual payment instructions with bearer auth', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        assert.equal(options.method, 'POST');
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
        assert.equal(options.method, 'POST');
        return response(200, {
          provider: 'manual',
          orderId: 'order-manual-1',
          orderNo: '202606020001',
          amountCents: 80000,
          paymentNote: 'ADWA-202606020001',
          alipayQrImageUrl: 'https://addwhatsapp.com/pay/alipay.png'
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }
  });

  const order = await client.createOrder('access-1', {
    planId: 'advanced',
    credits: 2000,
    amountCents: 80000
  });
  const payment = await client.createManualPayment('access-1', order.id);

  assert.equal(payment.provider, 'manual');
  assert.equal(payment.paymentNote, 'ADWA-202606020001');
  assert.deepEqual(requests.map(item => item.url), [
    'http://127.0.0.1:4110/v1/orders',
    'http://127.0.0.1:4110/v1/orders/order-manual-1/payments/manual'
  ]);
});

test('creates a cloud order and requests a ZPAY page-pay link with bearer auth', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders')) {
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(options.body), {
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000
        });
        return response(201, {
          id: 'order-zpay-1',
          orderNo: '2026060213340001',
          planId: 'advanced',
          credits: 2000,
          amountCents: 80000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-zpay-1/payments/zpay/page-pay')) {
        assert.equal(options.method, 'POST');
        return response(200, {
          provider: 'zpay',
          orderId: 'order-zpay-1',
          orderNo: '2026060213340001',
          amountCents: 80000,
          paymentUrl: 'https://zpayz.cn/submit.php?pid=2026060213344566'
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }
  });

  const order = await client.createOrder('access-1', {
    planId: 'advanced',
    credits: 2000,
    amountCents: 80000
  });
  const payment = await client.createZpayPagePay('access-1', order.id);

  assert.equal(payment.provider, 'zpay');
  assert.equal(payment.paymentUrl, 'https://zpayz.cn/submit.php?pid=2026060213344566');
  assert.deepEqual(requests.map(item => item.url), [
    'http://127.0.0.1:4110/v1/orders',
    'http://127.0.0.1:4110/v1/orders/order-zpay-1/payments/zpay/page-pay'
  ]);
});

test('creates a cloud order and requests a WeChat Native pay code url with bearer auth', async () => {
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
          id: 'order-wechat-1',
          orderNo: '202606030001',
          planId: 'professional',
          credits: 5000,
          amountCents: 150000,
          status: 'created'
        });
      }
      if (url.endsWith('/v1/orders/order-wechat-1/payments/wechat/native-pay')) {
        assert.equal(options.method, 'POST');
        return response(200, {
          provider: 'wechat',
          orderId: 'order-wechat-1',
          orderNo: '202606030001',
          amountCents: 150000,
          paymentUrl: 'weixin://wxpay/bizpayurl?pr=test-token',
          codeUrl: 'weixin://wxpay/bizpayurl?pr=test-token'
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
  const payment = await client.createWechatNativePay('access-1', order.id);

  assert.equal(payment.provider, 'wechat');
  assert.equal(payment.codeUrl, 'weixin://wxpay/bizpayurl?pr=test-token');
  assert.deepEqual(requests.map(item => item.url), [
    'http://127.0.0.1:4110/v1/orders',
    'http://127.0.0.1:4110/v1/orders/order-wechat-1/payments/wechat/native-pay'
  ]);
});

test('uses an extended timeout for slow WeChat Native pay code generation', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    requestTimeoutMs: 5,
    paymentRequestTimeoutMs: 35,
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:4110/v1/orders/order-slow/payments/wechat/native-pay');
      assert.equal(options.headers.authorization, 'Bearer access-1');
      assert.equal(options.method, 'POST');
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }
  });
  const startedAt = Date.now();

  await assert.rejects(
    () => client.createWechatNativePay('access-1', 'order-slow'),
    /CLOUD_API_TIMEOUT/
  );

  assert.ok(Date.now() - startedAt >= 25);
});


test('reads and closes a cloud payment order with bearer auth', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110/',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
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
      throw new Error(`unexpected url: ${url}`);
    }
  });

  const status = await client.getOrderStatus('access-1', 'order-wechat-1');
  const closed = await client.closeOrder('access-1', 'order-wechat-1', { reason: 'canceled' });

  assert.equal(status.expiresAt, '2026-06-03T07:25:00.000Z');
  assert.equal(closed.status, 'canceled');
  assert.deepEqual(requests.map(item => item.url), [
    'http://127.0.0.1:4110/v1/orders/order-wechat-1',
    'http://127.0.0.1:4110/v1/orders/order-wechat-1/close'
  ]);
});

test('lists billing orders and times out stuck cloud API requests', async () => {
  const requests = [];
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110/',
    requestTimeoutMs: 25,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      assert.equal(options.headers.authorization, 'Bearer access-1');
      if (url.endsWith('/v1/orders') && options.method === 'GET') {
        return response(200, {
          items: [
            { orderNo: '202606030001', status: 'canceled', amountCents: 150000, closedAt: '2026-06-03T07:21:00.000Z' }
          ],
          total: 1
        });
      }
      if (url.endsWith('/v1/orders/order-stuck/close')) {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }
  });

  const history = await client.listOrders('access-1');
  await assert.rejects(
    () => client.closeOrder('access-1', 'order-stuck', { reason: 'canceled' }),
    /CLOUD_API_TIMEOUT/
  );

  assert.equal(history.items[0].status, 'canceled');
  assert.deepEqual(requests.map(item => item.url), [
    'http://127.0.0.1:4110/v1/orders',
    'http://127.0.0.1:4110/v1/orders/order-stuck/close'
  ]);
});

test('preserves HTTP status when cloud API returns an HTML error page', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async () => textResponse(413, '<html><body>Payload Too Large</body></html>', 'text/html')
  });

  await assert.rejects(
    () => client.createContactImport('access-1', { originalFileName: 'large.xlsx' }),
    (error) => {
      assert.equal(error.status, 413);
      assert.match(error.message, /CLOUD_API_413/);
      assert.match(error.message, /Payload Too Large/);
      assert.doesNotMatch(error.message, /Unexpected token/);
      return true;
    }
  );
});

test('parses JSON error responses after checking HTTP status', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async () => textResponse(401, JSON.stringify({ error: 'AUTH_REQUIRED', cause: 'missing_token' }))
  });

  await assert.rejects(
    () => client.getEntitlements('expired-token'),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.message, 'AUTH_REQUIRED');
      assert.equal(error.cause, 'missing_token');
      return true;
    }
  );
});

test('handles successful non-JSON cloud API responses safely', async () => {
  const client = new CloudApiClient({
    baseUrl: 'http://127.0.0.1:4110',
    fetchImpl: async () => textResponse(204, '', 'text/plain')
  });

  const payload = await client.request('/v1/no-content');

  assert.deepEqual(payload, {});
});

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      }
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

function textResponse(status, body, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : null;
      }
    },
    async json() {
      return JSON.parse(body);
    },
    async text() {
      return body;
    }
  };
}
