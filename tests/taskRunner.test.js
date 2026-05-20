const test = require('node:test');
const assert = require('node:assert/strict');

const { isFatalAutomationError, runSendTask } = require('../src/core/taskRunner');

function createFakeClient({ registered = new Set(), failures = new Set() } = {}) {
  return {
    sent: [],
    async isRegisteredUser(chatId) {
      return registered.has(chatId);
    },
    async sendMessage(chatId, message) {
      if (failures.has(chatId)) throw new Error('send failed');
      this.sent.push({ chatId, message });
      return true;
    }
  };
}

function createMemoryProgress(initial = {}) {
  const progress = {
    sent: [],
    failed: [],
    skipped: [],
    invalid: [],
    lastIndex: -1,
    ...initial
  };

  return {
    progress,
    load() {
      return progress;
    },
    save(next) {
      Object.assign(progress, JSON.parse(JSON.stringify(next)));
    }
  };
}

test('sends only valid registered rows and records skipped invalid rows', async () => {
  const rows = [
    { rowNumber: 2, status: 'valid', whatsappId: '12566654606@c.us', language: 'en' },
    { rowNumber: 3, status: 'valid', whatsappId: '33788346039@c.us', language: 'fr' },
    { rowNumber: 4, status: 'pending', rawPhone: '337-340-6764', language: 'fr' }
  ];
  const client = createFakeClient({ registered: new Set(['12566654606@c.us']) });
  const store = createMemoryProgress();

  const result = await runSendTask({
    rows,
    client,
    progressStore: store,
    config: { maxPerDay: 10, delayMs: 0, today: '2026-05-17' },
    templates: { en: ['hello'], fr: ['bonjour'], es: ['hola'] }
  });

  assert.equal(result.stats.sent, 1);
  assert.equal(result.stats.unregistered, 1);
  assert.equal(result.stats.invalid, 1);
  assert.equal(store.progress.lastIndex, 2);
  assert.deepEqual(client.sent, [{ chatId: '12566654606@c.us', message: 'hello' }]);
});

test('tracks China skipped rows without checking WhatsApp registration', async () => {
  const rows = [
    { rowNumber: 2, status: 'china-skipped', rawPhone: '8615970894073', e164: '+8615970894073', language: 'en' }
  ];
  let registrationChecks = 0;
  const client = {
    sent: [],
    async isRegisteredUser() {
      registrationChecks += 1;
      return true;
    }
  };
  const store = createMemoryProgress();

  const result = await runSendTask({
    rows,
    client,
    progressStore: store,
    config: { maxPerDay: 10, delayMs: 0, today: '2026-05-17' },
    templates: { en: ['hello'], fr: ['bonjour'], es: ['hola'] }
  });

  assert.equal(result.stats.chinaSkipped, 1);
  assert.equal(result.stats.invalid, 1);
  assert.equal(registrationChecks, 0);
  assert.equal(store.progress.invalid[0].error, 'china-number-skipped');
});

test('resumes after last processed index', async () => {
  const rows = [
    { rowNumber: 2, status: 'valid', whatsappId: '10000000001@c.us', language: 'en' },
    { rowNumber: 3, status: 'valid', whatsappId: '10000000002@c.us', language: 'en' }
  ];
  const client = createFakeClient({ registered: new Set(['10000000002@c.us']) });
  const store = createMemoryProgress({ lastIndex: 0 });

  const result = await runSendTask({
    rows,
    client,
    progressStore: store,
    config: { maxPerDay: 10, delayMs: 0, today: '2026-05-17' },
    templates: { en: ['hello'], fr: ['bonjour'], es: ['hola'] }
  });

  assert.equal(result.stats.sent, 1);
  assert.equal(store.progress.lastIndex, 1);
  assert.deepEqual(client.sent, [{ chatId: '10000000002@c.us', message: 'hello' }]);
});

test('stops when daily send limit is reached', async () => {
  const rows = [
    { rowNumber: 2, status: 'valid', whatsappId: '10000000001@c.us', language: 'en' },
    { rowNumber: 3, status: 'valid', whatsappId: '10000000002@c.us', language: 'en' }
  ];
  const client = createFakeClient({
    registered: new Set(['10000000001@c.us', '10000000002@c.us'])
  });
  const store = createMemoryProgress();

  const result = await runSendTask({
    rows,
    client,
    progressStore: store,
    config: { maxPerDay: 1, delayMs: 0, today: '2026-05-17' },
    templates: { en: ['hello'], fr: ['bonjour'], es: ['hola'] }
  });

  assert.equal(result.reason, 'daily-limit');
  assert.equal(result.stats.sent, 1);
  assert.equal(store.progress.lastIndex, 0);
  assert.equal(client.sent.length, 1);
});

test('stops gracefully when stop signal is set before next row', async () => {
  const rows = [
    { rowNumber: 2, status: 'valid', whatsappId: '10000000001@c.us', language: 'en' },
    { rowNumber: 3, status: 'valid', whatsappId: '10000000002@c.us', language: 'en' }
  ];
  const client = createFakeClient({
    registered: new Set(['10000000001@c.us', '10000000002@c.us'])
  });
  const store = createMemoryProgress();
  let checks = 0;

  const result = await runSendTask({
    rows,
    client,
    progressStore: store,
    shouldStop: () => {
      checks += 1;
      return checks > 1;
    },
    config: { maxPerDay: 10, delayMs: 0, today: '2026-05-17' },
    templates: { en: ['hello'], fr: ['bonjour'], es: ['hola'] }
  });

  assert.equal(result.reason, 'stopped');
  assert.equal(result.stats.sent, 1);
  assert.equal(store.progress.lastIndex, 0);
});

test('stops without advancing progress when automation browser is closed', async () => {
  const rows = [
    { rowNumber: 2, status: 'valid', whatsappId: '10000000001@c.us', language: 'en' },
    { rowNumber: 3, status: 'valid', whatsappId: '10000000002@c.us', language: 'en' }
  ];
  const client = {
    async isRegisteredUser() {
      throw new Error("Attempted to use detached Frame 'abc'.");
    }
  };
  const store = createMemoryProgress({ lastIndex: 0 });

  const result = await runSendTask({
    rows,
    client,
    progressStore: store,
    config: { maxPerDay: 10, delayMs: 0, today: '2026-05-17' },
    templates: { en: ['hello'], fr: ['bonjour'], es: ['hola'] }
  });

  assert.equal(result.reason, 'automation-lost');
  assert.equal(result.stats.failed, 1);
  assert.equal(store.progress.lastIndex, 0);
  assert.equal(store.progress.failed[0].fatal, true);
});

test('recognizes fatal automation errors', () => {
  assert.equal(isFatalAutomationError(new Error('Target closed')), true);
  assert.equal(isFatalAutomationError(new Error('send failed')), false);
});
