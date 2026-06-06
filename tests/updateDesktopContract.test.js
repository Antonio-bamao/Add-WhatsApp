const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('desktop main process exposes updater IPC and enables updates only for packaged main workspace', () => {
  const main = read('src/main/main.js');
  const preload = read('src/main/preload.js');
  const updater = read('src/main/updateManager.js');

  assert.match(main, /createUpdateManager/);
  assert.match(main, /app\.isPackaged\s*&&\s*!workspaceId/);
  assert.match(main, /updates:get-state/);
  assert.match(main, /updates:check/);
  assert.match(main, /updates:install-pending/);
  assert.match(main, /updates:state-changed/);
  assert.match(main, /UPDATE_STARTUP_DELAY_MS\s*=\s*30\s*\*\s*1000/);
  assert.match(main, /UPDATE_CHECK_INTERVAL_MS\s*=\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(main, /updateRetryTimer/);
  assert.match(main, /Date\.parse\(state\.retryAt\)/);
  assert.match(main, /installPending\(\{\s*requireMandatory:\s*true\s*\}\)/);
  assert.match(main, /prepareForShutdown/);
  assert.match(main, /requestShutdownOthers/);
  assert.match(main, /waitForOtherWorkspaces/);
  assert.match(updater, /quitAndInstall/);

  assert.match(preload, /getUpdateState/);
  assert.match(preload, /checkForUpdates/);
  assert.match(preload, /installPendingUpdate/);
  assert.match(preload, /onUpdateStateChanged/);
});

test('settings page shows version, update status, progress, notes, and manual actions', () => {
  const html = read('src/renderer/index.html');
  const renderer = read('src/renderer/renderer.js');
  const styles = read('src/renderer/styles.css');

  for (const id of [
    'currentVersionValue',
    'targetVersionValue',
    'updateStatusText',
    'updateProgress',
    'updateErrorText',
    'updateNotesButton',
    'checkUpdateButton',
    'installUpdateButton'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(renderer, new RegExp(id));
  }
  assert.match(renderer, /renderUpdateState/);
  assert.match(renderer, /onUpdateStateChanged/);
  assert.match(styles, /\.update-panel/);
});

test('Windows build is a per-user x64 NSIS installer with a generic update provider', () => {
  const packageJson = JSON.parse(read('package.json'));
  const builderConfig = read('electron-builder.config.js');

  assert.equal(packageJson.version, '0.1.5');
  assert.match(packageJson.scripts.build, /electron-builder --config electron-builder\.config\.js --win nsis --x64/);
  assert.ok(packageJson.dependencies['electron-updater']);
  assert.ok(packageJson.dependencies['electron-log']);
  assert.deepEqual(packageJson.build.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.match(builderConfig, /process\.env\.CSC_LINK/);
  assert.match(builderConfig, /signAndEditExecutable:\s*signingConfigured/);
  assert.equal(packageJson.build.nsis.oneClick, true);
  assert.equal(packageJson.build.nsis.perMachine, false);
  assert.equal(packageJson.build.nsis.allowElevation, false);
  assert.equal(packageJson.build.publish.provider, 'generic');
  assert.equal(packageJson.build.publish.url, 'https://addwhatsapp.com/downloads/updates/win/stable/');
});

test('website policy supports stop, mandatory install, and revoked versions', () => {
  const policy = JSON.parse(read('website/public/downloads/latest/update.json'));

  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.enabled, true);
  assert.equal(policy.version, '0.1.5');
  assert.equal(policy.mandatoryOnNextLaunch, true);
  assert.deepEqual(policy.revokedVersions, []);
  assert.equal(policy.fileName, 'Add-WhatsApp-Setup.exe');
  assert.equal(policy.downloadUrl, '/downloads/latest/Add-WhatsApp-Setup.exe');
  assert.equal(policy.updateFeedUrl, '/downloads/updates/win/stable/');
});
