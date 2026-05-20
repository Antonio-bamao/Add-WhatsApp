const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { AuthStore } = require('../src/core/authStore');

function createStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-auth-'));
  return {
    dir,
    store: new AuthStore({
      usersPath: path.join(dir, 'users.json'),
      sessionPath: path.join(dir, 'session.json'),
      now: () => new Date('2026-05-20T12:00:00.000Z')
    })
  };
}

test('registers an account without storing password or recovery code in plaintext', () => {
  const { dir, store } = createStore();

  const result = store.register({ username: 'Alice', password: 'Secure123' });

  assert.equal(result.user.username, 'Alice');
  assert.match(result.recoveryCode, /^[A-Z0-9-]{19}$/);

  const raw = fs.readFileSync(path.join(dir, 'users.json'), 'utf-8');
  assert.doesNotMatch(raw, /Secure123/);
  assert.doesNotMatch(raw, new RegExp(result.recoveryCode.replaceAll('-', '\\-')));
  assert.match(raw, /passwordHash/);
  assert.match(raw, /recoveryHash/);
});

test('logs in with the correct password and rejects wrong passwords', () => {
  const { store } = createStore();
  const registered = store.register({ username: 'Alice', password: 'Secure123' });

  assert.equal(store.login({ username: 'alice', password: 'bad-password' }).ok, false);

  const loggedIn = store.login({ username: 'alice', password: 'Secure123' });
  assert.equal(loggedIn.ok, true);
  assert.equal(loggedIn.user.accountId, registered.user.accountId);
});

test('rejects duplicate usernames and weak passwords', () => {
  const { store } = createStore();

  store.register({ username: 'Alice', password: 'Secure123' });

  assert.throws(
    () => store.register({ username: ' alice ', password: 'Secure123' }),
    /账号已存在/
  );
  assert.throws(
    () => store.register({ username: 'Bob', password: 'short' }),
    /密码至少/
  );
});

test('creates and expires a seven day local session', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-session-'));
  let now = new Date('2026-05-20T12:00:00.000Z');
  const store = new AuthStore({
    usersPath: path.join(dir, 'users.json'),
    sessionPath: path.join(dir, 'session.json'),
    now: () => now
  });
  const { user } = store.register({ username: 'Alice', password: 'Secure123' });

  store.createSession(user.accountId, 7);
  assert.equal(store.getSessionUser().authenticated, true);

  now = new Date('2026-05-28T12:00:01.000Z');
  assert.equal(store.getSessionUser().authenticated, false);
});

test('resets a password with the recovery code and rotates recovery code', () => {
  const { store } = createStore();
  const registered = store.register({ username: 'Alice', password: 'Secure123' });

  const reset = store.resetPassword({
    username: 'Alice',
    recoveryCode: registered.recoveryCode,
    newPassword: 'NewSecure123'
  });

  assert.notEqual(reset.recoveryCode, registered.recoveryCode);
  assert.equal(store.login({ username: 'Alice', password: 'Secure123' }).ok, false);
  assert.equal(store.login({ username: 'Alice', password: 'NewSecure123' }).ok, true);
  assert.throws(
    () => store.resetPassword({
      username: 'Alice',
      recoveryCode: registered.recoveryCode,
      newPassword: 'Another123'
    }),
    /恢复码不正确/
  );
});

test('does not authenticate when the users file is corrupted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-corrupt-auth-'));
  const usersPath = path.join(dir, 'users.json');
  fs.writeFileSync(usersPath, '{bad json');
  const store = new AuthStore({
    usersPath,
    sessionPath: path.join(dir, 'session.json')
  });

  assert.throws(() => store.listUsers(), /认证数据异常/);
  assert.equal(store.getSessionUser().authenticated, false);
});
