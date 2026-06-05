const path = require('node:path');

const SHORT_WHATSAPP_SESSION_DIR = 'aw';

function getWhatsAppSessionRoot(userDataPath, options = {}) {
  const localAppData = options.localAppData || process.env.LOCALAPPDATA || userDataPath;
  return path.join(localAppData, SHORT_WHATSAPP_SESSION_DIR);
}

function createShortWhatsAppClientId(accountId) {
  const normalized = String(accountId || '').replace(/^user[_-]/i, '');
  const compact = normalized.replace(/[^a-z0-9_-]/gi, '');
  const shortId = compact.slice(0, 8);
  if (!shortId) throw new Error('账号缺少可用的 WhatsApp clientId。');
  return shortId;
}

function createWhatsAppSessionConfig(userDataPath, user, options = {}) {
  if (!user || !user.accountId) throw new Error('账号缺少 accountId。');
  return {
    accountId: user.accountId,
    sessionPath: getWhatsAppSessionRoot(userDataPath, options),
    clientId: createShortWhatsAppClientId(user.accountId),
    proxyServer: options.proxyServer || null
  };
}

class WhatsAppSessionManager {
  constructor({ userDataPath, createService, proxyServer = null }) {
    if (!userDataPath) throw new Error('userDataPath is required.');
    if (!createService) throw new Error('createService is required.');
    this.userDataPath = userDataPath;
    this.createService = createService;
    this.proxyServer = proxyServer;
    this.activeAccountId = null;
    this.activeService = null;
  }

  async switchToAccount(user) {
    if (this.activeService && this.activeAccountId === user.accountId) {
      return this.activeService;
    }
    await this.destroy();
    const config = createWhatsAppSessionConfig(this.userDataPath, user, {
      proxyServer: this.proxyServer
    });
    this.activeAccountId = user.accountId;
    this.activeService = this.createService(config);
    return this.activeService;
  }

  getService() {
    return this.activeService;
  }

  setProxyServer(proxyServer) {
    this.proxyServer = proxyServer || null;
  }

  async forceResetActiveService() {
    if (this.activeService && typeof this.activeService.forceReset === 'function') {
      await this.activeService.forceReset();
    }
    this.activeService = null;
    this.activeAccountId = null;
  }

  async destroy() {
    if (this.activeService && typeof this.activeService.destroy === 'function') {
      await this.activeService.destroy();
    }
    this.activeService = null;
    this.activeAccountId = null;
  }
}

module.exports = {
  WhatsAppSessionManager,
  createWhatsAppSessionConfig,
  createShortWhatsAppClientId,
  getWhatsAppSessionRoot
};
