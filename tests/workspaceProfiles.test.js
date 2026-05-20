const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createWorkspaceId,
  parseWorkspaceId,
  parseWorkspaceProxy,
  normalizeProxyServer,
  workspaceUserDataPath,
  workspaceLaunchArgs
} = require('../src/main/workspaceProfiles');

test('creates safe workspace ids for separate local profiles', () => {
  assert.match(createWorkspaceId(), /^workspace-\d{8}-[a-f0-9]{8}$/);
});

test('parses only safe workspace ids from command line args', () => {
  assert.equal(parseWorkspaceId(['app.exe', '--add-whatsapp-workspace=workspace-20260520-a1b2c3d4']), 'workspace-20260520-a1b2c3d4');
  assert.equal(parseWorkspaceId(['app.exe', '--add-whatsapp-workspace=../bad']), null);
  assert.equal(parseWorkspaceId(['app.exe']), null);
});

test('builds isolated userData paths under the app data root', () => {
  assert.equal(
    workspaceUserDataPath('C:\\Users\\demo\\AppData\\Roaming', 'workspace-20260520-a1b2c3d4'),
    path.join('C:\\Users\\demo\\AppData\\Roaming', 'add-whatsapp-desktop-workspaces', 'workspace-20260520-a1b2c3d4')
  );
});

test('builds launch args for packaged and development modes', () => {
  assert.deepEqual(
    workspaceLaunchArgs({ isPackaged: true, appPath: 'C:\\app', workspaceId: 'workspace-20260520-a1b2c3d4' }),
    ['--add-whatsapp-workspace=workspace-20260520-a1b2c3d4']
  );
  assert.deepEqual(
    workspaceLaunchArgs({ isPackaged: false, appPath: 'C:\\repo', workspaceId: 'workspace-20260520-a1b2c3d4' }),
    ['C:\\repo', '--add-whatsapp-workspace=workspace-20260520-a1b2c3d4']
  );
});

test('normalizes SOCKS5 proxy addresses for secondary workspaces', () => {
  assert.equal(normalizeProxyServer('186.192.1.1:1080'), 'socks5://186.192.1.1:1080');
  assert.equal(normalizeProxyServer('socks5://186.192.1.1:1080'), 'socks5://186.192.1.1:1080');
  assert.equal(normalizeProxyServer('  '), null);
  assert.throws(() => normalizeProxyServer('http://186.192.1.1:8080'), /SOCKS5/);
  assert.throws(() => normalizeProxyServer('socks5://bad host:1080'), /代理格式/);
});

test('passes SOCKS5 proxy launch args only when provided', () => {
  assert.deepEqual(
    workspaceLaunchArgs({
      isPackaged: true,
      appPath: 'C:\\app',
      workspaceId: 'workspace-20260520-a1b2c3d4',
      proxyServer: 'socks5://186.192.1.1:1080'
    }),
    [
      '--add-whatsapp-workspace=workspace-20260520-a1b2c3d4',
      '--add-whatsapp-proxy=socks5://186.192.1.1:1080'
    ]
  );
});

test('parses SOCKS5 proxy args from secondary workspace launch', () => {
  assert.equal(parseWorkspaceProxy(['app.exe', '--add-whatsapp-proxy=socks5://186.192.1.1:1080']), 'socks5://186.192.1.1:1080');
  assert.equal(parseWorkspaceProxy(['app.exe', '--add-whatsapp-proxy=http://bad:8080']), null);
});
