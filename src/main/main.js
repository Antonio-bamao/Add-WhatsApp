const path = require('path');
const crypto = require('node:crypto');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const XLSX = require('xlsx');
const { importContacts } = require('../core/tableImporter');
const { JsonProgressStore } = require('../core/progressStore');
const { DEFAULT_TEMPLATES, runSendTask } = require('../core/taskRunner');
const { createWhatsAppService } = require('./whatsappService');

let mainWindow;
let importedRows = [];
let importedSource = null;
let currentTask = null;
let stopRequested = false;
let whatsappService = null;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 720,
    title: 'Add WhatsApp',
    backgroundColor: '#f6fbf8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  whatsappService = createWhatsAppService(app, event => sendToRenderer('task:event', event));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

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
      data
    };
  } catch (error) {
    return {
      canceled: false,
      error: error.message
    };
  }
});

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

async function runTask(config) {
  try {
    sendToRenderer('task:event', { type: 'task:starting', message: '正在连接 WhatsApp...' });
    const client = await whatsappService.ensureReady();
    const sourceKey = crypto
      .createHash('sha1')
      .update(importedSource || 'manual-import')
      .digest('hex')
      .slice(0, 16);
    const progressPath = path.join(app.getPath('userData'), 'progress', `${sourceKey}.json`);
    const progressStore = new JsonProgressStore(progressPath);

    const result = await runSendTask({
      rows: importedRows,
      client,
      progressStore,
      templates: DEFAULT_TEMPLATES,
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
  } catch (error) {
    sendToRenderer('task:event', { type: 'task:error', message: error.message });
  } finally {
    currentTask = null;
    stopRequested = false;
  }
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
