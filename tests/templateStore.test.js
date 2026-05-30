const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { JsonTemplateStore, DEFAULT_TEMPLATES, countCustomTemplates } = require('../src/core/templateStore');

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

test('falls back to default language when a saved pool is empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-templates-'));
  const filePath = path.join(dir, 'templates.json');
  const store = new JsonTemplateStore(filePath);

  store.save({ en: [], es: ['Hola'], fr: ['Bonjour'] });

  assert.deepEqual(new JsonTemplateStore(filePath).load().en, DEFAULT_TEMPLATES.en);
});

test('counts only non-default templates as custom package usage', () => {
  const templates = {
    en: [DEFAULT_TEMPLATES.en[0], 'Custom EN'],
    es: [DEFAULT_TEMPLATES.es[0], DEFAULT_TEMPLATES.es[1]],
    fr: ['Custom FR 1', 'Custom FR 2']
  };

  assert.equal(countCustomTemplates(templates), 3);
});
