const path = require('node:path');
const { Client, LocalAuth } = require('whatsapp-web.js');

function chromeCandidates() {
  return [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
}

class WhatsAppService {
  constructor({ sessionPath, clientId = 'add-whatsapp', proxyServer = null, emit }) {
    this.sessionPath = sessionPath;
    this.clientId = clientId;
    this.proxyServer = proxyServer;
    this.emit = emit || (() => {});
    this.client = null;
    this.ready = false;
    this.initializing = null;
  }

  createClient() {
    const executablePath = chromeCandidates().find(candidate => require('node:fs').existsSync(candidate));
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1100,760'];
    if (this.proxyServer) args.push(`--proxy-server=${this.proxyServer}`);
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: this.sessionPath,
        clientId: this.clientId
      }),
      puppeteer: {
        headless: false,
        executablePath,
        args
      }
    });

    this.client.on('qr', () => {
      this.emit({
        type: 'auth:qr',
        message: '请在弹出的 WhatsApp Web 浏览器窗口里扫码登录。'
      });
    });

    this.client.on('authenticated', () => {
      this.emit({ type: 'auth:authenticated', message: 'WhatsApp 登录已保存。' });
    });

    this.client.on('ready', () => {
      this.ready = true;
      this.emit({ type: 'auth:ready', message: 'WhatsApp 已连接，可以开始任务。' });
    });

    this.client.on('auth_failure', message => {
      this.ready = false;
      this.emit({ type: 'auth:failure', message: `WhatsApp 认证失败：${message}` });
    });

    this.client.on('disconnected', reason => {
      this.ready = false;
      this.emit({ type: 'auth:disconnected', message: `WhatsApp 已断开：${reason}` });
    });
  }

  async ensureReady() {
    if (this.ready && this.client) return this.client;
    if (!this.client) this.createClient();
    if (this.initializing) {
      await this.initializing;
      return this.client;
    }

    this.initializing = new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        finish(reject, new Error('WhatsApp 登录超时，请确认浏览器窗口是否已扫码。'));
      }, 180000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.client.off('ready', handleReady);
        this.client.off('auth_failure', handleFailure);
        this.client.off('disconnected', handleDisconnected);
      };

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };

      const handleReady = () => {
        finish(resolve);
      };

      const handleFailure = message => {
        finish(reject, new Error(`WhatsApp 认证失败：${message}`));
      };

      const handleDisconnected = reason => {
        const detail = reason ? `（${reason}）` : '';
        finish(reject, new Error(`WhatsApp 登录已失效${detail}，请清除 WhatsApp 登录缓存后重新扫码。`));
      };

      const handleInitializeError = error => {
        const message = String(error && error.message ? error.message : error);
        if (/Execution context was destroyed|auth timeout|post_logout|LOGOUT/i.test(message)) {
          finish(reject, new Error('WhatsApp 登录已失效，请清除 WhatsApp 登录缓存后重新扫码。'));
          return;
        }
        finish(reject, error instanceof Error ? error : new Error(message));
      };

      this.client.once('ready', handleReady);
      this.client.once('auth_failure', handleFailure);
      this.client.once('disconnected', handleDisconnected);

      try {
        const result = this.client.initialize();
        if (result && typeof result.catch === 'function') {
          result.catch(handleInitializeError);
        }
      } catch (error) {
        handleInitializeError(error);
      }
    });

    try {
      await this.initializing;
      return this.client;
    } finally {
      this.initializing = null;
    }
  }

  async destroy() {
    if (!this.client) return;
    await this.client.destroy();
    this.client = null;
    this.ready = false;
  }
}

function createWhatsAppService(app, emit, config = {}) {
  const sessionPath = config.sessionPath || path.join(app.getPath('userData'), 'whatsapp-session');
  const clientId = config.clientId || 'add-whatsapp';
  const proxyServer = config.proxyServer || null;
  return new WhatsAppService({ sessionPath, clientId, proxyServer, emit });
}

module.exports = {
  WhatsAppService,
  createWhatsAppService,
  chromeCandidates
};
