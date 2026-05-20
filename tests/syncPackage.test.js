const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createFileFingerprint } = require('../src/core/progressIdentity');
const { SyncPackageStore } = require('../src/core/syncPackageStore');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-sync-'));
}

test('creates stable fingerprints for the same file contents across paths', () => {
  const dir = tempDir();
  const first = path.join(dir, '名单.xlsx');
  const secondDir = path.join(dir, 'nested');
  fs.mkdirSync(secondDir);
  const second = path.join(secondDir, 'renamed.xlsx');
  fs.writeFileSync(first, 'same customer workbook');
  fs.writeFileSync(second, 'same customer workbook');

  assert.equal(createFileFingerprint(first), createFileFingerprint(second));
});

test('exports encrypted sync packages without secrets and imports them with the password', () => {
  const dir = tempDir();
  const packagePath = path.join(dir, 'sync.awsync');
  const store = new SyncPackageStore();
  const payload = {
    account: { accountId: 'acc_a', username: 'Alice' },
    history: [{ id: 'run-1', stats: { sent: 3 } }],
    progress: [{ fileFingerprint: 'abc', lastIndex: 17, sent: [{ rowNumber: 1 }] }]
  };

  store.exportPackage({
    filePath: packagePath,
    password: 'SyncSecret123',
    payload
  });

  const raw = fs.readFileSync(packagePath, 'utf-8');
  assert.doesNotMatch(raw, /run-1/);
  assert.doesNotMatch(raw, /SyncSecret123/);
  assert.doesNotMatch(raw, /passwordHash|recoveryHash|whatsapp-session/i);

  const imported = store.importPackage({
    filePath: packagePath,
    password: 'SyncSecret123'
  });
  assert.deepEqual(imported.payload.history, payload.history);
  assert.throws(
    () => store.importPackage({ filePath: packagePath, password: 'WrongSecret123' }),
    /同步包密码不正确/
  );
});

test('rejects unsupported sync package versions before importing', () => {
  const dir = tempDir();
  const packagePath = path.join(dir, 'sync.awsync');
  fs.writeFileSync(packagePath, JSON.stringify({ version: 999, salt: '', iv: '', tag: '', data: '' }));

  assert.throws(
    () => new SyncPackageStore().importPackage({ filePath: packagePath, password: 'SyncSecret123' }),
    /同步包版本不支持/
  );
});
