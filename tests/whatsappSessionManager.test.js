const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createWhatsAppSessionConfig, WhatsAppSessionManager } = require('../src/main/whatsappSessionManager');

test('creates isolated WhatsApp session paths and client ids per account', () => {
  const alice = createWhatsAppSessionConfig('C:\\data', { accountId: 'user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50' }, {
    localAppData: 'C:\\Users\\demo\\AppData\\Local'
  });
  const bob = createWhatsAppSessionConfig('C:\\data', { accountId: 'user_aaaaaaaa-1111-2222-3333-444444444444' }, {
    localAppData: 'C:\\Users\\demo\\AppData\\Local'
  });

  assert.equal(alice.sessionPath, path.join('C:\\Users\\demo\\AppData\\Local', 'aw'));
  assert.equal(alice.clientId, 'c74e30f6');
  assert.equal(alice.sessionPath, bob.sessionPath);
  assert.notEqual(alice.clientId, bob.clientId);
  assert.notEqual(
    path.join(alice.sessionPath, `session-${alice.clientId}`),
    path.join(bob.sessionPath, `session-${bob.clientId}`)
  );
  assert.ok(path.join(alice.sessionPath, `session-${alice.clientId}`, 'Default').length < 80);
});

test('passes workspace proxy settings into WhatsApp service config', async () => {
  const created = [];
  const manager = new WhatsAppSessionManager({
    userDataPath: 'C:\\data',
    proxyServer: 'socks5://186.192.1.1:1080',
    createService: config => {
      created.push(config);
      return { destroy: async () => {} };
    }
  });

  await manager.switchToAccount({ accountId: 'acc_a' });

  assert.equal(created[0].proxyServer, 'socks5://186.192.1.1:1080');
});

test('uses a stable short WhatsApp client id for repeat launches of the same account', () => {
  const first = createWhatsAppSessionConfig('C:\\data', { accountId: 'user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50' }, {
    localAppData: 'C:\\Users\\demo\\AppData\\Local'
  });
  const second = createWhatsAppSessionConfig('D:\\other-data', { accountId: 'user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50' }, {
    localAppData: 'C:\\Users\\demo\\AppData\\Local'
  });

  assert.equal(first.clientId, 'c74e30f6');
  assert.equal(second.clientId, 'c74e30f6');
  assert.equal(first.sessionPath, second.sessionPath);
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

test('forceResetActiveService calls forceReset and clears activeService', async () => {
  let forceResetCalled = false;
  const manager = new WhatsAppSessionManager({
    userDataPath: 'C:\\data',
    createService: config => ({
      accountId: config.accountId,
      forceReset: async () => {
        forceResetCalled = true;
      },
      destroy: async () => {}
    })
  });

  await manager.switchToAccount({ accountId: 'acc_a' });
  assert.ok(manager.activeService);
  assert.equal(manager.activeAccountId, 'acc_a');

  await manager.forceResetActiveService();
  assert.equal(forceResetCalled, true);
  assert.equal(manager.activeService, null);
  assert.equal(manager.activeAccountId, null);
});
