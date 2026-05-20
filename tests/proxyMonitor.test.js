const test = require('node:test');
const assert = require('node:assert/strict');

const { ProxyMonitor } = require('../src/main/proxyMonitor');

test('passes when proxy connectivity and exit IP match the baseline', async () => {
  const monitor = new ProxyMonitor({
    loadSettings: () => ({ host: '1.1.1.1', port: 1080, baselineIp: '186.192.1.1' }),
    testProxy: async () => ({ ok: true, exitIp: '186.192.1.1', checkedAt: '2026-05-20T12:00:00.000Z' }),
    saveSettings: settings => settings
  });

  const result = await monitor.checkNow();

  assert.equal(result.ok, true);
  assert.equal(result.exitIp, '186.192.1.1');
});

test('stores baseline IP after the first successful check', async () => {
  let saved = null;
  const monitor = new ProxyMonitor({
    loadSettings: () => ({ host: '1.1.1.1', port: 1080 }),
    testProxy: async () => ({ ok: true, exitIp: '186.192.1.1', checkedAt: '2026-05-20T12:00:00.000Z' }),
    saveSettings: settings => {
      saved = settings;
      return settings;
    }
  });

  const result = await monitor.checkNow();

  assert.equal(result.ok, true);
  assert.equal(saved.baselineIp, '186.192.1.1');
  assert.equal(saved.lastExitIp, '186.192.1.1');
});

test('fails when exit IP changes from the saved baseline', async () => {
  const monitor = new ProxyMonitor({
    loadSettings: () => ({ host: '1.1.1.1', port: 1080, baselineIp: '186.192.1.1' }),
    testProxy: async () => ({ ok: true, exitIp: '203.0.113.8', checkedAt: '2026-05-20T12:00:00.000Z' }),
    saveSettings: settings => settings
  });

  const result = await monitor.checkNow();

  assert.equal(result.ok, false);
  assert.match(result.error, /出口 IP 已变化/);
});

test('fails when no proxy settings are saved', async () => {
  const monitor = new ProxyMonitor({
    loadSettings: () => null,
    testProxy: async () => ({ ok: true })
  });

  const result = await monitor.checkNow();

  assert.equal(result.ok, false);
  assert.match(result.error, /请先保存/);
});
