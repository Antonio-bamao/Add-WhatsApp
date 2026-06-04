const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { WhatsAppService } = require('../src/main/whatsappService');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createFakeClient(initialize) {
  const client = new EventEmitter();
  client.initialize = () => initialize(client);
  client.destroyed = false;
  client.destroy = async () => {
    client.destroyed = true;
  };
  return client;
}

class FakeWhatsAppService extends WhatsAppService {
  constructor(options, clients) {
    super(options);
    this.clients = [...clients];
    this.created = [];
  }

  createClient() {
    this.client = this.clients.shift();
    this.attachClientEvents(this.client);
    this.created.push(this.client);
  }
}

test('ensureReady resets stale WhatsApp auth and retries to QR after logout during initialization', async () => {
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-stale-session-'));
  fs.writeFileSync(path.join(sessionPath, 'stale.txt'), 'old-login');
  const events = [];
  const staleClient = createFakeClient(client => {
    setImmediate(() => client.emit('disconnected', 'LOGOUT'));
  });
  const freshClient = createFakeClient(client => {
    setImmediate(() => {
      client.emit('qr');
      client.emit('ready');
    });
  });

  const service = new FakeWhatsAppService({
    sessionPath,
    emit: event => events.push(event)
  }, [staleClient, freshClient]);

  const readyPromise = service.ensureReady().then(
      () => 'resolved',
      error => error
    );
  const result = await Promise.race([
    readyPromise,
    delay(50).then(() => 'pending')
  ]);

  assert.equal(result, 'resolved');
  assert.equal(staleClient.destroyed, true);
  assert.equal(fs.existsSync(path.join(sessionPath, 'stale.txt')), false);
  assert.equal(service.created.length, 2);
  assert.deepEqual(events.map(event => event.type), ['auth:disconnected', 'auth:reset', 'auth:qr', 'auth:ready']);
});

test('ensureReady does not clear auth for non-stale startup failures', async () => {
  const sessionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-network-error-'));
  fs.writeFileSync(path.join(sessionPath, 'keep.txt'), 'saved-login');
  const failingClient = createFakeClient(() => {
    throw new Error('Proxy connection refused');
  });

  const service = new FakeWhatsAppService({
    sessionPath,
    emit: () => {}
  }, [failingClient]);

  await assert.rejects(
    () => service.ensureReady(),
    /Proxy connection refused/
  );
  assert.equal(fs.existsSync(path.join(sessionPath, 'keep.txt')), true);
  assert.equal(service.created.length, 1);
});
