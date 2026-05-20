const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  JsonProxySettingsStore,
  buildProxyServer,
  normalizeProxySettings,
  publicProxySettings
} = require('../src/main/proxySettings');

test('normalizes SOCKS5 proxy settings with optional credentials', () => {
  const settings = normalizeProxySettings({
    type: 'socks5',
    host: ' 86.104.162.245 ',
    port: '12324',
    username: '14a48146afb4a',
    password: 'secret',
    ipMode: 'ipv4',
    lookupChannel: 'IP2Location',
    changeReminder: true
  });

  assert.equal(settings.host, '86.104.162.245');
  assert.equal(settings.port, 12324);
  assert.equal(settings.username, '14a48146afb4a');
  assert.equal(settings.password, 'secret');
  assert.equal(settings.ipMode, 'ipv4');
  assert.equal(settings.lookupChannel, 'IP2Location');
  assert.equal(settings.changeReminder, true);
});

test('rejects unsafe proxy settings', () => {
  assert.throws(() => normalizeProxySettings({ type: 'http', host: '1.1.1.1', port: 8080 }), /SOCKS5/);
  assert.throws(() => normalizeProxySettings({ type: 'socks5', host: 'bad host', port: 1080 }), /代理主机/);
  assert.throws(() => normalizeProxySettings({ type: 'socks5', host: '1.1.1.1', port: 70000 }), /代理端口/);
});

test('builds a Chromium proxy-server value without leaking credentials', () => {
  assert.equal(
    buildProxyServer({ type: 'socks5', host: '86.104.162.245', port: 12324, username: 'u', password: 'p' }),
    'socks5://86.104.162.245:12324'
  );
});

test('builds Chromium proxy-server value for IPv6 proxy hosts', () => {
  assert.equal(
    buildProxyServer({ type: 'socks5', host: '2001:db8::10', port: 12324 }),
    'socks5://[2001:db8::10]:12324'
  );
});

test('persists secondary workspace proxy settings and hides password from public state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-proxy-'));
  const store = new JsonProxySettingsStore(path.join(dir, 'proxy.json'));

  store.save({
    type: 'socks5',
    host: '86.104.162.245',
    port: 12324,
    username: 'u',
    password: 'secret'
  });

  const loaded = store.load();
  assert.equal(loaded.password, 'secret');
  assert.equal(publicProxySettings(loaded).hasPassword, true);
  assert.equal(publicProxySettings(loaded).password, undefined);
});

test('preserves original saved time when proxy monitor updates check metadata', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-proxy-'));
  const store = new JsonProxySettingsStore(path.join(dir, 'proxy.json'));

  const saved = store.save({
    type: 'socks5',
    host: '86.104.162.245',
    port: 12324,
    savedAt: '2026-05-20T10:00:00.000Z',
    lastCheckedAt: '2026-05-20T10:00:00.000Z'
  });

  const updated = store.save({
    ...saved,
    lastCheckedAt: '2026-05-20T10:05:00.000Z'
  });

  assert.equal(updated.savedAt, '2026-05-20T10:00:00.000Z');
  assert.equal(updated.lastCheckedAt, '2026-05-20T10:05:00.000Z');
});
