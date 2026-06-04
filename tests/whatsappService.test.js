const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const { WhatsAppService } = require('../src/main/whatsappService');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('ensureReady rejects when WhatsApp logs out during initialization', async () => {
  const client = new EventEmitter();
  client.initialize = () => {
    setImmediate(() => client.emit('disconnected', 'LOGOUT'));
  };

  const service = new WhatsAppService({
    sessionPath: 'C:\\tmp\\whatsapp-session',
    emit: () => {}
  });
  service.client = client;

  const readyPromise = service.ensureReady().then(
      () => 'resolved',
      error => error
    );
  const result = await Promise.race([
    readyPromise,
    delay(50).then(() => 'pending')
  ]);

  if (result === 'pending') {
    client.emit('auth_failure', 'cleanup');
    await readyPromise;
  }

  assert.notEqual(result, 'pending');
  assert.match(result.message, /登录.*失效|重新扫码/);
});
