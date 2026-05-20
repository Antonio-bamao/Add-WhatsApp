const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createWhatsAppSessionConfig, WhatsAppSessionManager } = require('../src/main/whatsappSessionManager');

test('creates isolated WhatsApp session paths and client ids per account', () => {
  const alice = createWhatsAppSessionConfig('C:\\data', { accountId: 'acc_a' });
  const bob = createWhatsAppSessionConfig('C:\\data', { accountId: 'acc_b' });

  assert.equal(alice.sessionPath, path.join('C:\\data', 'accounts', 'acc_a', 'whatsapp-session'));
  assert.equal(alice.clientId, 'add-whatsapp-acc_a');
  assert.notEqual(alice.sessionPath, bob.sessionPath);
  assert.notEqual(alice.clientId, bob.clientId);
});

test('destroys the active service when switching accounts', async () => {
  const destroyed = [];
  const created = [];
  const manager = new WhatsAppSessionManager({
    userDataPath: 'C:\\data',
    createService: config => {
      created.push(config);
      return {
        accountId: config.accountId,
        destroy: async () => destroyed.push(config.accountId)
      };
    }
  });

  const first = await manager.switchToAccount({ accountId: 'acc_a' });
  const second = await manager.switchToAccount({ accountId: 'acc_b' });

  assert.equal(first.accountId, 'acc_a');
  assert.equal(second.accountId, 'acc_b');
  assert.deepEqual(destroyed, ['acc_a']);
  assert.equal(created.length, 2);
});

test('reuses the active service for the same account', async () => {
  const manager = new WhatsAppSessionManager({
    userDataPath: 'C:\\data',
    createService: config => ({
      accountId: config.accountId,
      destroy: async () => {}
    })
  });

  const first = await manager.switchToAccount({ accountId: 'acc_a' });
  const second = await manager.switchToAccount({ accountId: 'acc_a' });

  assert.equal(first, second);
});
