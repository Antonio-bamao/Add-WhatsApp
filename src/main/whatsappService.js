const path = require('node:path');
const fs = require('node:fs');
const { execFileSync, execSync } = require('node:child_process');
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');

const FALLBACK_CHROME_VERSION = '148.0.0.0';
const WHATSAPP_WEB_VERSION_REMOTE_PATH = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1037589879-alpha.html';
const LOCAL_AUTH_PREFIX = 'session-';
const GRACEFUL_BROWSER_CLOSE_TIMEOUT_MS = 10000;
const activeSessionGuards = new Map();

function bundledChromiumExecutableRelativePath(platform = process.platform) {
  if (platform === 'win32') return path.join('chrome-win64', 'chrome.exe');
  if (platform === 'darwin') return path.join('chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
  return path.join('chrome-linux64', 'chrome');
}

function resolveBundledChromiumExecutablePath(options = {}) {
  const platform = options.platform || process.platform;
  const fsExists = options.fsExists || fs.existsSync;
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..', '..');
  const resourcesPath = options.resourcesPath || process.resourcesPath || projectRoot;
  const relativePath = bundledChromiumExecutableRelativePath(platform);
  const packagedPath = path.join(resourcesPath, 'chromium', relativePath);

  if (options.isPackaged) {
    if (fsExists(packagedPath)) return packagedPath;
    throw new Error(`内置 Chromium 不存在：${packagedPath}。请重新安装或重新下载完整安装包。`);
  }

  const devBundledPath = path.join(projectRoot, 'build-resources', 'chromium', relativePath);
  if (fsExists(devBundledPath)) return devBundledPath;

  try {
    const puppeteerExecutablePath = options.puppeteerExecutablePath || (() => puppeteer.executablePath());
    const puppeteerPath = puppeteerExecutablePath();
    if (puppeteerPath && fsExists(puppeteerPath)) return puppeteerPath;
  } catch {
    // Fall through to the explicit error below.
  }

  throw new Error(`内置 Chromium 不存在：${devBundledPath}。请先执行 npm run prepare:browser 下载并准备浏览器内核。`);
}

function resolveChromeVersion(executablePath) {
  if (!executablePath) return FALLBACK_CHROME_VERSION;
  try {
    const output = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true
    });
    const match = output.match(/(\d+\.\d+\.\d+\.\d+)/);
    return match ? match[1] : FALLBACK_CHROME_VERSION;
  } catch {
    return FALLBACK_CHROME_VERSION;
  }
}

function buildChromeUserAgent(chromeVersion = FALLBACK_CHROME_VERSION) {
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

function buildWhatsAppClientOptions({
  sessionPath,
  clientId,
  browserWSEndpoint,
  chromeVersion = FALLBACK_CHROME_VERSION
}) {
  return {
    authStrategy: new LocalAuth({
      dataPath: sessionPath,
      clientId
    }),
    authTimeoutMs: 90000,
    userAgent: buildChromeUserAgent(chromeVersion),
    webVersionCache: {
      type: 'remote',
      remotePath: WHATSAPP_WEB_VERSION_REMOTE_PATH
    },
    puppeteer: {
      browserWSEndpoint
    }
  };
}

function buildWhatsAppBrowserLaunchOptions({
  sessionPath,
  clientId,
  proxyServer = null,
  executablePath = null
}) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-crash-reporter',
    '--no-crashpad',
    '--disable-breakpad',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1100,760'
  ];
  if (proxyServer) args.push(`--proxy-server=${proxyServer}`);

  return {
    headless: false,
    executablePath,
    ignoreDefaultArgs: ['--enable-automation'],
    userDataDir: getLocalAuthProfilePath(sessionPath, clientId),
    args
  };
}

function buildSessionGuardKey(sessionPath, clientId) {
  return `${path.resolve(sessionPath)}::${clientId}`;
}

function getLocalAuthProfilePath(sessionPath, clientId) {
  return path.join(sessionPath, `${LOCAL_AUTH_PREFIX}${clientId}`);
}

function getCorruptProfileDataPaths(sessionPath, clientId) {
  const defaultProfilePath = path.join(getLocalAuthProfilePath(sessionPath, clientId), 'Default');
  return [
    'IndexedDB',
    'Local Storage',
    'Session Storage',
    'Service Worker',
    'Cache'
  ].map(name => path.join(defaultProfilePath, name));
}

async function grantWhatsAppWebPermissions(browser) {
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.grantPermissions', {
    origin: 'https://web.whatsapp.com',
    permissions: ['durableStorage', 'notifications']
  });
}

function resetWhatsAppSessionGuardsForTests() {
  activeSessionGuards.clear();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timeoutId)),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

async function deleteFolderRobustly(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    return;
  }
  for (const file of files) {
    const curPath = path.join(dirPath, file);
    let stat;
    try {
      stat = fs.lstatSync(curPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      await deleteFolderRobustly(curPath);
      try {
        fs.rmdirSync(curPath);
      } catch { /* ignore */ }
    } else {
      try {
        fs.unlinkSync(curPath);
      } catch { /* ignore */ }
    }
  }
  try {
    fs.rmdirSync(dirPath);
  } catch { /* ignore */ }
}

async function deleteFolderRecursiveWithRetries(folderPath, retries = 8, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
      return true;
    } catch (err) {
      console.warn(`Attempt ${i + 1} to delete folder ${folderPath} failed: ${err.message}. Trying robust delete.`);
      try {
        await deleteFolderRobustly(folderPath);
        return true;
      } catch (robustErr) {
        console.warn(`Robust delete failed: ${robustErr.message}`);
      }
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
  return false;
}

function getLaunchedBrowserProcess(browser) {
  if (!browser || typeof browser.process !== 'function') return null;
  return browser.process();
}

async function waitForProcessExit(proc, timeoutMs) {
  if (!proc || proc.exitCode !== null || proc.killed) return true;
  if (typeof proc.once !== 'function') {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (proc.exitCode !== null || proc.killed) return true;
      await delay(100);
    }
    return proc.exitCode !== null || proc.killed;
  }

  return new Promise(resolve => {
    const cleanup = () => {
      clearTimeout(timeoutId);
      proc.off('exit', handleExit);
      proc.off('close', handleExit);
    };
    const handleExit = () => {
      cleanup();
      resolve(true);
    };
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(proc.exitCode !== null || proc.killed);
    }, timeoutMs);
    proc.once('exit', handleExit);
    proc.once('close', handleExit);
  });
}

function forceKillBrowserProcess(proc) {
  if (!proc || !proc.pid) return false;
  try {
    const pid = proc.pid;
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else if (typeof proc.kill === 'function') {
      proc.kill('SIGKILL');
    }
    return true;
  } catch (err) {
    console.warn(`Failed to kill browser process tree: ${err.message}`);
  }
  return false;
}

class WhatsAppService {
  constructor({ sessionPath, clientId = 'add-whatsapp', proxyServer = null, emit, puppeteerModule = puppeteer, ClientClass = Client, chromiumExecutablePath = null }) {
    this.sessionPath = sessionPath;
    this.clientId = clientId;
    this.proxyServer = proxyServer;
    this.emit = emit || (() => {});
    this.puppeteer = puppeteerModule;
    this.ClientClass = ClientClass;
    this.chromiumExecutablePath = chromiumExecutablePath;
    this.browser = null;
    this.browserProcess = null;
    this.externalBrowser = null;
    this.client = null;
    this.ready = false;
    this.initializing = null;
    this._cancelled = false;
    this.profileNeedsRepair = false;
    this.sessionGuardKey = buildSessionGuardKey(this.sessionPath, this.clientId);
  }

  acquireSessionGuard(client) {
    const active = activeSessionGuards.get(this.sessionGuardKey);
    if (active && active.owner !== this) {
      throw new Error(`WhatsApp LocalAuth profile ${this.sessionGuardKey} already has an active browser instance.`);
    }
    activeSessionGuards.set(this.sessionGuardKey, { owner: this, client });
  }

  releaseSessionGuard(client) {
    const active = activeSessionGuards.get(this.sessionGuardKey);
    if (!active || active.owner !== this) return;
    if (client && active.client && active.client !== client) return;
    activeSessionGuards.delete(this.sessionGuardKey);
  }

  async createClient() {
    if (this.client || this.browser) await this.closeBrowser();
    const executablePath = this.chromiumExecutablePath || resolveBundledChromiumExecutablePath();
    const chromeVersion = resolveChromeVersion(executablePath);
    // If GitHub main plus the pinned WA HTML both fail, next options are:
    // 1. try github:alechkos/whatsapp-web.js
    // 2. migrate the automation layer to WPPConnect/wa-js
    this.acquireSessionGuard(null);
    let browser;
    try {
      browser = await this.puppeteer.launch(buildWhatsAppBrowserLaunchOptions({
        sessionPath: this.sessionPath,
        clientId: this.clientId,
        proxyServer: this.proxyServer,
        executablePath
      }));
      this.browser = browser;
      this.externalBrowser = browser;
      this.browserProcess = getLaunchedBrowserProcess(browser);
      await grantWhatsAppWebPermissions(browser);
      const client = new this.ClientClass(buildWhatsAppClientOptions({
        sessionPath: this.sessionPath,
        clientId: this.clientId,
        browserWSEndpoint: browser.wsEndpoint(),
        chromeVersion
      }));
      this.acquireSessionGuard(client);
      this.client = client;
      this.attachClientEvents(this.client);
    } catch (error) {
      await this.closeBrowser();
      throw error;
    }
  }

  attachClientEvents(client) {
    client.on('qr', () => {
      this.emit({
        type: 'auth:qr',
        message: '请在弹出的 WhatsApp Web 浏览器窗口里扫码登录。'
      });
      this.closeBlankStartupPages();
    });

    client.on('authenticated', () => {
      this.emit({ type: 'auth:authenticated', message: 'WhatsApp 登录已保存。' });
    });

    client.on('ready', () => {
      this.ready = true;
      this.emit({ type: 'auth:ready', message: 'WhatsApp 已连接，可以开始任务。' });
      this.closeBlankStartupPages();
    });

    client.on('auth_failure', message => {
      this.ready = false;
      this.emit({ type: 'auth:failure', message: `WhatsApp 认证失败：${message}` });
    });

    client.on('disconnected', reason => {
      this.ready = false;
      this.emit({ type: 'auth:disconnected', message: `WhatsApp 已断开：${reason}` });
    });
  }

  async ensureReady() {
    if (this.ready && this.client) return this.client;
    if (this.initializing) {
      await this.initializing;
      return this.client;
    }

    this.initializing = this.ensureReadyWithRetry();

    try {
      await this.initializing;
      return this.client;
    } finally {
      this.initializing = null;
    }
  }

  async ensureReadyWithRetry() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (this._cancelled) throw new Error('WhatsApp 初始化已取消。');
      if (this.profileNeedsRepair) {
        await this.clearCorruptProfileData();
        this.profileNeedsRepair = false;
      }
      if (!this.client) await this.createClient();
      try {
        await this.waitForReady();
        return;
      } catch (error) {
        if (this._cancelled) throw new Error('WhatsApp 初始化已取消。');
        if (this.isDatabaseError(error) && attempt < 2) {
          this.emit({
            type: 'auth:database-error',
            message: 'WhatsApp 浏览器数据库损坏或被占用，正在关闭浏览器并清理本地数据库后重试...'
          });
          await this.resetCorruptProfileData();
          continue;
        }
        if (attempt < 2 && this.isStaleAuthError(error)) {
          this.emit({
            type: 'auth:stale-session',
            message: 'WhatsApp 登录已失效，正在自动清除缓存并重试...'
          });
          await this.resetStaleSession();
          continue;
        }
        await this.closeBrowser();
        throw error;
      }
    }
  }

  waitForReady() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let blankTicks = 0;
      let checkingDatabaseError = false;
      const timeout = setTimeout(() => {
        finish(reject, new Error('WhatsApp 登录超时，请确认浏览器窗口是否已扫码。'));
      }, 180000);

      // URL polling: detect post_logout error page and about:blank hangs proactively
      const urlCheckInterval = setInterval(() => {
        if (this._cancelled) {
          finish(reject, new Error('WhatsApp 初始化已取消。'));
          return;
        }
        try {
          const page = this.client && this.client.pupPage;
          if (!page) return;
          const url = page.url();
          if (!checkingDatabaseError) {
            checkingDatabaseError = true;
            this.detectDatabaseErrorPage(page)
              .then(hasDatabaseError => {
                if (hasDatabaseError) {
                  finish(reject, new Error('WhatsApp browser database error: Please relink your device.'));
                }
              })
              .catch(() => {})
              .finally(() => {
                checkingDatabaseError = false;
              });
          }
          if (/post_logout|logout_reason/.test(url)) {
            finish(reject, new Error('WhatsApp 登录已失效（检测到 post_logout 页面），请清除缓存后重新扫码。'));
            return;
          }
          if (url === 'about:blank') {
            blankTicks += 1;
            // 3 seconds per tick * 8 = 24 seconds
            if (blankTicks >= 8) {
              finish(reject, new Error('无法连接到 WhatsApp 服务器（浏览器停留在空白页）。请检查您的网络连接。若在中国大陆境内使用，必须开启全局系统 VPN / 代理软件。'));
              return;
            }
          } else {
            blankTicks = 0;
          }
        } catch { /* page may be closed, ignore */ }
      }, 3000);

      const cleanup = () => {
        clearTimeout(timeout);
        clearInterval(urlCheckInterval);
        if (!this.client) return;
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
        if (this.isDatabaseError(message)) {
          finish(reject, new Error(message));
          return;
        }
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
  }

  async detectDatabaseErrorPage(page) {
    if (!page || typeof page.evaluate !== 'function') return false;
    const text = await page.evaluate(() => document.body && document.body.innerText ? document.body.innerText : '');
    return this.isDatabaseError(text);
  }

  async closeBlankStartupPages() {
    try {
      const browser = this.browser || this.externalBrowser;
      if (!browser || typeof browser.pages !== 'function') return;
      const pages = await browser.pages();
      const blankPages = pages.filter(page => {
        try {
          return page && typeof page.url === 'function' && page.url() === 'about:blank';
        } catch {
          return false;
        }
      });
      const hasRealPage = pages.some(page => {
        try {
          return page && typeof page.url === 'function' && page.url() !== 'about:blank';
        } catch {
          return false;
        }
      });
      if (!hasRealPage) return;
      for (const page of blankPages) {
        try {
          await page.close();
        } catch (error) {
          console.warn(`Failed to close WhatsApp startup blank tab: ${error.message}`);
        }
      }
    } catch (error) {
      console.warn(`Failed to inspect WhatsApp browser pages: ${error.message}`);
    }
  }

  isStaleAuthError(error) {
    const message = String(error && error.message ? error.message : error);
    return /Execution context was destroyed|ProtocolError|auth timeout|post_logout|LOGOUT|登录已失效/i.test(message);
  }

  isDatabaseError(error) {
    const message = String(error && error.message ? error.message : error);
    return /database error occurred on your browser|Please relink your device|CacheStorage.*Unexpected internal error|IndexedDB|LevelDB/i.test(message);
  }

  async clearCorruptProfileData() {
    this.emit({
      type: 'auth:profile-repair',
      message: '正在清理 WhatsApp Web 浏览器本地数据库缓存，然后重新打开扫码窗口。'
    });
    const storePaths = getCorruptProfileDataPaths(this.sessionPath, this.clientId);
    for (const storePath of storePaths) {
      await fs.promises.rm(storePath, {
        recursive: true,
        force: true,
        maxRetries: 15,
        retryDelay: 300
      });
    }
  }

  async resetCorruptProfileData() {
    if (this.client) {
      const result = await this.closeBrowser();
      if (result && result.forced) this.profileNeedsRepair = true;
    }
    this.ready = false;
    await this.clearCorruptProfileData();
    this.profileNeedsRepair = false;
  }

  async resetStaleSession() {
    this.emit({
      type: 'auth:reset',
      message: 'WhatsApp 登录缓存已失效，正在清除缓存并重新打开扫码窗口。'
    });
    if (this.client) {
      const result = await this.closeBrowser();
      if (result && result.forced) this.profileNeedsRepair = true;
    }
    try {
      await deleteFolderRecursiveWithRetries(getLocalAuthProfilePath(this.sessionPath, this.clientId));
    } catch (err) {
      console.error(`resetStaleSession: Failed to delete session path: ${err.message}`);
    }
    this.ready = false;
  }

  /**
   * Force-reset the WhatsApp client: cancel any in-progress initialization,
   * kill the browser process, destroy the client, delete the active profile directory,
   * and reset all internal state so the next ensureReady() starts completely fresh.
   */
  async forceReset() {
    this._cancelled = true;

    // Wait for any in-progress initialization to finish (it should reject quickly
    // because _cancelled is checked, or URL polling will detect the situation).
    if (this.initializing) {
      try { await this.initializing; } catch { /* expected rejection */ }
    }

    if (this.client) {
      const result = await this.closeBrowser();
      if (result && result.forced) this.profileNeedsRepair = true;
    }

    // Delete only the active LocalAuth profile with retries.
    try {
      await deleteFolderRecursiveWithRetries(getLocalAuthProfilePath(this.sessionPath, this.clientId));
    } catch (err) {
      console.error(`forceReset: Failed to delete session path: ${err.message}`);
    }

    // Reset all state for a clean start
    this.client = null;
    this.ready = false;
    this.initializing = null;
    this._cancelled = false;
  }

  async closeBrowser() {
    const client = this.client;
    const browser = this.browser || this.externalBrowser;
    const proc = this.browserProcess;
    let forced = false;
    try {
      if (client && typeof client.destroy === 'function') {
        try {
          await withTimeout(
            client.destroy(),
            GRACEFUL_BROWSER_CLOSE_TIMEOUT_MS,
            'Timed out while gracefully closing WhatsApp browser.'
          );
        } catch (error) {
          const message = String(error && error.message ? error.message : error);
          if (/Timed out while gracefully closing WhatsApp browser/i.test(message)) {
            forced = forceKillBrowserProcess(proc);
          } else if (!/Target closed|Session closed|browser has disconnected|Browser has been closed/i.test(message)) {
            console.warn(`WhatsApp client destroy failed: ${message}`);
          }
        }
      }
      if (browser && typeof browser.close === 'function') {
        try {
          await withTimeout(
            browser.close(),
            GRACEFUL_BROWSER_CLOSE_TIMEOUT_MS,
            'Timed out while explicitly closing prelaunched WhatsApp browser.'
          );
        } catch (error) {
          const message = String(error && error.message ? error.message : error);
          if (/Timed out while explicitly closing prelaunched WhatsApp browser/i.test(message)) {
            forced = forceKillBrowserProcess(proc);
          } else if (!/Target closed|Session closed|browser has disconnected|Browser has been closed|Connection closed|Protocol error/i.test(message)) {
            console.warn(`WhatsApp browser close failed: ${message}`);
          }
        }
      }
      if (proc && !forced) {
        const exited = await waitForProcessExit(proc, GRACEFUL_BROWSER_CLOSE_TIMEOUT_MS);
        if (!exited) forced = forceKillBrowserProcess(proc);
      }
      if (forced) await waitForProcessExit(proc, 2000);
    } finally {
      this.releaseSessionGuard(client);
      this.client = null;
      this.browser = null;
      this.externalBrowser = null;
      this.browserProcess = null;
      this.ready = false;
    }
    return { forced };
  }

  async destroy() {
    if (!this.client && !this.browser) return;
    const result = await this.closeBrowser();
    if (result && result.forced) {
      this.profileNeedsRepair = true;
      await this.clearCorruptProfileData();
      this.profileNeedsRepair = false;
    }
  }
}

function createWhatsAppService(app, emit, config = {}) {
  const sessionPath = config.sessionPath || path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'aw');
  const clientId = config.clientId || 'add-whatsapp';
  const proxyServer = config.proxyServer || null;
  const chromiumExecutablePath = config.chromiumExecutablePath || resolveBundledChromiumExecutablePath({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath
  });
  return new WhatsAppService({ sessionPath, clientId, proxyServer, emit, chromiumExecutablePath });
}

module.exports = {
  WhatsAppService,
  createWhatsAppService,
  WHATSAPP_WEB_VERSION_REMOTE_PATH,
  bundledChromiumExecutableRelativePath,
  resolveBundledChromiumExecutablePath,
  buildChromeUserAgent,
  buildWhatsAppBrowserLaunchOptions,
  grantWhatsAppWebPermissions,
  buildWhatsAppClientOptions,
  getLocalAuthProfilePath,
  getCorruptProfileDataPaths,
  resetWhatsAppSessionGuardsForTests
};
