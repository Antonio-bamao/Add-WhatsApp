const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { JsonHistoryStore } = require('../src/core/historyStore');

test('loads empty history when file does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-history-'));
  const store = new JsonHistoryStore(path.join(dir, 'history.json'));

  assert.deepEqual(store.list(), []);
});

test('appends history newest first', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-history-'));
  const filePath = path.join(dir, 'history.json');
  const store = new JsonHistoryStore(filePath);

  store.append({ id: 'a', startedAt: '2026-05-17T01:00:00.000Z', stats: { sent: 1 } });
  store.append({ id: 'b', startedAt: '2026-05-17T02:00:00.000Z', stats: { sent: 2 } });

  assert.deepEqual(new JsonHistoryStore(filePath).list().map(item => item.id), ['b', 'a']);
});
