const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  WorkspaceProcessRegistry,
  workspaceRuntimeDirectory
} = require('../src/main/workspaceProcessRegistry');

test('uses one shared runtime directory for main and secondary workspaces', () => {
  assert.equal(
    workspaceRuntimeDirectory('C:\\Users\\test\\AppData\\Roaming'),
    path.join('C:\\Users\\test\\AppData\\Roaming', 'add-whatsapp-desktop-runtime')
  );
});

test('registers heartbeat and task state without using workspace userData', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-runtime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const registry = new WorkspaceProcessRegistry({
    directory,
    workspaceId: 'main',
    pid: 1234,
    now: () => new Date('2026-06-06T00:00:00.000Z')
  });

  registry.start();
  registry.setTaskActive(true);
  const entries = registry.listActive({ isProcessAlive: pid => pid === 1234 });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].workspaceId, 'main');
  assert.equal(entries[0].taskActive, true);
  registry.stop();
});

test('shutdown request is observed once by another workspace', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-shutdown-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let shutdowns = 0;
  const secondary = new WorkspaceProcessRegistry({
    directory,
    workspaceId: 'workspace-20260606-1234abcd',
    pid: 2222,
    onShutdownRequested: async () => {
      shutdowns += 1;
    }
  });
  secondary.start();

  const main = new WorkspaceProcessRegistry({
    directory,
    workspaceId: 'main',
    pid: 1111
  });
  main.start();
  main.requestShutdownOthers();
  await secondary.pollShutdownRequest();
  await secondary.pollShutdownRequest();

  assert.equal(shutdowns, 1);
  secondary.stop();
  main.stop();
});

test('workspace ignores shutdown requests created before it starts', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-old-shutdown-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const main = new WorkspaceProcessRegistry({
    directory,
    workspaceId: 'main',
    pid: 1111
  });
  main.requestShutdownOthers();

  let shutdowns = 0;
  const lateWorkspace = new WorkspaceProcessRegistry({
    directory,
    workspaceId: 'late-workspace',
    pid: 2222,
    onShutdownRequested: async () => {
      shutdowns += 1;
    }
  });
  lateWorkspace.start();
  await lateWorkspace.pollShutdownRequest();

  assert.equal(shutdowns, 0);
  lateWorkspace.stop();
});

test('waits for other workspaces and times out without killing them', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-wait-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const main = new WorkspaceProcessRegistry({
    directory,
    workspaceId: 'main',
    pid: 1111
  });
  main.start();
  fs.writeFileSync(path.join(directory, 'workspace-2222.json'), JSON.stringify({
    pid: 2222,
    workspaceId: 'secondary',
    heartbeatAt: new Date().toISOString(),
    taskActive: false
  }));

  const result = await main.waitForOtherWorkspaces({
    timeoutMs: 5,
    pollMs: 1,
    isProcessAlive: () => true
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'WORKSPACES_BUSY');
  assert.equal(result.remaining.length, 1);
  main.stop();
});
