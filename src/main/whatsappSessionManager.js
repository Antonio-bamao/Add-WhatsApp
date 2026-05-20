const path = require('node:path');

function createWhatsAppSessionConfig(userDataPath, user, options = {}) {
  if (!user || !user.accountId) throw new Error('账号缺少 accountId。');
  return {
    accountId: user.accountId,
    sessionPath: path.join(userDataPath, 'accounts', user.accountId, 'whatsapp-session'),
    clientId: `add-whatsapp-${user.accountId}`,
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
  createWhatsAppSessionConfig
};
