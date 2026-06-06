const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PendingContactImportStore } = require('../src/core/pendingContactImportStore');

test('stores pending contact import audits by client key and removes them after retry succeeds', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-pending-contact-import-'));
  const store = new PendingContactImportStore(path.join(dir, 'pending-contact-imports.json'));
  const payload = {
    clientImportKey: 'contact-import-key-1',
    originalFileName: 'customers.xlsx',
    originalSha256: 'sha256-raw-file',
    parsedRowsGzipBase64: 'gzip-base64'
  };

  store.upsert({ payload, reason: 'CLOUD_API_TIMEOUT' });
  store.upsert({ payload: { ...payload, stats: { total: 16630 } }, reason: 'AUTH_REQUIRED' });

  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].clientImportKey, 'contact-import-key-1');
  assert.equal(store.list()[0].payload.stats.total, 16630);
  assert.equal(store.list()[0].attempts, 0);

  store.markAttempt('contact-import-key-1', 'retry failed');
  assert.equal(store.list()[0].attempts, 1);
  assert.equal(store.list()[0].reason, 'retry failed');

  store.remove('contact-import-key-1');

  assert.deepEqual(store.list(), []);
});

test('keeps permanent and exhausted contact import audits but excludes them from retry list', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-pending-contact-import-'));
  const store = new PendingContactImportStore(path.join(dir, 'pending-contact-imports.json'));
  const permanentPayload = {
    clientImportKey: 'contact-import-permanent',
    originalFileName: 'too-large.xlsx'
  };
  const exhaustedPayload = {
    clientImportKey: 'contact-import-exhausted',
    originalFileName: 'timeout.xlsx'
  };
  const retryablePayload = {
    clientImportKey: 'contact-import-retryable',
    originalFileName: 'temporary.xlsx'
  };

  store.upsert({ payload: permanentPayload, reason: 'PERMANENT_HTTP_413:CLOUD_API_413' });
  store.upsert({ payload: exhaustedPayload, reason: 'HTTP_504:CLOUD_API_TIMEOUT' });
  store.upsert({ payload: retryablePayload, reason: 'NETWORK:ECONNRESET' });
  for (let i = 0; i < 8; i += 1) {
    store.markAttempt('contact-import-exhausted', 'HTTP_504:CLOUD_API_TIMEOUT');
  }

  const allItems = store.list();
  assert.equal(allItems.length, 3);
  assert.equal(allItems.find(item => item.clientImportKey === 'contact-import-permanent').giveUp, true);
  assert.equal(allItems.find(item => item.clientImportKey === 'contact-import-exhausted').giveUp, true);
  assert.equal(allItems.find(item => item.clientImportKey === 'contact-import-retryable').giveUp, false);

  assert.deepEqual(
    store.list({ retryableOnly: true }).map(item => item.clientImportKey),
    ['contact-import-retryable']
  );
});
