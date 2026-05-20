const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { AccountContext, AUTH_REQUIRED_ERROR, accountDirectoryFor } = require('../src/core/accountContext');

test('builds account directories from stable account ids', () => {
  const dir = accountDirectoryFor('C:\\Users\\demo\\AppData\\Roaming\\Add WhatsApp', 'acc_123');

  assert.equal(dir, path.join('C:\\Users\\demo\\AppData\\Roaming\\Add WhatsApp', 'accounts', 'acc_123'));
});

test('requires a current account for protected operations', () => {
  const context = new AccountContext({ userDataPath: 'C:\\data' });

  assert.throws(() => context.requireCurrentUser(), AUTH_REQUIRED_ERROR);
});

test('switches account context and exposes per-account paths', () => {
  const context = new AccountContext({ userDataPath: 'C:\\data' });

  context.setCurrentUser({ accountId: 'acc_a', username: 'Alice' });
  assert.equal(context.getCurrentUser().username, 'Alice');
  assert.equal(context.accountPath('history', 'runs.json'), path.join('C:\\data', 'accounts', 'acc_a', 'history', 'runs.json'));

  context.setCurrentUser({ accountId: 'acc_b', username: 'Bob' });
  assert.equal(context.accountPath('history', 'runs.json'), path.join('C:\\data', 'accounts', 'acc_b', 'history', 'runs.json'));

  context.clear();
  assert.equal(context.getCurrentUser(), null);
});
