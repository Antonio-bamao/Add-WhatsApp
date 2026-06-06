const fs = require('node:fs');
const path = require('node:path');

const RETRY_DELAYS_MS = Object.freeze([
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000
]);
const MAX_INSTALL_FAILURES = 3;

function retryDelayMs(attempt) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, Number(attempt || 1) - 1));
  return RETRY_DELAYS_MS[index];
}

function classifyUpdateError(error, fallback = 'UPDATE_RUNTIME_ERROR') {
  const code = String(error && error.code ? error.code : '').toUpperCase();
  const message = String(error && error.message ? error.message : error || '');
  if (/sha-?512|checksum|integrity|hash mismatch/i.test(message)) return 'UPDATE_INTEGRITY_FAILED';
  if (code === 'ENOSPC' || /not enough space|disk full/i.test(message)) return 'UPDATE_DISK_FULL';
  if (['EACCES', 'EPERM', 'EROFS'].includes(code) || /permission denied|read-only/i.test(message)) {
    return 'UPDATE_CACHE_UNWRITABLE';
  }
  return fallback;
}

function normalizeVersion(value) {
  const version = String(value || '').trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('UPDATE_POLICY_INVALID');
  }
  return version;
}

function compareVersions(left, right) {
  const parse = value => {
    const normalized = normalizeVersion(value);
    const separatorIndex = normalized.indexOf('-');
    const core = separatorIndex === -1 ? normalized : normalized.slice(0, separatorIndex);
    const prerelease = separatorIndex === -1 ? null : normalized.slice(separatorIndex + 1);
    return {
      core: core.split('.').map(Number),
      prerelease: prerelease === null ? null : prerelease.split('.')
    };
  };
  const leftVersion = parse(left);
  const rightVersion = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftVersion.core[index] !== rightVersion.core[index]) {
      return leftVersion.core[index] > rightVersion.core[index] ? 1 : -1;
    }
  }
  if (leftVersion.prerelease === null && rightVersion.prerelease === null) return 0;
  if (leftVersion.prerelease === null) return 1;
  if (rightVersion.prerelease === null) return -1;
  const length = Math.max(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.prerelease[index];
    const rightPart = rightVersion.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) > Number(rightPart) ? 1 : -1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

function validateUpdatePolicy(value) {
  if (!value || Number(value.schemaVersion) !== 1 || typeof value.enabled !== 'boolean') {
    throw new Error('UPDATE_POLICY_INVALID');
  }
  return {
    schemaVersion: 1,
    enabled: value.enabled,
    version: normalizeVersion(value.version),
    mandatoryOnNextLaunch: value.mandatoryOnNextLaunch !== false,
    revokedVersions: Array.isArray(value.revokedVersions)
      ? [...new Set(value.revokedVersions.map(item => String(item || '').trim()).filter(Boolean))]
      : [],
    releaseNotesUrl: value.releaseNotesUrl ? String(value.releaseNotesUrl) : null
  };
}

class JsonUpdateStateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      return {};
    }
  }

  save(value) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2));
    fs.renameSync(temporaryPath, this.filePath);
    return { ...value };
  }
}

class UpdateManager {
  constructor({
    updater,
    currentVersion,
    policyLoader,
    stateStore,
    isTaskActive,
    prepareForInstall,
    now = () => new Date(),
    onStateChanged = () => {},
    clearUpdateCache = () => {},
    unsigned = true
  }) {
    this.updater = updater;
    this.currentVersion = currentVersion;
    this.policyLoader = policyLoader;
    this.stateStore = stateStore;
    this.isTaskActive = isTaskActive;
    this.prepareForInstall = prepareForInstall;
    this.now = now;
    this.onStateChanged = onStateChanged;
    this.clearUpdateCache = clearUpdateCache;
    this.policy = null;
    this.checkFailures = 0;
    this.downloadRequested = false;
    let persisted = stateStore.load();
    let pendingIsAlreadyInstalled = false;
    try {
      pendingIsAlreadyInstalled = persisted.pendingVersion
        && compareVersions(persisted.pendingVersion, currentVersion) <= 0;
    } catch {
      pendingIsAlreadyInstalled = Boolean(persisted.pendingVersion);
    }
    if (pendingIsAlreadyInstalled) {
      persisted = stateStore.save({
        ...persisted,
        pendingVersion: null,
        pendingVerified: false,
        pendingMandatory: false,
        installFailures: 0,
        installAttemptVersion: null,
        installAttemptAt: null,
        installedVersion: currentVersion
      });
    } else if (
      persisted.pendingVersion
      && persisted.installAttemptVersion === persisted.pendingVersion
    ) {
      persisted = stateStore.save({
        ...persisted,
        installFailures: Number(persisted.installFailures || 0) + 1,
        installAttemptVersion: null,
        installAttemptAt: null
      });
    }
    this.state = {
      status: persisted.installFailures >= MAX_INSTALL_FAILURES ? 'suspended' : 'idle',
      currentVersion,
      targetVersion: persisted.pendingVersion || null,
      percent: 0,
      mandatory: Boolean(persisted.pendingMandatory),
      errorCode: persisted.installFailures >= MAX_INSTALL_FAILURES ? 'UPDATE_INSTALL_SUSPENDED' : null,
      retryAt: null,
      unsigned: Boolean(unsigned),
      releaseNotesUrl: null
    };

    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.on('update-available', info => {
      this.handleUpdateAvailable(info).catch(error => this.handleError('UPDATE_DOWNLOAD_FAILED', error));
    });
    updater.on('update-not-available', () => {
      this.setState({ status: 'idle', targetVersion: null, percent: 0, errorCode: null });
    });
    updater.on('download-progress', progress => {
      this.setState({ status: 'downloading', percent: Number(progress.percent || 0) });
    });
    updater.on('update-downloaded', info => {
      try {
        this.handleUpdateDownloaded(info);
      } catch (error) {
        this.handleError('UPDATE_DOWNLOAD_FAILED', error);
      }
    });
    updater.on('error', error => this.handleError(null, error));
  }

  getState() {
    return { ...this.state };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.onStateChanged(this.getState());
  }

  async checkForUpdates() {
    if (this.state.status === 'suspended') {
      return { ok: false, errorCode: 'UPDATE_INSTALL_SUSPENDED' };
    }
    this.setState({ status: 'checking', errorCode: null, retryAt: null });
    try {
      this.policy = validateUpdatePolicy(await this.policyLoader());
      this.checkFailures = 0;
      this.setState({
        mandatory: this.policy.mandatoryOnNextLaunch,
        releaseNotesUrl: this.policy.releaseNotesUrl
      });
      if (!this.policy.enabled) {
        this.setState({ status: 'disabled', targetVersion: null });
        return { ok: true, disabled: true };
      }
      const persisted = this.stateStore.load();
      if (
        persisted.pendingVersion
        && persisted.pendingVerified
        && this.policy.revokedVersions.includes(persisted.pendingVersion)
      ) {
        this.clearPending('UPDATE_REVOKED');
        return { ok: false, errorCode: 'UPDATE_REVOKED' };
      }
      if (this.policy.revokedVersions.includes(this.policy.version)) {
        this.clearCachedUpdate();
        this.setState({
          status: 'revoked',
          targetVersion: this.policy.version,
          errorCode: 'UPDATE_REVOKED'
        });
        return { ok: false, errorCode: 'UPDATE_REVOKED' };
      }
      if (persisted.pendingVersion && persisted.pendingVerified) {
        const policyComparison = compareVersions(this.policy.version, persisted.pendingVersion);
        if (policyComparison === 0) {
          this.setState({
            status: 'downloaded',
            targetVersion: persisted.pendingVersion,
            percent: 100,
            mandatory: this.policy.mandatoryOnNextLaunch,
            errorCode: null
          });
          return { ok: true, pending: true };
        }
        if (policyComparison < 0) {
          this.setState({
            status: 'error',
            targetVersion: persisted.pendingVersion,
            errorCode: 'UPDATE_VERSION_MISMATCH'
          });
          return { ok: false, errorCode: 'UPDATE_VERSION_MISMATCH' };
        }
        this.clearPending();
      }
      await this.updater.checkForUpdates();
      return { ok: true };
    } catch (error) {
      this.checkFailures += 1;
      const retryAt = new Date(this.now().getTime() + retryDelayMs(this.checkFailures)).toISOString();
      this.setState({
        status: 'error',
        errorCode: 'UPDATE_CHECK_FAILED',
        retryAt
      });
      return { ok: false, errorCode: 'UPDATE_CHECK_FAILED', error: error.message };
    }
  }

  async handleUpdateAvailable(info = {}) {
    const targetVersion = normalizeVersion(info.version);
    if (compareVersions(targetVersion, this.currentVersion) <= 0) {
      this.setState({ status: 'idle', targetVersion: null, percent: 0, errorCode: null });
      return;
    }
    if (!this.policy || !this.policy.enabled || this.policy.version !== targetVersion) {
      this.setState({ status: 'error', targetVersion, errorCode: 'UPDATE_VERSION_MISMATCH' });
      return;
    }
    if (this.policy.revokedVersions.includes(targetVersion)) {
      if (this.state.status !== 'revoked' || this.state.targetVersion !== targetVersion) {
        this.clearCachedUpdate();
      }
      this.setState({ status: 'revoked', targetVersion, errorCode: 'UPDATE_REVOKED' });
      return;
    }
    this.setState({
      status: this.isTaskActive() ? 'waiting-for-idle' : 'available',
      targetVersion,
      mandatory: this.policy.mandatoryOnNextLaunch,
      errorCode: null
    });
    if (!this.isTaskActive()) await this.downloadAvailable();
  }

  async downloadAvailable() {
    if (this.downloadRequested || !this.state.targetVersion) return { ok: false };
    if (!this.policy || this.policy.revokedVersions.includes(this.state.targetVersion)) {
      this.setState({ status: 'revoked', errorCode: 'UPDATE_REVOKED' });
      return { ok: false, errorCode: 'UPDATE_REVOKED' };
    }
    this.downloadRequested = true;
    this.setState({ status: 'downloading', percent: 0 });
    try {
      await this.updater.downloadUpdate();
      return { ok: true };
    } catch (error) {
      this.downloadRequested = false;
      const errorCode = classifyUpdateError(error, 'UPDATE_DOWNLOAD_FAILED');
      this.handleError(errorCode, error);
      return { ok: false, errorCode };
    }
  }

  async notifyTaskIdle() {
    if (this.state.status !== 'waiting-for-idle' || this.isTaskActive()) return { ok: false };
    return this.downloadAvailable();
  }

  handleUpdateDownloaded(info = {}) {
    const targetVersion = normalizeVersion(info.version || this.state.targetVersion);
    if (
      !this.state.targetVersion
      || targetVersion !== this.state.targetVersion
      || !this.policy
      || targetVersion !== this.policy.version
    ) {
      this.clearCachedUpdate();
      this.setState({ status: 'error', targetVersion, errorCode: 'UPDATE_VERSION_MISMATCH' });
      return;
    }
    if (!this.policy || !this.policy.enabled || this.policy.revokedVersions.includes(targetVersion)) {
      this.setState({ status: 'revoked', targetVersion, errorCode: 'UPDATE_REVOKED' });
      return;
    }
    const persisted = this.stateStore.load();
    this.stateStore.save({
      ...persisted,
      pendingVersion: targetVersion,
      pendingVerified: true,
      pendingMandatory: this.policy.mandatoryOnNextLaunch,
      installFailures: persisted.pendingVersion === targetVersion
        ? Number(persisted.installFailures || 0)
        : 0
    });
    this.downloadRequested = false;
    this.setState({ status: 'downloaded', targetVersion, percent: 100, errorCode: null });
  }

  async installPending({ requireMandatory = false } = {}) {
    const persisted = this.stateStore.load();
    if (Number(persisted.installFailures || 0) >= MAX_INSTALL_FAILURES) {
      this.setState({ status: 'suspended', errorCode: 'UPDATE_INSTALL_SUSPENDED' });
      return { ok: false, errorCode: 'UPDATE_INSTALL_SUSPENDED' };
    }
    if (!persisted.pendingVersion || !persisted.pendingVerified) {
      return { ok: false, errorCode: 'NO_PENDING_UPDATE' };
    }
    try {
      this.policy = validateUpdatePolicy(await this.policyLoader());
    } catch (error) {
      this.setState({ status: 'error', errorCode: 'UPDATE_POLICY_UNAVAILABLE' });
      return { ok: false, errorCode: 'UPDATE_POLICY_UNAVAILABLE', error: error.message };
    }
    if (!this.policy.enabled) {
      this.setState({ status: 'disabled', errorCode: 'UPDATE_DISABLED' });
      return { ok: false, errorCode: 'UPDATE_DISABLED' };
    }
    if (requireMandatory && !this.policy.mandatoryOnNextLaunch) {
      this.setState({ status: 'downloaded', mandatory: false, errorCode: null });
      return { ok: false, errorCode: 'UPDATE_NOT_MANDATORY' };
    }
    if (this.policy.revokedVersions.includes(persisted.pendingVersion)) {
      this.clearPending('UPDATE_REVOKED');
      return { ok: false, errorCode: 'UPDATE_REVOKED' };
    }
    this.setState({ status: 'installing', targetVersion: persisted.pendingVersion, errorCode: null });
    const prepared = await this.prepareForInstall();
    if (!prepared || !prepared.ok) {
      return this.recordInstallFailure(prepared && prepared.errorCode ? prepared.errorCode : 'UPDATE_INSTALL_FAILED');
    }
    try {
      this.stateStore.save({
        ...this.stateStore.load(),
        installAttemptVersion: persisted.pendingVersion,
        installAttemptAt: this.now().toISOString()
      });
      this.updater.quitAndInstall(true, true);
      return { ok: true };
    } catch (error) {
      return this.recordInstallFailure('UPDATE_INSTALL_FAILED', error);
    }
  }

  recordInstallFailure(errorCode, error) {
    const persisted = this.stateStore.load();
    const installFailures = Number(persisted.installFailures || 0) + 1;
    this.stateStore.save({
      ...persisted,
      installFailures,
      installAttemptVersion: null,
      installAttemptAt: null
    });
    if (installFailures >= MAX_INSTALL_FAILURES) {
      this.setState({ status: 'suspended', errorCode: 'UPDATE_INSTALL_SUSPENDED' });
      return { ok: false, errorCode: 'UPDATE_INSTALL_SUSPENDED' };
    }
    this.setState({ status: 'error', errorCode });
    return { ok: false, errorCode, error: error && error.message };
  }

  clearPending(errorCode = null) {
    this.clearCachedUpdate();
    this.downloadRequested = false;
    const persisted = this.stateStore.load();
    this.stateStore.save({
      ...persisted,
      pendingVersion: null,
      pendingVerified: false,
      pendingMandatory: false,
      installAttemptVersion: null,
      installAttemptAt: null
    });
    this.setState({ status: errorCode ? 'revoked' : 'idle', targetVersion: null, errorCode });
  }

  handleError(errorCode, error) {
    const classified = classifyUpdateError(error, errorCode || 'UPDATE_RUNTIME_ERROR');
    if (classified === 'UPDATE_INTEGRITY_FAILED') this.clearCachedUpdate();
    this.setState({ status: 'error', errorCode: classified });
  }

  clearCachedUpdate() {
    try {
      return this.clearUpdateCache() !== false;
    } catch {
      return false;
    }
  }
}

module.exports = {
  classifyUpdateError,
  compareVersions,
  JsonUpdateStateStore,
  MAX_INSTALL_FAILURES,
  RETRY_DELAYS_MS,
  UpdateManager,
  retryDelayMs,
  validateUpdatePolicy
};
