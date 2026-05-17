const path = require('path');
const crypto = require('node:crypto');
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require('electron');
const XLSX = require('xlsx');
const { importContacts } = require('../core/tableImporter');
const { JsonProgressStore } = require('../core/progressStore');
const { runSendTask } = require('../core/taskRunner');
const { JsonTemplateStore } = require('../core/templateStore');
const { JsonHistoryStore } = require('../core/historyStore');
const { createWhatsAppService } = require('./whatsappService');

let mainWindow;
let tray;
let isQuitting = false;
let closeChoiceOpen = false;
let importedRows = [];
let importedSource = null;
let currentTask = null;
let stopRequested = false;
let whatsappService = null;
let templateStore = null;
let historyStore = null;

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
    backgroundColor: '#f6fbf8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    showCloseChoice();
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.addwhatsapp.desktop');
  whatsappService = createWhatsAppService(app, event => sendToRenderer('task:event', event));
  templateStore = new JsonTemplateStore(path.join(app.getPath('userData'), 'templates.json'));
  historyStore = new JsonHistoryStore(path.join(app.getPath('userData'), 'history', 'runs.json'));
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') app.quit();
});

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
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['最小化到托盘', '完全关闭', '取消'],
      defaultId: 0,
      cancelId: 2,
      title: '关闭 Add WhatsApp',
      message: '你想把软件最小化到托盘，还是完全关闭？',
      detail: '完全关闭会结束 Add WhatsApp 的所有进程；最小化到托盘会继续保留登录状态和当前窗口。'
    });

    if (result.response === 0) {
      mainWindow.hide();
      return;
    }
    if (result.response === 1) {
      quitCompletely();
    }
  } finally {
    closeChoiceOpen = false;
  }
}

async function quitCompletely() {
  isQuitting = true;
  try {
    if (whatsappService) await whatsappService.destroy();
  } catch {
    // Ignore shutdown cleanup errors; quitting should still close every process.
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

ipcMain.handle('contacts:select-and-import', async () => {
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
    const data = importContacts(result.filePaths[0]);
    importedRows = data.rows;
    importedSource = data.filePath;
    return {
      canceled: false,
      data: {
        ...data,
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

ipcMain.handle('progress:get-current', async () => getCurrentProgressSummary());

ipcMain.handle('task:start', async (_event, config) => {
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
  if (!currentTask) return { stopped: false, error: '当前没有正在运行的任务。' };
  stopRequested = true;
  sendToRenderer('task:event', { type: 'task:stopping', message: '已请求暂停，当前号码处理完后会停下。' });
  return { stopped: true };
});

ipcMain.handle('templates:get', async () => templateStore.load());

ipcMain.handle('templates:save', async (_event, templates) => templateStore.save(templates));

ipcMain.handle('history:list', async () => historyStore.list());

async function runTask(config) {
  const startedAt = new Date().toISOString();
  try {
    sendToRenderer('task:event', { type: 'task:starting', message: '正在连接 WhatsApp...' });
    const client = await whatsappService.ensureReady();
    const progressPath = progressPathForSource(importedSource);
    const progressStore = new JsonProgressStore(progressPath);

    const result = await runSendTask({
      rows: importedRows,
      client,
      progressStore,
      templates: templateStore.load(),
      config: {
        maxPerDay: Number(config.maxPerDay || 80),
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
    const history = historyStore.append({
      id: `${Date.now()}`,
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
  } finally {
    currentTask = null;
    stopRequested = false;
  }
}

function progressPathForSource(sourceFile) {
  const sourceKey = crypto
    .createHash('sha1')
    .update(sourceFile || 'manual-import')
    .digest('hex')
    .slice(0, 16);
  return path.join(app.getPath('userData'), 'progress', `${sourceKey}.json`);
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

function finishMessage(reason) {
  if (reason === 'daily-limit') return '今日限额已用完。';
  if (reason === 'stopped') return '任务已暂停，下次开始会从已记录位置继续。';
  return '任务已完成。';
}

ipcMain.handle('report:export', async (_event, payload) => {
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
    原因: row.error || ''
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import Report');
  XLSX.writeFile(workbook, result.filePath);

  return { canceled: false, filePath: result.filePath };
});
