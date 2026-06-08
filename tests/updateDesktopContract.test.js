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
  assert.match(main, /UPDATE_STARTUP_DELAY_MS\s*=\s*5\s*\*\s*1000/);
  assert.match(main, /UPDATE_CHECK_INTERVAL_MS\s*=\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(main, /updateRetryTimer/);
  assert.match(main, /Date\.parse\(state\.retryAt\)/);
  assert.match(main, /installPending\(\{\s*requireMandatory:\s*true\s*\}\)/);
  assert.match(main, /shouldSurfaceMandatoryUpdate/);
  assert.match(main, /mainWindow\.show\(\)/);
  assert.match(main, /mainWindow\.focus\(\)/);
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

test('mandatory updates surface as a blocking modal and auto-install after download', () => {
  const html = read('src/renderer/index.html');
  const renderer = read('src/renderer/renderer.js');
  const styles = read('src/renderer/styles.css');

  for (const id of [
    'forcedUpdateModal',
    'forcedUpdateTitle',
    'forcedUpdateDetail',
    'forcedUpdateProgress',
    'forcedUpdateStatus',
    'forcedUpdateInstallButton',
    'forcedUpdateRetryButton'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(renderer, new RegExp(id));
  }
  assert.match(renderer, /shouldShowForcedUpdateModal/);
  assert.match(renderer, /renderForcedUpdateModal/);
  assert.match(renderer, /maybeInstallMandatoryUpdate/);
  assert.match(renderer, /mandatoryUpdateInstallRequested/);
  assert.match(renderer, /update\.mandatory\s*&&\s*update\.status\s*===\s*'downloaded'/);
  assert.match(renderer, /installPendingUpdate\(\{\s*automatic:\s*true\s*\}\)/);
  assert.match(renderer, /forcedUpdateModal\.hidden\s*=\s*!shouldShow/);
  assert.match(styles, /\.forced-update-modal/);
  assert.match(styles, /\.forced-update-progress/);
});

test('Windows build is a per-user x64 NSIS installer with a generic update provider', () => {
  const packageJson = JSON.parse(read('package.json'));
  const builderConfig = read('electron-builder.config.js');

  assert.equal(packageJson.version, '0.1.7');
  assert.match(packageJson.scripts.build, /electron-builder --config electron-builder\.config\.js --win nsis --x64/);
  assert.ok(packageJson.dependencies['electron-updater']);
  assert.ok(packageJson.dependencies['electron-log']);
  assert.deepEqual(packageJson.build.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.equal(packageJson.build.afterPack, 'scripts/after-pack-icon.js');
  assert.match(builderConfig, /signAndEditExecutable:\s*false/);
  assert.match(builderConfig, /forceCodeSigning:\s*false/);
  const afterPackIcon = read('scripts/after-pack-icon.js');
  assert.match(afterPackIcon, /rcedit/);
  assert.match(afterPackIcon, /import\('rcedit'\)/);
  assert.match(afterPackIcon, /icon:\s*iconPath/);
  assert.match(afterPackIcon, /path\.join\(projectDir,\s*'assets',\s*'icon\.ico'\)/);
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
  assert.equal(policy.version, '0.1.7');
  assert.equal(policy.mandatoryOnNextLaunch, true);
  assert.deepEqual(policy.revokedVersions, []);
  assert.equal(policy.fileName, 'Add-WhatsApp-Setup.exe');
  assert.equal(policy.downloadUrl, '/downloads/latest/Add-WhatsApp-Setup.exe');
  assert.equal(policy.updateFeedUrl, '/downloads/updates/win/stable/');
});
