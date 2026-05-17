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

test('loads legacy single history object', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-history-'));
  const filePath = path.join(dir, 'history.json');
  fs.writeFileSync(filePath, JSON.stringify({ id: 'legacy', startedAt: '2026-05-17T01:00:00.000Z' }));

  assert.deepEqual(new JsonHistoryStore(filePath).list().map(item => item.id), ['legacy']);
});

test('upserts existing history entry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-history-'));
  const store = new JsonHistoryStore(path.join(dir, 'history.json'));

  store.upsert({ id: 'run-1', reason: 'running', startedAt: '2026-05-17T01:00:00.000Z' });
  store.upsert({ id: 'run-1', reason: 'complete', finishedAt: '2026-05-17T01:10:00.000Z' });

  const items = store.list();
  assert.equal(items.length, 1);
  assert.equal(items[0].reason, 'complete');
  assert.equal(items[0].finishedAt, '2026-05-17T01:10:00.000Z');
});

test('marks running history entries interrupted after restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-history-'));
  const store = new JsonHistoryStore(path.join(dir, 'history.json'));

  store.upsert({ id: 'run-1', reason: 'running', startedAt: '2026-05-17T01:00:00.000Z' });
  store.markOpenInterrupted('2026-05-17T01:05:00.000Z');

  const items = store.list();
  assert.equal(items[0].reason, 'interrupted');
  assert.equal(items[0].finishedAt, '2026-05-17T01:05:00.000Z');
});
