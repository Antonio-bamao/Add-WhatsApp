const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const {
  UpdateManager,
  classifyUpdateError,
  compareVersions,
  retryDelayMs,
  validateUpdatePolicy
} = require('../src/main/updateManager');

class MemoryStateStore {
  constructor(initial = {}) {
    this.value = { ...initial };
  }

  load() {
    return { ...this.value };
  }

  save(value) {
    this.value = { ...value };
    return this.load();
  }
}

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.autoDownload = true;
    this.autoInstallOnAppQuit = true;
    this.checks = 0;
    this.downloads = 0;
    this.installs = 0;
  }

  async checkForUpdates() {
    this.checks += 1;
    return { updateInfo: { version: '0.1.6' } };
  }

  async downloadUpdate() {
    this.downloads += 1;
    return ['cached-installer.exe'];
  }

  quitAndInstall() {
    this.installs += 1;
  }
}

function validPolicy(overrides = {}) {
  return {
    schemaVersion: 1,
    enabled: true,
    version: '0.1.6',
    mandatoryOnNextLaunch: true,
    revokedVersions: [],
    releaseNotesUrl: 'https://addwhatsapp.com/releases',
    ...overrides
  };
}

function createManager(options = {}) {
  const updater = options.updater || new FakeUpdater();
  const stateStore = options.stateStore || new MemoryStateStore();
  const states = [];
  const manager = new UpdateManager({
    updater,
    currentVersion: '0.1.5',
    policyLoader: options.policyLoader || (async () => validPolicy()),
    stateStore,
    isTaskActive: options.isTaskActive || (() => false),
    prepareForInstall: options.prepareForInstall || (async () => ({ ok: true })),
    now: options.now || (() => new Date('2026-06-06T00:00:00.000Z')),
    onStateChanged: state => states.push(state),
    clearUpdateCache: options.clearUpdateCache || (() => {}),
    unsigned: true
  });
  return { manager, updater, stateStore, states };
}

test('retry delay uses 15 minutes, 1 hour, then 6 hours', () => {
  assert.equal(retryDelayMs(1), 15 * 60 * 1000);
  assert.equal(retryDelayMs(2), 60 * 60 * 1000);
  assert.equal(retryDelayMs(3), 6 * 60 * 60 * 1000);
  assert.equal(retryDelayMs(9), 6 * 60 * 60 * 1000);
});

test('compares stable and prerelease versions', () => {
  assert.equal(compareVersions('0.1.6', '0.1.5'), 1);
  assert.equal(compareVersions('0.1.5', '0.1.5'), 0);
  assert.equal(compareVersions('0.1.5-beta.2', '0.1.5-beta.10'), -1);
  assert.equal(compareVersions('0.1.5', '0.1.5-beta.10'), 1);
});

test('classifies integrity, disk, and cache permission failures', () => {
  assert.equal(classifyUpdateError(new Error('sha512 checksum mismatch')), 'UPDATE_INTEGRITY_FAILED');
  assert.equal(classifyUpdateError(Object.assign(new Error('full'), { code: 'ENOSPC' })), 'UPDATE_DISK_FULL');
  assert.equal(classifyUpdateError(Object.assign(new Error('denied'), { code: 'EACCES' })), 'UPDATE_CACHE_UNWRITABLE');
});

test('validates update policy fields and normalizes revoked versions', () => {
  const policy = validateUpdatePolicy(validPolicy({ revokedVersions: ['0.1.4', ' 0.1.3 '] }));
  assert.deepEqual(policy.revokedVersions, ['0.1.4', '0.1.3']);
  assert.throws(() => validateUpdatePolicy({ enabled: true }), /UPDATE_POLICY_INVALID/);
});

test('waits for an active task before downloading an available update', async () => {
  let active = true;
  const { manager, updater } = createManager({ isTaskActive: () => active });

  await manager.checkForUpdates();
  updater.emit('update-available', { version: '0.1.6' });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(manager.getState().status, 'waiting-for-idle');
  assert.equal(updater.downloads, 0);

  active = false;
  await manager.notifyTaskIdle();
  assert.equal(updater.downloads, 1);
});

test('blocks a revoked update before download', async () => {
  let cacheClears = 0;
  const { manager, updater } = createManager({
    policyLoader: async () => validPolicy({ revokedVersions: ['0.1.6'] }),
    clearUpdateCache: () => {
      cacheClears += 1;
    }
  });

  await manager.checkForUpdates();
  updater.emit('update-available', { version: '0.1.6' });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(manager.getState().status, 'revoked');
  assert.equal(manager.getState().errorCode, 'UPDATE_REVOKED');
  assert.equal(updater.downloads, 0);
  assert.equal(cacheClears, 1);
});

test('rejects an update-downloaded event whose version differs from the available update', async () => {
  let cacheClears = 0;
  const { manager, updater, stateStore } = createManager({
    clearUpdateCache: () => {
      cacheClears += 1;
    }
  });

  await manager.checkForUpdates();
  updater.emit('update-available', { version: '0.1.6' });
  await new Promise(resolve => setImmediate(resolve));
  updater.emit('update-downloaded', { version: '0.1.7' });

  assert.equal(manager.getState().status, 'error');
  assert.equal(manager.getState().errorCode, 'UPDATE_VERSION_MISMATCH');
  assert.equal(stateStore.load().pendingVersion, undefined);
  assert.equal(cacheClears, 1);
});

test('persists a verified pending update and installs it after coordinated shutdown', async () => {
  let prepared = 0;
  const { manager, updater, stateStore } = createManager({
    prepareForInstall: async () => {
      prepared += 1;
      return { ok: true };
    }
  });

  await manager.checkForUpdates();
  updater.emit('update-available', { version: '0.1.6' });
  await new Promise(resolve => setImmediate(resolve));
  updater.emit('update-downloaded', { version: '0.1.6' });

  assert.equal(stateStore.load().pendingVersion, '0.1.6');
  assert.equal(manager.getState().status, 'downloaded');

  const result = await manager.installPending();
  assert.equal(result.ok, true);
  assert.equal(prepared, 1);
  assert.equal(updater.installs, 1);
});

test('keeps a matching downloaded update without checking or downloading it again', async () => {
  const stateStore = new MemoryStateStore({
    pendingVersion: '0.1.6',
    pendingVerified: true,
    pendingMandatory: true,
    installFailures: 0
  });
  const { manager, updater } = createManager({ stateStore });

  const result = await manager.checkForUpdates();

  assert.equal(result.ok, true);
  assert.equal(result.pending, true);
  assert.equal(updater.checks, 0);
  assert.equal(updater.downloads, 0);
  assert.equal(manager.getState().status, 'downloaded');
});

test('clears an older pending download before checking for a newer release', async () => {
  let cacheClears = 0;
  const stateStore = new MemoryStateStore({
    pendingVersion: '0.1.6',
    pendingVerified: true,
    pendingMandatory: true,
    installFailures: 0
  });
  const { manager, updater } = createManager({
    stateStore,
    policyLoader: async () => validPolicy({ version: '0.1.7' }),
    clearUpdateCache: () => {
      cacheClears += 1;
    }
  });

  await manager.checkForUpdates();

  assert.equal(cacheClears, 1);
  assert.equal(stateStore.load().pendingVersion, null);
  assert.equal(updater.checks, 1);
});

test('three install failures trip the safety circuit breaker', async () => {
  const stateStore = new MemoryStateStore({
    pendingVersion: '0.1.6',
    pendingVerified: true,
    installFailures: 2
  });
  const { manager, updater } = createManager({
    stateStore,
    prepareForInstall: async () => ({ ok: false, errorCode: 'WORKSPACES_BUSY' })
  });

  const result = await manager.installPending();

  assert.equal(result.ok, false);
  assert.equal(updater.installs, 0);
  assert.equal(manager.getState().status, 'suspended');
  assert.equal(manager.getState().errorCode, 'UPDATE_INSTALL_SUSPENDED');
  assert.equal(stateStore.load().installFailures, 3);
});

test('an install attempt that returns to the old version counts as a failure', () => {
  const stateStore = new MemoryStateStore({
    pendingVersion: '0.1.6',
    pendingVerified: true,
    pendingMandatory: true,
    installFailures: 2,
    installAttemptVersion: '0.1.6',
    installAttemptAt: '2026-06-05T00:00:00.000Z'
  });

  const { manager } = createManager({ stateStore });

  assert.equal(stateStore.load().installFailures, 3);
  assert.equal(stateStore.load().installAttemptVersion, null);
  assert.equal(manager.getState().status, 'suspended');
  assert.equal(manager.getState().errorCode, 'UPDATE_INSTALL_SUSPENDED');
});

test('rechecks policy before installing a previously downloaded update', async () => {
  const stateStore = new MemoryStateStore({
    pendingVersion: '0.1.6',
    pendingVerified: true,
    installFailures: 0
  });
  const { manager, updater } = createManager({
    stateStore,
    policyLoader: async () => validPolicy({ enabled: false })
  });

  const result = await manager.installPending();

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'UPDATE_DISABLED');
  assert.equal(updater.installs, 0);
});

test('does not force a pending update when the server removes mandatory status', async () => {
  const stateStore = new MemoryStateStore({
    pendingVersion: '0.1.6',
    pendingVerified: true,
    pendingMandatory: true,
    installFailures: 0
  });
  const { manager, updater } = createManager({
    stateStore,
    policyLoader: async () => validPolicy({ mandatoryOnNextLaunch: false })
  });

  const result = await manager.installPending({ requireMandatory: true });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'UPDATE_NOT_MANDATORY');
  assert.equal(updater.installs, 0);
});

test('clears a pending marker after the installed version starts', () => {
  const stateStore = new MemoryStateStore({
    pendingVersion: '0.1.5',
    pendingVerified: true,
    pendingMandatory: true,
    installFailures: 1
  });

  createManager({ stateStore });

  assert.equal(stateStore.load().pendingVersion, null);
  assert.equal(stateStore.load().pendingVerified, false);
  assert.equal(stateStore.load().installFailures, 0);
});

test('check failures preserve the old version and schedule retry', async () => {
  const { manager } = createManager({
    policyLoader: async () => {
      throw new Error('offline');
    }
  });

  const result = await manager.checkForUpdates();
  assert.equal(result.ok, false);
  assert.equal(manager.getState().status, 'error');
  assert.equal(manager.getState().errorCode, 'UPDATE_CHECK_FAILED');
  assert.equal(manager.getState().retryAt, '2026-06-06T00:15:00.000Z');
});
