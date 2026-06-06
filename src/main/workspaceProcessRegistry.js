const fs = require('node:fs');
const path = require('node:path');

const RUNTIME_DIRECTORY_NAME = 'add-whatsapp-desktop-runtime';
const HEARTBEAT_INTERVAL_MS = 2000;
const STALE_HEARTBEAT_MS = 15000;

function workspaceRuntimeDirectory(appDataPath) {
  return path.join(appDataPath, RUNTIME_DIRECTORY_NAME);
}

function defaultIsProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class WorkspaceProcessRegistry {
  constructor({
    directory,
    workspaceId,
    pid = process.pid,
    now = () => new Date(),
    onShutdownRequested = async () => {}
  }) {
    this.directory = directory;
    this.workspaceId = workspaceId;
    this.pid = pid;
    this.now = now;
    this.onShutdownRequested = onShutdownRequested;
    this.taskActive = false;
    this.heartbeatTimer = null;
    this.shutdownPollTimer = null;
    this.lastShutdownRequestId = null;
  }

  get entryPath() {
    return path.join(this.directory, `workspace-${this.pid}.json`);
  }

  get shutdownRequestPath() {
    return path.join(this.directory, 'shutdown-request.json');
  }

  start() {
    fs.mkdirSync(this.directory, { recursive: true });
    try {
      const existingRequest = JSON.parse(fs.readFileSync(this.shutdownRequestPath, 'utf8'));
      this.lastShutdownRequestId = existingRequest.id || null;
    } catch {
      this.lastShutdownRequestId = null;
    }
    this.writeHeartbeat();
    this.heartbeatTimer = setInterval(() => this.writeHeartbeat(), HEARTBEAT_INTERVAL_MS);
    this.shutdownPollTimer = setInterval(() => {
      this.pollShutdownRequest().catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    if (typeof this.heartbeatTimer.unref === 'function') this.heartbeatTimer.unref();
    if (typeof this.shutdownPollTimer.unref === 'function') this.shutdownPollTimer.unref();
  }

  stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.shutdownPollTimer) clearInterval(this.shutdownPollTimer);
    this.heartbeatTimer = null;
    this.shutdownPollTimer = null;
    try {
      fs.rmSync(this.entryPath, { force: true });
    } catch {
      // The OS will age out a stale heartbeat if cleanup cannot run.
    }
  }

  setTaskActive(active) {
    this.taskActive = Boolean(active);
    this.writeHeartbeat();
  }

  writeHeartbeat() {
    fs.mkdirSync(this.directory, { recursive: true });
    const value = {
      pid: this.pid,
      workspaceId: this.workspaceId,
      heartbeatAt: this.now().toISOString(),
      taskActive: this.taskActive
    };
    const temporaryPath = `${this.entryPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(value));
    fs.renameSync(temporaryPath, this.entryPath);
  }

  listActive({
    isProcessAlive = defaultIsProcessAlive,
    staleAfterMs = STALE_HEARTBEAT_MS
  } = {}) {
    if (!fs.existsSync(this.directory)) return [];
    const nowMs = this.now().getTime();
    return fs.readdirSync(this.directory)
      .filter(name => /^workspace-\d+\.json$/.test(name))
      .flatMap(name => {
        const filePath = path.join(this.directory, name);
        try {
          const entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const heartbeatMs = Date.parse(entry.heartbeatAt);
          if (!Number.isInteger(entry.pid) || !Number.isFinite(heartbeatMs)) return [];
          if (nowMs - heartbeatMs > staleAfterMs || !isProcessAlive(entry.pid)) {
            try {
              fs.rmSync(filePath, { force: true });
            } catch {
              // Ignore cleanup failure; the entry is still excluded.
            }
            return [];
          }
          return [entry];
        } catch {
          return [];
        }
      });
  }

  requestShutdownOthers() {
    fs.mkdirSync(this.directory, { recursive: true });
    const request = {
      id: `${this.pid}-${Date.now()}`,
      requesterPid: this.pid,
      requestedAt: this.now().toISOString()
    };
    fs.writeFileSync(this.shutdownRequestPath, JSON.stringify(request));
    return request;
  }

  async pollShutdownRequest() {
    if (!fs.existsSync(this.shutdownRequestPath)) return false;
    const request = JSON.parse(fs.readFileSync(this.shutdownRequestPath, 'utf8'));
    if (!request.id || request.id === this.lastShutdownRequestId || request.requesterPid === this.pid) {
      return false;
    }
    this.lastShutdownRequestId = request.id;
    await this.onShutdownRequested(request);
    return true;
  }

  async waitForOtherWorkspaces({
    timeoutMs = 120000,
    pollMs = 500,
    isProcessAlive = defaultIsProcessAlive
  } = {}) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const remaining = this.listActive({ isProcessAlive }).filter(entry => entry.pid !== this.pid);
      if (!remaining.length) return { ok: true, remaining: [] };
      await delay(pollMs);
    }
    const remaining = this.listActive({ isProcessAlive }).filter(entry => entry.pid !== this.pid);
    return { ok: false, errorCode: 'WORKSPACES_BUSY', remaining };
  }
}

module.exports = {
  HEARTBEAT_INTERVAL_MS,
  STALE_HEARTBEAT_MS,
  WorkspaceProcessRegistry,
  workspaceRuntimeDirectory
};
