const path = require('path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require('electron');
const XLSX = require('xlsx');
const { importContacts } = require('../core/tableImporter');
const { JsonProgressStore } = require('../core/progressStore');
const { resolveProgressPathForSource } = require('../core/progressResolver');
const { AccountContext } = require('../core/accountContext');
const { AuthStore } = require('../core/authStore');
const { SyncPackageStore } = require('../core/syncPackageStore');
const { sourceIdentityFor } = require('../core/progressIdentity');
const { migrateLegacyUserData } = require('../core/legacyMigration');
const { runSendTask } = require('../core/taskRunner');
const { JsonTemplateStore } = require('../core/templateStore');
const { JsonHistoryStore } = require('../core/historyStore');
const {
  canOpenSecondaryWorkspace,
  createEntitlementState,
  planCatalog,
  resolveTaskDailyLimit,
  usageSummary
} = require('../core/billingPlans');
const { createWhatsAppService } = require('./whatsappService');
const { WhatsAppSessionManager } = require('./whatsappSessionManager');
const { LocalProxyBridge } = require('./proxyBridge');
const {
  JsonProxySettingsStore,
  buildProxyServer,
  lookupExitIpViaSocks5,
  normalizeProxySettings,
  publicProxySettings,
  testSocks5Proxy
} = require('./proxySettings');
const { ProxyMonitor } = require('./proxyMonitor');
const {
  createWorkspaceId,
  normalizeProxyServer,
  parseWorkspaceId,
  parseWorkspaceProxy,
  workspaceLaunchArgs,
  workspaceUserDataPath
} = require('./workspaceProfiles');

const PROXY_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
const workspaceId = parseWorkspaceId(process.argv);
const workspaceProxyServer = parseWorkspaceProxy(process.argv);
if (workspaceId) {
  app.setPath('userData', workspaceUserDataPath(app.getPath('appData'), workspaceId));
}

let mainWindow;
let tray;
let isQuitting = false;
let closeChoiceOpen = false;
let importedRows = [];
let importedSource = null;
let currentImportOptions = { skipChinaNumbers: true };
let currentTask = null;
let stopRequested = false;
let authStore = null;
let accountContext = null;
let syncPackageStore = null;
let proxySettingsStore = null;
let whatsappSessionManager = null;
let templateStore = null;
let historyStore = null;
let activeRun = null;
let proxyMonitorTimer = null;
let activeProxyBridge = null;
let subscriptionState = createEntitlementState('advanced', {
  balanceCredits: 2000,
  usedToday: 0,
  usedThisMonth: 0,
  monthlyLimit: 6000
});
const openSecondaryWorkspaces = new Set();

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '../../assets/icon.ico');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 720,
    title: 'Add WhatsApp',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#f6fbf8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    showCloseChoice();
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.addwhatsapp.desktop');
  Menu.setApplicationMenu(null);
  const userDataPath = app.getPath('userData');
  authStore = new AuthStore({
    usersPath: path.join(userDataPath, 'auth', 'users.json'),
    sessionPath: path.join(userDataPath, 'auth', 'session.json')
  });
  accountContext = new AccountContext({ userDataPath });
  syncPackageStore = new SyncPackageStore();
  proxySettingsStore = new JsonProxySettingsStore(path.join(userDataPath, 'settings', 'proxy.json'));
  whatsappSessionManager = new WhatsAppSessionManager({
    userDataPath,
    proxyServer: workspaceProxyServer,
    createService: config => createWhatsAppService(app, event => sendToRenderer('task:event', event), config)
  });
  restoreAuthenticatedSession();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit();
});

function restoreAuthenticatedSession() {
  const session = authStore.getSessionUser();
  if (!session.authenticated) return;
  accountContext.setCurrentUser(session.user);
  initializeAccountStores();
}

function initializeAccountStores() {
  migrateLegacyUserData({
    userDataPath: app.getPath('userData'),
    accountDir: accountContext.accountDir()
  });
  templateStore = new JsonTemplateStore(accountContext.accountPath('templates.json'));
  historyStore = new JsonHistoryStore(accountContext.accountPath('history', 'runs.json'));
  historyStore.markOpenInterrupted();
  restoreLastImport();
}

function clearAccountState() {
  templateStore = null;
  historyStore = null;
  importedRows = [];
  importedSource = null;
  currentImportOptions = { skipChinaNumbers: true };
  activeRun = null;
}

function requireAuthenticated() {
  const user = accountContext.requireCurrentUser();
  if (!templateStore || !historyStore) initializeAccountStores();
  return user;
}

function authState() {
  try {
    const user = accountContext.getCurrentUser();
    return {
      hasUsers: authStore.listUsers().length > 0,
      authenticated: Boolean(user),
      user,
      workspace: {
        id: workspaceId,
        isSecondary: Boolean(workspaceId),
        proxy: workspaceId ? publicProxySettings(proxySettingsStore.load()) : null
      },
      subscription: publicSubscriptionState()
    };
  } catch (error) {
    return {
      hasUsers: false,
      authenticated: false,
      user: null,
      workspace: {
        id: workspaceId,
        isSecondary: Boolean(workspaceId),
        proxy: workspaceId && proxySettingsStore ? publicProxySettings(proxySettingsStore.load()) : null
      },
      subscription: publicSubscriptionState(),
      error: error.message
    };
  }
}

function publicSubscriptionState() {
  return {
    ...subscriptionState,
    catalog: planCatalog(),
    openSecondaryCount: openSecondaryWorkspaces.size,
    usage: usageSummary(subscriptionState)
  };
}

function protectedError(error) {
  return {
    ok: false,
    error: error.message,
    authRequired: /请先登录本地账号/.test(error.message)
  };
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Add WhatsApp');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: '完全退出',
      click: () => quitCompletely()
    }
  ]));
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

async function showCloseChoice() {
  if (closeChoiceOpen || !mainWindow) return;
  closeChoiceOpen = true;
  mainWindow.show();
  mainWindow.focus();
  sendToRenderer('app:show-close-choice', {
    hasActiveTask: Boolean(currentTask),
    hasTray: Boolean(tray)
  });
}

async function quitCompletely() {
  isQuitting = true;
  stopRequested = true;
  if (activeRun && historyStore) {
    const history = historyStore.upsert({
      ...activeRun,
      finishedAt: new Date().toISOString(),
      reason: 'closed',
      message: '用户完全关闭软件，任务已停止并保留进度。',
      stats: getStatsFromProgress(activeRun.progressPath)
    });
    sendToRenderer('history:updated', history);
  }
  try {
    if (whatsappSessionManager) await whatsappSessionManager.destroy();
    await stopActiveProxyBridge();
  } catch {
    // Ignore shutdown cleanup errors; quitting should still close every process.
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

ipcMain.handle('auth:get-state', async () => authState());

ipcMain.handle('auth:register', async (_event, payload = {}) => {
  try {
    const result = authStore.register({
      username: payload.username,
      password: payload.password
    });
    authStore.createSession(result.user.accountId, 7);
    accountContext.setCurrentUser(result.user);
    initializeAccountStores();
    sendToRenderer('auth:changed', authState());
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('auth:login', async (_event, payload = {}) => {
  try {
    const result = authStore.login({
      username: payload.username,
      password: payload.password
    });
    if (!result.ok) return result;
    authStore.createSession(result.user.accountId, 7);
    accountContext.setCurrentUser(result.user);
    initializeAccountStores();
    sendToRenderer('auth:changed', authState());
    return { ok: true, user: result.user };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  if (currentTask) return { ok: false, error: '当前任务正在运行，请先暂停或等待结束后再退出账号。' };
  authStore.logout();
  accountContext.clear();
  clearAccountState();
  await whatsappSessionManager.destroy();
  sendToRenderer('auth:changed', authState());
  return { ok: true };
});

ipcMain.handle('auth:reset-password', async (_event, payload = {}) => {
  try {
    const result = authStore.resetPassword({
      username: payload.username,
      recoveryCode: payload.recoveryCode,
      newPassword: payload.newPassword
    });
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('auth:download-recovery', async (_event, payload = {}) => {
  try {
    const user = accountContext.getCurrentUser() || { username: payload.username, accountId: payload.accountId };
    if (!user || !user.username || !payload.recoveryCode) throw new Error('缺少账号或恢复码。');
    const safeUsername = String(user.username).replace(/[\\/:*?"<>|]/g, '_');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(app.getPath('desktop'), `Add-WhatsApp-账号恢复信息-${safeUsername}-${stamp}.txt`);
    const content = [
      'Add WhatsApp 本地账号恢复信息',
      '',
      `账号：${user.username}`,
      `恢复码：${payload.recoveryCode}`,
      `创建时间：${new Date().toLocaleString()}`,
      '',
      '重要说明：',
      '1. 这个文件不包含你的密码。',
      '2. 恢复码可以用于重置本地账号密码，请妥善保存。',
      '3. 拿到恢复码的人可能重置这个本地账号。'
    ].join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    if (user.accountId) authStore.markRecoveryDownloaded(user.accountId);
    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('auth:clear-whatsapp-session', async () => {
  try {
    const user = requireAuthenticated();
    if (currentTask) return { ok: false, error: '当前任务正在运行，不能清除 WhatsApp 缓存。' };
    await whatsappSessionManager.destroy();
    const sessionPath = accountContext.accountPath('whatsapp-session');
    fs.rmSync(sessionPath, { recursive: true, force: true });
    sendToRenderer('task:event', { type: 'auth:disconnected', message: '当前账号的 WhatsApp 缓存已清除，下次任务需要重新扫码。' });
    return { ok: true, accountId: user.accountId };
  } catch (error) {
    return protectedError(error);
  }
});

ipcMain.handle('workspace:open-another-account', async (_event, payload = {}) => {
  try {
    if (workspaceId) {
      return { ok: false, error: '独立工作台里不能继续打开新的工作台。' };
    }
    const entitlement = canOpenSecondaryWorkspace(subscriptionState, openSecondaryWorkspaces.size);
    if (!entitlement.ok) {
      return { ok: false, error: entitlement.error };
    }
    const nextWorkspaceId = createWorkspaceId();
    const args = workspaceLaunchArgs({
      isPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      workspaceId: nextWorkspaceId
    });
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    openSecondaryWorkspaces.add(nextWorkspaceId);
    child.once('exit', () => {
      openSecondaryWorkspaces.delete(nextWorkspaceId);
      sendToRenderer('auth:changed', authState());
    });
    child.unref();
    sendToRenderer('auth:changed', authState());
    return {
      ok: true,
      workspaceId: nextWorkspaceId,
      remaining: entitlement.remaining - 1
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

function requireSecondaryWorkspace() {
  if (!workspaceId) throw new Error('主工作台默认使用当前电脑/VPN 网络，不提供 IP 代理设置。');
}

async function probeSocks5Proxy(settings) {
  const result = await testSocks5Proxy(settings);
  const exitIp = await lookupExitIpViaSocks5(settings);
  return {
    ...result,
    exitIp
  };
}

function createProxyMonitor() {
  return new ProxyMonitor({
    loadSettings: () => proxySettingsStore.load(),
    saveSettings: settings => proxySettingsStore.save(settings),
    testProxy: probeSocks5Proxy
  });
}

async function stopActiveProxyBridge() {
  if (!activeProxyBridge) return;
  const bridge = activeProxyBridge;
  activeProxyBridge = null;
  await bridge.stop();
}

async function browserProxyServerForSettings(settings) {
  await stopActiveProxyBridge();
  activeProxyBridge = new LocalProxyBridge(settings);
  return activeProxyBridge.start();
}

async function checkSecondaryProxyReady() {
  if (!workspaceId) return { ok: true };
  const monitor = createProxyMonitor();
  const result = await monitor.checkNow();
  if (!result.ok) return result;
  const settings = proxySettingsStore.load();
  const browserProxyServer = await browserProxyServerForSettings(settings);
  whatsappSessionManager.setProxyServer(browserProxyServer);
  await whatsappSessionManager.destroy();
  return result;
}

function startProxyMonitorForRunningTask() {
  if (!workspaceId) return;
  if (proxyMonitorTimer) clearInterval(proxyMonitorTimer);
  const monitor = createProxyMonitor();
  proxyMonitorTimer = setInterval(async () => {
    if (!currentTask || stopRequested) return;
    const result = await monitor.checkNow();
    if (result.ok) {
      sendToRenderer('auth:changed', authState());
      return;
    }
    stopRequested = true;
    sendToRenderer('task:event', {
      type: 'task:proxy-error',
      message: `代理异常，已请求暂停，当前号码处理完后会停下：${result.error}`,
      result
    });
    sendToRenderer('auth:changed', authState());
  }, PROXY_MONITOR_INTERVAL_MS);
}

function stopProxyMonitorForRunningTask() {
  if (!proxyMonitorTimer) return;
  clearInterval(proxyMonitorTimer);
  proxyMonitorTimer = null;
}

ipcMain.handle('proxy:get', async () => {
  try {
    requireSecondaryWorkspace();
    return { ok: true, proxy: publicProxySettings(proxySettingsStore.load()) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('proxy:test', async (_event, payload = {}) => {
  try {
    requireSecondaryWorkspace();
    const settings = normalizeProxySettings(payload);
    const result = await probeSocks5Proxy(settings);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('proxy:save', async (_event, payload = {}) => {
  try {
    requireSecondaryWorkspace();
    const settings = normalizeProxySettings(payload);
    const testResult = await probeSocks5Proxy(settings);
    const saved = proxySettingsStore.save({
      ...settings,
      baselineIp: testResult.exitIp,
      lastExitIp: testResult.exitIp,
      lastCheckedAt: testResult.checkedAt,
      lastProxyError: null
    });
    await whatsappSessionManager.destroy();
    await stopActiveProxyBridge();
    return { ok: true, proxy: publicProxySettings(saved), result: testResult };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('subscription:get-state', async () => publicSubscriptionState());

ipcMain.handle('contacts:select-and-import', async (_event, options = {}) => {
  try {
    requireAuthenticated();
  } catch (error) {
    return protectedError(error);
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择号码表格',
    properties: ['openFile'],
    filters: [
      { name: '表格文件', extensions: ['xlsx', 'xls', 'csv'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  try {
    currentImportOptions = normalizeImportOptions(options);
    const data = importContacts(result.filePaths[0], currentImportOptions);
    importedRows = data.rows;
    importedSource = data.filePath;
    saveLastImport(data.filePath, currentImportOptions);
    return {
      canceled: false,
      data: {
        ...data,
        importOptions: currentImportOptions,
        progress: getCurrentProgressSummary()
      }
    };
  } catch (error) {
    return {
      canceled: false,
      error: error.message
    };
  }
});

ipcMain.handle('app:bootstrap', async () => {
  const auth = authState();
  if (!auth.authenticated) {
    return { auth, imported: null, history: [] };
  }
  try {
    requireAuthenticated();
    return {
      auth,
      imported: getImportedSummary(),
      history: historyStore.list()
    };
  } catch (error) {
    return { auth: { ...auth, authenticated: false, error: error.message }, imported: null, history: [] };
  }
});

ipcMain.handle('app:close-choice-action', async (_event, action) => {
  closeChoiceOpen = false;
  if (action === 'minimize') {
    mainWindow.hide();
    return { ok: true };
  }
  if (action === 'quit') {
    await quitCompletely();
    return { ok: true };
  }
  return { ok: true };
});

ipcMain.handle('progress:get-current', async () => {
  try {
    requireAuthenticated();
    return getCurrentProgressSummary();
  } catch (error) {
    return protectedError(error);
  }
});

ipcMain.handle('task:start', async (_event, config) => {
  try {
    requireAuthenticated();
  } catch (error) {
    return { started: false, ...protectedError(error) };
  }
  if (workspaceId) {
    try {
      const proxyCheck = await checkSecondaryProxyReady();
      if (!proxyCheck.ok) {
        return { started: false, error: `第二工作台代理检测失败：${proxyCheck.error}` };
      }
    } catch (error) {
      return { started: false, error: `第二工作台代理检测失败：${error.message}` };
    }
  }
  if (currentTask) {
    return { started: false, error: '已有任务正在运行。' };
  }
  if (!importedRows.length) {
    return { started: false, error: '请先导入表格。' };
  }

  stopRequested = false;
  currentTask = runTask(config || {});
  return { started: true };
});

ipcMain.handle('task:stop', async () => {
  try {
    requireAuthenticated();
  } catch (error) {
    return { stopped: false, ...protectedError(error) };
  }
  if (!currentTask) return { stopped: false, error: '当前没有正在运行的任务。' };
  stopRequested = true;
  sendToRenderer('task:event', { type: 'task:stopping', message: '已请求暂停，当前号码处理完后会停下。' });
  return { stopped: true };
});

ipcMain.handle('templates:get', async () => {
  requireAuthenticated();
  return templateStore.load();
});

ipcMain.handle('templates:save', async (_event, templates) => {
  requireAuthenticated();
  return templateStore.save(templates);
});

ipcMain.handle('history:list', async () => {
  requireAuthenticated();
  return historyStore.list();
});

async function runTask(config) {
  const startedAt = new Date().toISOString();
  const taskId = `${Date.now()}`;
  const progressPath = progressPathForSource(importedSource);
  activeRun = {
    id: taskId,
    sourceFile: importedSource,
    sourceIdentity: sourceIdentityFor(importedSource),
    startedAt,
    finishedAt: null,
    reason: 'running',
    stats: { sent: 0, failed: 0, unregistered: 0, invalid: 0, chinaSkipped: 0 },
    progressPath
  };
  historyStore.upsert(activeRun);
  sendToRenderer('history:updated', historyStore.list());
  try {
    startProxyMonitorForRunningTask();
    sendToRenderer('task:event', { type: 'task:starting', message: '正在连接 WhatsApp...' });
    const whatsappService = await whatsappSessionManager.switchToAccount(accountContext.requireCurrentUser());
    const client = await whatsappService.ensureReady();
    const progressStore = new JsonProgressStore(progressPath);

    const result = await runSendTask({
      rows: importedRows,
      client,
      progressStore,
      templates: templateStore.load(),
      config: {
        taskId,
        sourceFile: importedSource,
        sourceIdentity: sourceIdentityFor(importedSource),
        startedAt,
        maxPerDay: resolveTaskDailyLimit(subscriptionState, config.maxPerDay),
        delayMinMs: Number(config.delayMinSeconds || 22) * 1000,
        delayMaxMs: Number(config.delayMaxSeconds || 26) * 1000
      },
      shouldStop: () => stopRequested,
      onEvent: event => sendToRenderer('task:event', event)
    });

    sendToRenderer('task:event', {
      type: 'task:finished',
      message: finishMessage(result.reason),
      result
    });
    const history = historyStore.upsert({
      id: taskId,
      sourceFile: importedSource,
      startedAt,
      finishedAt: new Date().toISOString(),
      reason: result.reason,
      stats: result.stats,
      progressPath
    });
    sendToRenderer('history:updated', history);
  } catch (error) {
    sendToRenderer('task:event', { type: 'task:error', message: error.message });
    const history = historyStore.upsert({
      id: taskId,
      sourceFile: importedSource,
      startedAt,
      finishedAt: new Date().toISOString(),
      reason: 'error',
      message: error.message,
      stats: getStatsFromProgress(progressPath),
      progressPath
    });
    sendToRenderer('history:updated', history);
  } finally {
    stopProxyMonitorForRunningTask();
    currentTask = null;
    stopRequested = false;
    activeRun = null;
  }
}

function progressPathForSource(sourceFile) {
  const identity = sourceIdentityFor(sourceFile) || {};
  const sourceKey = identity.fileFingerprint
    ? identity.fileFingerprint.slice(0, 16)
    : crypto
      .createHash('sha1')
      .update(sourceFile || 'manual-import')
      .digest('hex')
      .slice(0, 16);
  const defaultPath = accountContext.accountPath('progress', `${sourceKey}.json`);
  return resolveProgressPathForSource({
    sourceFile,
    defaultPath,
    historyItems: historyStore ? historyStore.list() : []
  });
}

function getCurrentProgressSummary() {
  if (!importedRows.length || !importedSource) {
    return {
      available: false,
      total: 0,
      processed: 0,
      nextRowNumber: null,
      progressPath: null
    };
  }
  const progressPath = progressPathForSource(importedSource);
  const progress = new JsonProgressStore(progressPath).load();
  const nextIndex = Math.min((progress.lastIndex ?? -1) + 1, importedRows.length);
  return {
    available: true,
    total: importedRows.length,
    processed: Math.min(nextIndex, importedRows.length),
    lastIndex: progress.lastIndex ?? -1,
    nextRowNumber: importedRows[nextIndex] ? importedRows[nextIndex].rowNumber : null,
    sent: progress.sent.length,
    skipped: progress.skipped.length,
    failed: progress.failed.length,
    invalid: progress.invalid.length,
    progressPath
  };
}

function getStatsFromProgress(progressPath) {
  const progress = new JsonProgressStore(progressPath).load();
  const chinaSkipped = progress.invalid.filter(row => row.status === 'china-skipped').length;
  return {
    sent: progress.sent.length,
    unregistered: progress.skipped.length,
    failed: progress.failed.length,
    invalid: progress.invalid.length,
    chinaSkipped
  };
}

function stateFilePath() {
  return accountContext.accountPath('state', 'last-import.json');
}

function saveLastImport(sourceFile) {
  const filePath = stateFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    sourceFile,
    sourceIdentity: sourceIdentityFor(sourceFile),
    importOptions: currentImportOptions,
    savedAt: new Date().toISOString()
  }, null, 2));
}

function loadLastImportPath() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFilePath(), 'utf-8'));
    if (!parsed || !parsed.sourceFile || !fs.existsSync(parsed.sourceFile)) return null;
    return {
      sourceFile: parsed.sourceFile,
      importOptions: normalizeImportOptions(parsed.importOptions || {})
    };
  } catch {
    return null;
  }
}

function restoreLastImport() {
  const saved = loadLastImportPath();
  if (!saved) return null;
  try {
    currentImportOptions = saved.importOptions;
    const data = importContacts(saved.sourceFile, currentImportOptions);
    importedRows = data.rows;
    importedSource = data.filePath;
    return data;
  } catch {
    return null;
  }
}

function getImportedSummary() {
  if (!importedRows.length || !importedSource) return null;
  const data = importContacts(importedSource, currentImportOptions);
  importedRows = data.rows;
  return {
    ...data,
    importOptions: currentImportOptions,
    progress: getCurrentProgressSummary()
  };
}

function normalizeImportOptions(options = {}) {
  return {
    skipChinaNumbers: options.skipChinaNumbers !== false
  };
}

function finishMessage(reason) {
  if (reason === 'daily-limit') return '今日限额已用完。';
  if (reason === 'stopped') return '任务已暂停，下次开始会从已记录位置继续。';
  if (reason === 'automation-lost') return '自动化浏览器已关闭或失联，任务已停止并保留进度。';
  return '任务已完成。';
}

function collectProgressEntries() {
  const progressDir = accountContext.accountPath('progress');
  if (!fs.existsSync(progressDir)) return [];
  return fs.readdirSync(progressDir)
    .filter(fileName => fileName.endsWith('.json'))
    .map(fileName => {
      const progressPath = path.join(progressDir, fileName);
      return {
        progressPath,
        ...new JsonProgressStore(progressPath).load()
      };
    });
}

function importProgressEntries(entries = []) {
  let imported = 0;
  for (const entry of entries) {
    const fingerprint = entry.fileFingerprint || (entry.sourceIdentity && entry.sourceIdentity.fileFingerprint);
    const key = fingerprint
      ? fingerprint.slice(0, 16)
      : crypto.createHash('sha1').update(entry.sourceFile || entry.taskId || `${Date.now()}-${imported}`).digest('hex').slice(0, 16);
    const progressPath = accountContext.accountPath('progress', `${key}.json`);
    const current = new JsonProgressStore(progressPath).load();
    if (Number(entry.lastIndex ?? -1) >= Number(current.lastIndex ?? -1)) {
      new JsonProgressStore(progressPath).save({
        ...entry,
        progressPath: undefined
      });
      imported += 1;
    }
  }
  return imported;
}

ipcMain.handle('sync:export', async (_event, payload = {}) => {
  try {
    const user = requireAuthenticated();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出账号同步包',
      defaultPath: `add-whatsapp-sync-${user.username}.awsync`,
      filters: [{ name: 'Add WhatsApp 同步包', extensions: ['awsync'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    syncPackageStore.exportPackage({
      filePath: result.filePath,
      password: payload.password,
      payload: {
        account: user,
        history: historyStore.list(),
        progress: collectProgressEntries()
      }
    });
    return { ok: true, canceled: false, filePath: result.filePath };
  } catch (error) {
    return protectedError(error);
  }
});

ipcMain.handle('sync:import', async (_event, payload = {}) => {
  try {
    requireAuthenticated();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入账号同步包',
      properties: ['openFile'],
      filters: [{ name: 'Add WhatsApp 同步包', extensions: ['awsync'] }]
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    const imported = syncPackageStore.importPackage({
      filePath: result.filePaths[0],
      password: payload.password
    });
    for (const item of imported.payload.history || []) {
      historyStore.upsert(item);
    }
    const progressImported = importProgressEntries(imported.payload.progress || []);
    sendToRenderer('history:updated', historyStore.list());
    return {
      ok: true,
      canceled: false,
      historyImported: (imported.payload.history || []).length,
      progressImported
    };
  } catch (error) {
    return protectedError(error);
  }
});

ipcMain.handle('report:export', async (_event, payload) => {
  try {
    requireAuthenticated();
  } catch (error) {
    return protectedError(error);
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出预检报表',
    defaultPath: 'whatsapp-import-report.xlsx',
    filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
  });

  if (result.canceled || !result.filePath) return { canceled: true };

  const rows = (payload && payload.rows ? payload.rows : []).map(row => ({
    行号: row.rowNumber,
    原始电话: row.rawPhone,
    国家: row.countryIso || '',
    标准号码: row.e164 || '',
    WhatsAppID: row.whatsappId || '',
    语言: row.language || '',
    状态: row.status,
    原因: row.error === 'china-number-skipped' ? '中国号码已排除' : row.error || ''
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import Report');
  XLSX.writeFile(workbook, result.filePath);

  return { canceled: false, filePath: result.filePath };
});
