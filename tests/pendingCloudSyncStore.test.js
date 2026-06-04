const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PendingCloudSyncStore } = require('../src/core/pendingCloudSyncStore');

test('stores pending cloud usage syncs by task and removes them after retry succeeds', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-pending-sync-'));
  const store = new PendingCloudSyncStore(path.join(dir, 'pending-sync.json'));

  store.upsert({
    taskId: 'task-1',
    sentRows: [{ rowNumber: 2, whatsappId: '5511999999999@c.us' }],
    workspaceId: 'main',
    sentAt: '2026-06-03T10:00:00.000Z',
    reason: 'UNAUTHORIZED'
  });
  store.upsert({
    taskId: 'task-1',
    sentRows: [{ rowNumber: 2, whatsappId: '5511999999999@c.us' }],
    workspaceId: 'main',
    sentAt: '2026-06-03T10:00:00.000Z',
    reason: 'UNAUTHORIZED'
  });

  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].taskId, 'task-1');
  assert.equal(store.list()[0].sentRows.length, 1);

  store.remove('task-1');

  assert.deepEqual(store.list(), []);
});
