const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { migrateLegacyUserData } = require('../src/core/legacyMigration');

test('copies legacy history, progress, state, and templates into an account without deleting originals', () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-legacy-'));
  const accountDir = path.join(userDataPath, 'accounts', 'acc_a');
  fs.mkdirSync(path.join(userDataPath, 'history'), { recursive: true });
  fs.mkdirSync(path.join(userDataPath, 'progress'), { recursive: true });
  fs.mkdirSync(path.join(userDataPath, 'state'), { recursive: true });
  fs.writeFileSync(path.join(userDataPath, 'history', 'runs.json'), JSON.stringify([{ id: 'legacy-run' }]));
  fs.writeFileSync(path.join(userDataPath, 'progress', 'legacy.json'), JSON.stringify({ lastIndex: 18 }));
  fs.writeFileSync(path.join(userDataPath, 'state', 'last-import.json'), JSON.stringify({ sourceFile: 'old.xlsx' }));
  fs.writeFileSync(path.join(userDataPath, 'templates.json'), JSON.stringify({ en: ['Hello'], es: ['Hola'], fr: ['Bonjour'] }));

  const result = migrateLegacyUserData({ userDataPath, accountDir });

  assert.equal(result.migrated, true);
  assert.equal(fs.existsSync(path.join(accountDir, 'history', 'runs.json')), true);
  assert.equal(fs.existsSync(path.join(accountDir, 'progress', 'legacy.json')), true);
  assert.equal(fs.existsSync(path.join(accountDir, 'state', 'last-import.json')), true);
  assert.equal(fs.existsSync(path.join(accountDir, 'templates.json')), true);
  assert.equal(fs.existsSync(path.join(userDataPath, 'history', 'runs.json')), true);
  assert.equal(fs.existsSync(path.join(userDataPath, 'progress', 'legacy.json')), true);
});

test('does not overwrite existing account data during legacy migration', () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-legacy-'));
  const accountDir = path.join(userDataPath, 'accounts', 'acc_a');
  fs.mkdirSync(path.join(userDataPath, 'history'), { recursive: true });
  fs.mkdirSync(path.join(accountDir, 'history'), { recursive: true });
  fs.writeFileSync(path.join(userDataPath, 'history', 'runs.json'), JSON.stringify([{ id: 'legacy-run' }]));
  fs.writeFileSync(path.join(accountDir, 'history', 'runs.json'), JSON.stringify([{ id: 'account-run' }]));

  migrateLegacyUserData({ userDataPath, accountDir });

  const accountHistory = JSON.parse(fs.readFileSync(path.join(accountDir, 'history', 'runs.json'), 'utf-8'));
  assert.deepEqual(accountHistory, [{ id: 'account-run' }]);
});

test('records a migration marker so repeated startup does not recopy legacy data', () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-legacy-'));
  const accountDir = path.join(userDataPath, 'accounts', 'acc_a');
  fs.mkdirSync(path.join(userDataPath, 'progress'), { recursive: true });
  fs.writeFileSync(path.join(userDataPath, 'progress', 'legacy.json'), JSON.stringify({ lastIndex: 1 }));

  const first = migrateLegacyUserData({ userDataPath, accountDir });
  const second = migrateLegacyUserData({ userDataPath, accountDir });

  assert.equal(first.migrated, true);
  assert.equal(second.migrated, false);
  assert.equal(fs.existsSync(path.join(accountDir, 'state', 'legacy-migration.json')), true);
});
