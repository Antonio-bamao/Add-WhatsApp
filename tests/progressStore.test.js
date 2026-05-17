const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { JsonProgressStore } = require('../src/core/progressStore');

test('creates default progress when file does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-'));
  const store = new JsonProgressStore(path.join(dir, 'progress.json'));

  const progress = store.load();

  assert.equal(progress.lastIndex, -1);
  assert.deepEqual(progress.sent, []);
  assert.deepEqual(progress.failed, []);
  assert.deepEqual(progress.skipped, []);
  assert.deepEqual(progress.invalid, []);
});

test('saves and reloads progress', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-'));
  const filePath = path.join(dir, 'progress.json');
  const store = new JsonProgressStore(filePath);

  store.save({
    lastIndex: 5,
    sent: [{ whatsappId: '1@c.us', date: '2026-05-17' }],
    failed: [],
    skipped: [],
    invalid: []
  });

  assert.equal(new JsonProgressStore(filePath).load().lastIndex, 5);
});
