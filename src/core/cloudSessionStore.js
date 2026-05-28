const fs = require('node:fs');
const path = require('node:path');

class CloudSessionStore {
  constructor(sessionPath) {
    this.sessionPath = sessionPath;
  }

  load() {
    try {
      if (!fs.existsSync(this.sessionPath)) return unauthenticated();
      const parsed = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      if (!parsed || !parsed.user || !parsed.accessToken) return unauthenticated();
      return {
        authenticated: true,
        user: parsed.user,
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken || null,
        entitlements: parsed.entitlements || null
      };
    } catch {
      return unauthenticated();
    }
  }

  save(session) {
    fs.mkdirSync(path.dirname(this.sessionPath), { recursive: true });
    const payload = {
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken || null,
      entitlements: session.entitlements || null,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(this.sessionPath, JSON.stringify(payload, null, 2));
  }

  clear() {
    try {
      fs.rmSync(this.sessionPath, { force: true });
    } catch {
      // Nothing to clear.
    }
  }
}

function unauthenticated() {
  return {
    authenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    entitlements: null
  };
}

module.exports = {
  CloudSessionStore
};
