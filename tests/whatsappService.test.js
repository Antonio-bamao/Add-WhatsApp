const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  WhatsAppService,
  WHATSAPP_WEB_VERSION_REMOTE_PATH,
  buildWhatsAppBrowserLaunchOptions,
  resolveBundledChromiumExecutablePath,
  bundledChromiumExecutableRelativePath,
  grantWhatsAppWebPermissions,
  buildWhatsAppClientOptions,
  getLocalAuthProfilePath,
  resetWhatsAppSessionGuardsForTests
} = require('../src/main/whatsappService');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createFakeClient(initialize) {
  const client = new EventEmitter();
  client.initialize = () => initialize(client);
  client.destroyed = false;
  client.destroy = async () => {
    client.destroyed = true;
  };
  return client;
}

class FakeWhatsAppService extends WhatsAppService {
  constructor(options, clients) {
    super(options);
    this.clients = [...clients];
    this.created = [];
  }

  createClient() {
    const nextClient = this.clients[0];
    this.acquireSessionGuard(nextClient);
    this.client = this.clients.shift();
    this.attachClientEvents(this.client);
    this.created.push(this.client);
  }
}

test('ensureReady resets stale WhatsApp auth and retries to QR after logout during initialization', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-stale-session-'));
  const staleProfile = getLocalAuthProfilePath(sessionPath, 'add-whatsapp');
  fs.mkdirSync(staleProfile, { recursive: true });
  fs.writeFileSync(path.join(staleProfile, 'stale.txt'), 'old-login');
  const events = [];
  const staleClient = createFakeClient(client => {
    setImmediate(() => client.emit('disconnected', 'LOGOUT'));
  });
  const freshClient = createFakeClient(client => {
    setImmediate(() => {
      client.emit('qr');
      client.emit('ready');
    });
  });

  const service = new FakeWhatsAppService({
    sessionPath,
    emit: event => events.push(event)
  }, [staleClient, freshClient]);

  const readyPromise = service.ensureReady().then(
      () => 'resolved',
      error => error
    );
  const result = await Promise.race([
    readyPromise,
    delay(50).then(() => 'pending')
  ]);

  assert.equal(result, 'resolved');
  assert.equal(staleClient.destroyed, true);
  assert.equal(fs.existsSync(path.join(staleProfile, 'stale.txt')), false);
  assert.equal(service.created.length, 2);
  assert.deepEqual(events.map(event => event.type), ['auth:disconnected', 'auth:stale-session', 'auth:reset', 'auth:qr', 'auth:ready']);
  await service.destroy();
  resetWhatsAppSessionGuardsForTests();
});

test('stale auth reset deletes only the active LocalAuth profile', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-stale-profile-scope-'));
  const activeClientId = 'active123';
  const otherClientId = 'other456';
  const activeProfile = getLocalAuthProfilePath(sessionPath, activeClientId);
  const otherProfile = getLocalAuthProfilePath(sessionPath, otherClientId);
  fs.mkdirSync(activeProfile, { recursive: true });
  fs.mkdirSync(otherProfile, { recursive: true });
  fs.writeFileSync(path.join(activeProfile, 'stale.txt'), 'old-login');
  fs.writeFileSync(path.join(otherProfile, 'keep.txt'), 'other-login');

  const staleClient = createFakeClient(client => {
    setImmediate(() => client.emit('disconnected', 'LOGOUT'));
  });
  const freshClient = createFakeClient(client => {
    setImmediate(() => client.emit('ready'));
  });
  const service = new FakeWhatsAppService({
    sessionPath,
    clientId: activeClientId,
    emit: () => {}
  }, [staleClient, freshClient]);

  await service.ensureReady();

  assert.equal(fs.existsSync(path.join(activeProfile, 'stale.txt')), false);
  assert.equal(fs.existsSync(path.join(otherProfile, 'keep.txt')), true);
  assert.equal(fs.existsSync(sessionPath), true);
  await service.destroy();
  resetWhatsAppSessionGuardsForTests();
});

test('ensureReady does not clear auth for non-stale startup failures', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-network-error-'));
  fs.writeFileSync(path.join(sessionPath, 'keep.txt'), 'saved-login');
  const failingClient = createFakeClient(() => {
    throw new Error('Proxy connection refused');
  });

  const service = new FakeWhatsAppService({
    sessionPath,
    emit: () => {}
  }, [failingClient]);

  await assert.rejects(
    () => service.ensureReady(),
    /Proxy connection refused/
  );
  assert.equal(fs.existsSync(path.join(sessionPath, 'keep.txt')), true);
  assert.equal(service.created.length, 1);
  await service.destroy();
  resetWhatsAppSessionGuardsForTests();
});

test('buildWhatsAppClientOptions keeps WhatsApp Web compatibility and browser stealth settings', () => {
  const sessionPath = path.join(os.tmpdir(), 'add-whatsapp-session');
  const clientId = 'add-whatsapp-account-1';
  const executablePath = 'C:\\Program Files\\Add WhatsApp\\resources\\chromium\\chrome-win64\\chrome.exe';
  const launchOptions = buildWhatsAppBrowserLaunchOptions({
    sessionPath,
    clientId,
    proxyServer: 'socks5://127.0.0.1:1080',
    executablePath
  });
  const options = buildWhatsAppClientOptions({
    sessionPath,
    clientId,
    browserWSEndpoint: 'ws://127.0.0.1/devtools/browser/test',
    chromeVersion: '148.0.0.0'
  });

  assert.equal(launchOptions.userDataDir, getLocalAuthProfilePath(sessionPath, clientId));
  assert.deepEqual(launchOptions.ignoreDefaultArgs, ['--enable-automation']);
  assert.equal(launchOptions.headless, false);
  assert.equal(launchOptions.defaultViewport, null);
  assert.equal(launchOptions.executablePath, executablePath);
  assert.ok(launchOptions.args.includes('--disable-blink-features=AutomationControlled'));
  assert.ok(launchOptions.args.includes('--no-sandbox'));
  assert.ok(launchOptions.args.includes('--disable-setuid-sandbox'));
  assert.ok(launchOptions.args.includes('--disable-dev-shm-usage'));
  assert.ok(launchOptions.args.includes('--force-device-scale-factor=1'));
  assert.ok(launchOptions.args.includes('--high-dpi-support=1'));
  assert.ok(launchOptions.args.includes('--window-size=1366,900'));
  assert.ok(launchOptions.args.includes('--no-startup-window'));
  assert.ok(!launchOptions.args.includes('--window-size=1100,760'));
  assert.equal(launchOptions.waitForInitialPage, false);
  assert.ok(launchOptions.args.includes('--proxy-server=socks5://127.0.0.1:1080'));
  assert.equal(options.authStrategy.dataPath, sessionPath);
  assert.equal(options.authStrategy.clientId, clientId);
  assert.match(
    options.userAgent,
    /^Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/148\.0\.0\.0 Safari\/537\.36$/
  );
  assert.deepEqual(options.webVersionCache, {
    type: 'remote',
    remotePath: WHATSAPP_WEB_VERSION_REMOTE_PATH
  });
  assert.deepEqual(options.puppeteer, {
    browserWSEndpoint: 'ws://127.0.0.1/devtools/browser/test',
    defaultViewport: null
  });
});

test('resolves bundled Chromium paths instead of system Chrome or Edge', () => {
  const projectRoot = path.join(os.tmpdir(), 'add-whatsapp-project');
  const resourcesPath = path.join(os.tmpdir(), 'add-whatsapp-resources');
  const relativeExecutable = bundledChromiumExecutableRelativePath('win32');
  const devExecutable = path.join(projectRoot, 'build-resources', 'chromium', relativeExecutable);
  const packagedExecutable = path.join(resourcesPath, 'chromium', relativeExecutable);
  const puppeteerExecutable = path.join(os.tmpdir(), 'puppeteer-cache', 'chrome.exe');

  assert.equal(
    resolveBundledChromiumExecutablePath({
      isPackaged: true,
      resourcesPath,
      platform: 'win32',
      fsExists: candidate => candidate === packagedExecutable,
      puppeteerExecutablePath: () => puppeteerExecutable,
      projectRoot
    }),
    packagedExecutable
  );
  assert.equal(
    resolveBundledChromiumExecutablePath({
      isPackaged: false,
      resourcesPath,
      platform: 'win32',
      fsExists: candidate => candidate === devExecutable,
      puppeteerExecutablePath: () => puppeteerExecutable,
      projectRoot
    }),
    devExecutable
  );
  assert.equal(
    resolveBundledChromiumExecutablePath({
      isPackaged: false,
      resourcesPath,
      platform: 'win32',
      fsExists: candidate => candidate === puppeteerExecutable,
      puppeteerExecutablePath: () => puppeteerExecutable,
      projectRoot
    }),
    puppeteerExecutable
  );
  assert.throws(
    () => resolveBundledChromiumExecutablePath({
      isPackaged: true,
      resourcesPath,
      platform: 'win32',
      fsExists: () => false,
      puppeteerExecutablePath: () => puppeteerExecutable,
      projectRoot
    }),
    /内置 Chromium 不存在/
  );
});

test('grantWhatsAppWebPermissions grants durable storage before WhatsApp loads', async () => {
  const calls = [];
  const browser = {
    target() {
      return {
        async createCDPSession() {
          return {
            async send(method, payload) {
              calls.push({ method, payload });
            }
          };
        }
      };
    }
  };

  await grantWhatsAppWebPermissions(browser);

  assert.deepEqual(calls, [{
    method: 'Browser.grantPermissions',
    payload: {
      origin: 'https://web.whatsapp.com',
      permissions: ['durableStorage', 'notifications']
    }
  }]);
});

test('createClient launches Chrome profile, grants storage permission, then connects wwebjs to the endpoint', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-cdp-'));
  const chromiumExecutablePath = path.join(os.tmpdir(), 'bundled-chromium', 'chrome.exe');
  const calls = [];
  const fakeBrowser = new EventEmitter();
  fakeBrowser.close = async () => {
    calls.push(['browser.close']);
  };
  fakeBrowser.isConnected = () => true;
  fakeBrowser.process = () => null;
  fakeBrowser.wsEndpoint = () => 'ws://127.0.0.1/devtools/browser/granted';
  fakeBrowser.target = () => ({
    createCDPSession: async () => ({
      send: async (method, payload) => {
        calls.push(['cdp.send', method, payload]);
      }
    })
  });
  const fakePuppeteer = {
    launch: async options => {
      calls.push(['puppeteer.launch', options]);
      return fakeBrowser;
    }
  };
  class FakeClient extends EventEmitter {
    constructor(options) {
      super();
      calls.push(['new Client', options]);
      this.options = options;
      this.destroy = async () => {
        calls.push(['client.destroy']);
      };
    }
  }
  const service = new WhatsAppService({
    sessionPath,
    clientId: 'grant-client',
    proxyServer: 'socks5://127.0.0.1:1080',
    emit: () => {},
    puppeteerModule: fakePuppeteer,
    ClientClass: FakeClient,
    chromiumExecutablePath
  });

  await service.createClient();

  const launchCall = calls.find(call => call[0] === 'puppeteer.launch');
  const grantCallIndex = calls.findIndex(call => call[0] === 'cdp.send');
  const clientCallIndex = calls.findIndex(call => call[0] === 'new Client');
  assert.equal(launchCall[1].userDataDir, getLocalAuthProfilePath(sessionPath, 'grant-client'));
  assert.equal(launchCall[1].executablePath, chromiumExecutablePath);
  assert.ok(launchCall[1].args.includes('--proxy-server=socks5://127.0.0.1:1080'));
  assert.equal(grantCallIndex > -1, true);
  assert.equal(clientCallIndex > grantCallIndex, true);
  assert.equal(calls[clientCallIndex][1].puppeteer.browserWSEndpoint, 'ws://127.0.0.1/devtools/browser/granted');
  assert.deepEqual(calls[grantCallIndex], ['cdp.send', 'Browser.grantPermissions', {
    origin: 'https://web.whatsapp.com',
    permissions: ['durableStorage', 'notifications']
  }]);

  await service.destroy();
  assert.deepEqual(calls.slice(-2).map(call => call[0]), ['client.destroy', 'browser.close']);
  resetWhatsAppSessionGuardsForTests();
});

test('ensureReady closes the prelaunched browser after non-retryable initialization failures', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-init-failure-cleanup-'));
  const chromiumExecutablePath = path.join(os.tmpdir(), 'bundled-chromium', 'chrome.exe');
  const calls = [];
  const fakeBrowser = new EventEmitter();
  fakeBrowser.close = async () => {
    calls.push(['browser.close']);
  };
  fakeBrowser.process = () => null;
  fakeBrowser.wsEndpoint = () => 'ws://127.0.0.1/devtools/browser/failure';
  fakeBrowser.target = () => ({
    createCDPSession: async () => ({
      send: async () => calls.push(['cdp.send'])
    })
  });
  const fakePuppeteer = {
    launch: async options => {
      calls.push(['puppeteer.launch', options]);
      return fakeBrowser;
    }
  };
  class FailingClient extends EventEmitter {
    constructor() {
      super();
      calls.push(['new Client']);
    }

    initialize() {
      throw new Error('Proxy connection refused');
    }

    async destroy() {
      calls.push(['client.destroy']);
    }
  }
  const service = new WhatsAppService({
    sessionPath,
    clientId: 'failure-client',
    emit: () => {},
    puppeteerModule: fakePuppeteer,
    ClientClass: FailingClient,
    chromiumExecutablePath
  });

  await assert.rejects(
    () => service.ensureReady(),
    /Proxy connection refused/
  );

  assert.deepEqual(calls.filter(call => ['client.destroy', 'browser.close'].includes(call[0])).map(call => call[0]), [
    'client.destroy',
    'browser.close'
  ]);
  assert.equal(service.client, null);
  assert.equal(service.browser, null);
  resetWhatsAppSessionGuardsForTests();
});

test('createClient closes an existing browser before launching a replacement', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-replace-browser-'));
  const chromiumExecutablePath = path.join(os.tmpdir(), 'bundled-chromium', 'chrome.exe');
  const calls = [];
  function createBrowser(label) {
    const browser = new EventEmitter();
    browser.close = async () => calls.push([`${label}.close`]);
    browser.process = () => null;
    browser.wsEndpoint = () => `ws://127.0.0.1/devtools/browser/${label}`;
    browser.target = () => ({
      createCDPSession: async () => ({
        send: async () => calls.push([`${label}.grant`])
      })
    });
    return browser;
  }
  const fakePuppeteer = {
    launches: 0,
    launch: async () => {
      fakePuppeteer.launches += 1;
      const label = fakePuppeteer.launches === 1 ? 'firstBrowser' : 'secondBrowser';
      calls.push([`${label}.launch`]);
      return createBrowser(label);
    }
  };
  class FakeClient extends EventEmitter {
    constructor() {
      super();
      calls.push(['new Client']);
    }

    async destroy() {
      calls.push(['client.destroy']);
    }
  }
  const service = new WhatsAppService({
    sessionPath,
    clientId: 'replace-client',
    emit: () => {},
    puppeteerModule: fakePuppeteer,
    ClientClass: FakeClient,
    chromiumExecutablePath
  });

  await service.createClient();
  await service.createClient();

  assert.deepEqual(calls.map(call => call[0]), [
    'firstBrowser.launch',
    'firstBrowser.grant',
    'new Client',
    'client.destroy',
    'firstBrowser.close',
    'secondBrowser.launch',
    'secondBrowser.grant',
    'new Client'
  ]);
  await service.destroy();
  resetWhatsAppSessionGuardsForTests();
});

test('qr event closes only leftover about blank startup tabs after WhatsApp page exists', async () => {
  resetWhatsAppSessionGuardsForTests();
  const closed = [];
  const blankPage = {
    url: () => 'about:blank',
    close: async () => closed.push('blank')
  };
  const whatsappPage = {
    url: () => 'https://web.whatsapp.com/',
    close: async () => closed.push('whatsapp')
  };
  const client = createFakeClient(() => {});
  const service = new FakeWhatsAppService({
    sessionPath: fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-close-blank-')),
    emit: () => {}
  }, [client]);
  service.browser = {
    pages: async () => [blankPage, whatsappPage]
  };

  service.createClient();
  client.emit('qr');
  await delay(10);

  assert.deepEqual(closed, ['blank']);
  await service.destroy();
  resetWhatsAppSessionGuardsForTests();
});

test('qr event keeps about blank startup tab when no WhatsApp page exists yet', async () => {
  resetWhatsAppSessionGuardsForTests();
  const closed = [];
  const blankPage = {
    url: () => 'about:blank',
    close: async () => closed.push('blank')
  };
  const client = createFakeClient(() => {});
  const service = new FakeWhatsAppService({
    sessionPath: fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-keep-blank-')),
    emit: () => {}
  }, [client]);
  service.browser = {
    pages: async () => [blankPage]
  };

  service.createClient();
  client.emit('qr');
  await delay(10);

  assert.deepEqual(closed, []);
  await service.destroy();
  resetWhatsAppSessionGuardsForTests();
});

test('ensureReady reports about blank network stalls before failing initialization', async () => {
  resetWhatsAppSessionGuardsForTests();
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const events = [];
  try {
    global.setInterval = fn => {
      for (let i = 0; i < 8; i += 1) setImmediate(fn);
      return { fake: true };
    };
    global.clearInterval = () => {};
    const client = createFakeClient(() => {});
    client.pupPage = {
      url: () => 'about:blank',
      evaluate: async () => ''
    };
    const service = new FakeWhatsAppService({
      sessionPath: fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-blank-page-')),
      emit: event => events.push(event)
    }, [client]);

    await assert.rejects(
      () => service.ensureReady(),
      /无法连接到 WhatsApp 服务器/
    );
    assert.equal(events.some(event => event.type === 'auth:blank-page'), true);
    await service.destroy();
  } finally {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    resetWhatsAppSessionGuardsForTests();
  }
});

test('ensureReady repairs WhatsApp browser database errors by clearing profile stores and retrying', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-db-error-'));
  const clientId = 'add-whatsapp-account-1';
  const defaultProfilePath = path.join(sessionPath, `session-${clientId}`, 'Default');
  const corruptStoreNames = [
    'IndexedDB',
    'Local Storage',
    'Session Storage',
    'Service Worker',
    'Cache'
  ];
  for (const storeName of corruptStoreNames) {
    const storePath = path.join(defaultProfilePath, storeName);
    fs.mkdirSync(storePath, { recursive: true });
    fs.writeFileSync(path.join(storePath, 'LOCK'), 'stale lock');
  }
  fs.writeFileSync(path.join(defaultProfilePath, 'Cookies'), 'keep login-adjacent files');

  const events = [];
  const brokenClient = createFakeClient(client => {
    setImmediate(() => client.emit('auth_failure', 'A database error occurred on your browser. Please relink your device.'));
  });
  const repairedClient = createFakeClient(client => {
    setImmediate(() => {
      client.emit('qr');
      client.emit('ready');
    });
  });
  const service = new FakeWhatsAppService({
    sessionPath,
    clientId,
    emit: event => events.push(event)
  }, [brokenClient, repairedClient]);

  await service.ensureReady();

  assert.equal(brokenClient.destroyed, true);
  for (const storeName of corruptStoreNames) {
    assert.equal(fs.existsSync(path.join(defaultProfilePath, storeName)), false);
  }
  assert.equal(fs.existsSync(path.join(defaultProfilePath, 'Cookies')), true);
  assert.equal(service.created.length, 2);
  assert.deepEqual(events.map(event => event.type), [
    'auth:failure',
    'auth:database-error',
    'auth:profile-repair',
    'auth:qr',
    'auth:ready'
  ]);
  await service.destroy();
  resetWhatsAppSessionGuardsForTests();
});

test('ensureReady prevents concurrent browser instances for the same LocalAuth profile', async () => {
  resetWhatsAppSessionGuardsForTests();
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-session-guard-'));
  const firstClient = createFakeClient(client => {
    setImmediate(() => client.emit('ready'));
  });
  const secondClient = createFakeClient(client => {
    setImmediate(() => client.emit('ready'));
  });
  const firstService = new FakeWhatsAppService({
    sessionPath,
    clientId: 'same-client',
    emit: () => {}
  }, [firstClient]);
  const secondService = new FakeWhatsAppService({
    sessionPath,
    clientId: 'same-client',
    emit: () => {}
  }, [secondClient]);

  await firstService.ensureReady();
  await assert.rejects(
    () => secondService.ensureReady(),
    /already has an active browser instance/
  );
  assert.equal(secondService.created.length, 0);

  await firstService.destroy();
  await secondService.ensureReady();
  assert.equal(secondService.created.length, 1);
  await secondService.destroy();
  resetWhatsAppSessionGuardsForTests();
});
