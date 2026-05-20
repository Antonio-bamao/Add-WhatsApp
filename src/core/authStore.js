const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const AUTH_VERSION = 1;
const SESSION_VERSION = 1;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const USERNAME_RULE = /^[A-Za-z0-9._-]{3,32}$/;

function defaultAuthData() {
  return {
    version: AUTH_VERSION,
    users: []
  };
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function publicUser(user) {
  if (!user) return null;
  return {
    accountId: user.accountId,
    username: user.username,
    usernameKey: user.usernameKey,
    createdAt: user.createdAt,
    recoveryDownloadedAt: user.recoveryDownloadedAt || null
  };
}

function validateUsername(username) {
  const trimmed = String(username || '').trim();
  if (!USERNAME_RULE.test(trimmed)) {
    throw new Error('账号需为 3-32 位，只能包含字母、数字、点、下划线或横线。');
  }
  return trimmed;
}

function validatePassword(password) {
  if (!PASSWORD_RULE.test(String(password || ''))) {
    throw new Error('密码至少 8 位，并且需要同时包含字母和数字。');
  }
}

function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = [];
  for (let index = 0; index < 16; index += 1) {
    chars.push(alphabet[crypto.randomInt(0, alphabet.length)]);
  }
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12).join('')}`;
}

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  const [scheme, salt, hash] = String(stored || '').split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(secret), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

class AuthStore {
  constructor({ usersPath, sessionPath, now = () => new Date() } = {}) {
    if (!usersPath) throw new Error('usersPath is required.');
    if (!sessionPath) throw new Error('sessionPath is required.');
    this.usersPath = usersPath;
    this.sessionPath = sessionPath;
    this.now = now;
  }

  listUsers() {
    return this.loadAuthData().users.map(publicUser);
  }

  register({ username, password }) {
    const cleanUsername = validateUsername(username);
    validatePassword(password);

    const data = this.loadAuthData();
    const usernameKey = normalizeUsername(cleanUsername);
    if (data.users.some(user => user.usernameKey === usernameKey)) {
      throw new Error('账号已存在。');
    }

    const recoveryCode = generateRecoveryCode();
    const user = {
      accountId: `acc_${crypto.randomUUID().replaceAll('-', '')}`,
      username: cleanUsername,
      usernameKey,
      passwordHash: hashSecret(password),
      recoveryHash: hashSecret(recoveryCode),
      createdAt: this.now().toISOString(),
      recoveryDownloadedAt: null,
      failedLoginCount: 0,
      lockedUntil: null
    };

    data.users.push(user);
    this.saveAuthData(data);
    return {
      user: publicUser(user),
      recoveryCode
    };
  }

  login({ username, password }) {
    const data = this.loadAuthData();
    const user = data.users.find(item => item.usernameKey === normalizeUsername(username));
    if (!user) return { ok: false, error: '账号或密码不正确。' };

    if (user.lockedUntil && new Date(user.lockedUntil) > this.now()) {
      return { ok: false, error: '登录失败次数过多，请稍后再试。' };
    }

    if (!verifySecret(password, user.passwordHash)) {
      user.failedLoginCount = Number(user.failedLoginCount || 0) + 1;
      if (user.failedLoginCount >= 5) {
        user.lockedUntil = new Date(this.now().getTime() + 5 * 60 * 1000).toISOString();
      }
      this.saveAuthData(data);
      return { ok: false, error: '账号或密码不正确。' };
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    this.saveAuthData(data);
    return { ok: true, user: publicUser(user) };
  }

  createSession(accountId, days = 7) {
    const data = this.loadAuthData();
    const user = data.users.find(item => item.accountId === accountId);
    if (!user) throw new Error('账号不存在。');

    const session = {
      version: SESSION_VERSION,
      accountId,
      createdAt: this.now().toISOString(),
      expiresAt: new Date(this.now().getTime() + Number(days) * 24 * 60 * 60 * 1000).toISOString(),
      token: crypto.randomBytes(24).toString('hex')
    };
    fs.mkdirSync(path.dirname(this.sessionPath), { recursive: true });
    fs.writeFileSync(this.sessionPath, JSON.stringify(session, null, 2));
    return session;
  }

  getSessionUser() {
    try {
      const session = JSON.parse(fs.readFileSync(this.sessionPath, 'utf-8'));
      if (!session || session.version !== SESSION_VERSION || !session.accountId) {
        return { authenticated: false, user: null };
      }
      if (!session.expiresAt || new Date(session.expiresAt) <= this.now()) {
        return { authenticated: false, user: null };
      }

      const data = this.loadAuthData();
      const user = data.users.find(item => item.accountId === session.accountId);
      return user
        ? { authenticated: true, user: publicUser(user), expiresAt: session.expiresAt }
        : { authenticated: false, user: null };
    } catch {
      return { authenticated: false, user: null };
    }
  }

  logout() {
    try {
      fs.unlinkSync(this.sessionPath);
    } catch {
      // Missing sessions are already logged out.
    }
  }

  resetPassword({ username, recoveryCode, newPassword }) {
    validatePassword(newPassword);
    const data = this.loadAuthData();
    const user = data.users.find(item => item.usernameKey === normalizeUsername(username));
    if (!user || !verifySecret(recoveryCode, user.recoveryHash)) {
      throw new Error('恢复码不正确。');
    }

    const nextRecoveryCode = generateRecoveryCode();
    user.passwordHash = hashSecret(newPassword);
    user.recoveryHash = hashSecret(nextRecoveryCode);
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    this.saveAuthData(data);
    return {
      user: publicUser(user),
      recoveryCode: nextRecoveryCode
    };
  }

  markRecoveryDownloaded(accountId) {
    const data = this.loadAuthData();
    const user = data.users.find(item => item.accountId === accountId);
    if (!user) throw new Error('账号不存在。');
    user.recoveryDownloadedAt = this.now().toISOString();
    this.saveAuthData(data);
    return publicUser(user);
  }

  loadAuthData() {
    if (!fs.existsSync(this.usersPath)) return defaultAuthData();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.usersPath, 'utf-8'));
      if (!parsed || !Array.isArray(parsed.users)) throw new Error('Invalid auth data');
      return {
        version: AUTH_VERSION,
        users: parsed.users
      };
    } catch {
      throw new Error('认证数据异常，无法安全登录。');
    }
  }

  saveAuthData(data) {
    fs.mkdirSync(path.dirname(this.usersPath), { recursive: true });
    fs.writeFileSync(this.usersPath, JSON.stringify({
      version: AUTH_VERSION,
      users: data.users
    }, null, 2));
  }
}

module.exports = {
  AuthStore,
  generateRecoveryCode,
  hashSecret,
  normalizeUsername,
  publicUser,
  verifySecret
};
