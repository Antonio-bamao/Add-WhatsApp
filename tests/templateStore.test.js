const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { JsonTemplateStore, DEFAULT_TEMPLATES, applyTemplateLimit } = require('../src/core/templateStore');

test('loads default language templates when file does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-templates-'));
  const store = new JsonTemplateStore(path.join(dir, 'templates.json'));

  const templates = store.load();

  assert.ok(templates.en.length > 0);
  assert.ok(templates.es.length > 0);
  assert.ok(templates.fr.length > 0);
});

test('saves templates and removes blank lines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-templates-'));
  const filePath = path.join(dir, 'templates.json');
  const store = new JsonTemplateStore(filePath);

  store.save({
    en: ['Hello', '   '],
    es: ['Hola'],
    fr: ['Bonjour']
  });

  const loaded = new JsonTemplateStore(filePath).load();

  assert.equal(loaded.en[0], 'Hello');
  assert.equal(loaded.es[0], 'Hola');
  assert.equal(loaded.fr[0], 'Bonjour');
  assert.equal(loaded.en.length, 4);
  assert.equal(loaded.es.length, 4);
  assert.equal(loaded.fr.length, 4);
});

test('saves finite package template boundaries without refilling removed rows', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-templates-'));
  const filePath = path.join(dir, 'templates.json');
  const store = new JsonTemplateStore(filePath);

  store.save({
    en: ['EN 1', 'EN 2'],
    es: ['ES 1', 'ES 2'],
    fr: ['FR 1', 'FR 2']
  }, { fillDefaults: false });

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert.deepEqual(raw.en, ['EN 1', 'EN 2']);
  assert.deepEqual(raw.es, ['ES 1', 'ES 2']);
  assert.deepEqual(raw.fr, ['FR 1', 'FR 2']);
  assert.deepEqual(new JsonTemplateStore(filePath).load({ fillDefaults: false }).en, ['EN 1', 'EN 2']);
});

test('falls back to default language when a saved pool is empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-templates-'));
  const filePath = path.join(dir, 'templates.json');
  const store = new JsonTemplateStore(filePath);

  store.save({ en: [], es: ['Hola'], fr: ['Bonjour'] });

  assert.deepEqual(new JsonTemplateStore(filePath).load().en, DEFAULT_TEMPLATES.en);
});

test('caps each language template pool to the active package limit', () => {
  const templates = {
    en: ['EN 1', 'EN 2', 'EN 3'],
    es: ['ES 1', 'ES 2', 'ES 3'],
    fr: ['FR 1', 'FR 2', 'FR 3']
  };

  assert.deepEqual(applyTemplateLimit(templates, 2), {
    en: ['EN 1', 'EN 2'],
    es: ['ES 1', 'ES 2'],
    fr: ['FR 1', 'FR 2']
  });
  assert.deepEqual(applyTemplateLimit(templates, null), templates);
});
