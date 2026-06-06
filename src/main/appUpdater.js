const fs = require('node:fs');
const path = require('node:path');
const log = require('electron-log');
const electronUpdater = require('electron-updater');
const { JsonUpdateStateStore, UpdateManager } = require('./updateManager');

const UPDATE_POLICY_URL = 'https://addwhatsapp.com/downloads/latest/update.json';
const UPDATE_REQUEST_TIMEOUT_MS = 15000;
const UPDATER_CACHE_DIRECTORY_NAME = 'add-whatsapp-desktop-updater';

async function loadUpdatePolicy({
  url = UPDATE_POLICY_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('UPDATE_FETCH_UNAVAILABLE');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${url}?t=${Date.now()}`, {
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache'
      },
      redirect: 'error',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`UPDATE_POLICY_HTTP_${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function createUpdateManager({
  app,
  userDataPath,
  isTaskActive,
  prepareForInstall,
  onStateChanged
}) {
  const { autoUpdater } = electronUpdater;
  log.transports.file.level = 'info';
  log.transports.file.fileName = 'updater.log';
  autoUpdater.logger = log;
  autoUpdater.disableWebInstaller = true;

  return new UpdateManager({
    updater: autoUpdater,
    currentVersion: app.getVersion(),
    policyLoader: () => loadUpdatePolicy(),
    stateStore: new JsonUpdateStateStore(path.join(userDataPath, 'updates', 'state.json')),
    isTaskActive,
    prepareForInstall,
    onStateChanged,
    clearUpdateCache: () => {
      fs.rmSync(
        path.join(app.getPath('cache'), UPDATER_CACHE_DIRECTORY_NAME, 'pending'),
        { recursive: true, force: true }
      );
    },
    unsigned: true
  });
}

module.exports = {
  UPDATE_POLICY_URL,
  UPDATE_REQUEST_TIMEOUT_MS,
  UPDATER_CACHE_DIRECTORY_NAME,
  createUpdateManager,
  loadUpdatePolicy
};
