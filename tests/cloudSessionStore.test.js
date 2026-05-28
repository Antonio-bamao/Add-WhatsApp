const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CloudSessionStore } = require('../src/core/cloudSessionStore');

test('saves and loads cloud session tokens without storing passwords', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-session-'));
  const sessionPath = path.join(dir, 'cloud-session.json');
  const store = new CloudSessionStore(sessionPath);

  store.save({
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { planId: 'advanced' }
  });

  const raw = fs.readFileSync(sessionPath, 'utf8');
  assert.match(raw, /access-1/);
  assert.doesNotMatch(raw, /StrongPass123|password/i);

  assert.deepEqual(store.load(), {
    authenticated: true,
    user: { id: 'user-1', username: 'cloud-user' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    entitlements: { planId: 'advanced' }
  });
});

test('returns an unauthenticated state when cloud session data is missing or corrupted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cloud-session-bad-'));
  const sessionPath = path.join(dir, 'cloud-session.json');
  const store = new CloudSessionStore(sessionPath);

  assert.equal(store.load().authenticated, false);
  fs.writeFileSync(sessionPath, '{bad json');
  assert.equal(store.load().authenticated, false);
});
