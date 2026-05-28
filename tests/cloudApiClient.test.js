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

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
