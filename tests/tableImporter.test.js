const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');

const { importContacts, summarize } = require('../src/core/tableImporter');

test('counts China numbers separately from valid sendable rows', () => {
  const stats = summarize([
    { status: 'valid', language: 'en' },
    { status: 'china-skipped', language: 'en' },
    { status: 'duplicate', language: 'en' }
  ]);

  assert.equal(stats.total, 3);
  assert.equal(stats.valid, 1);
  assert.equal(stats.chinaNumbers, 1);
  assert.equal(stats.chinaSkipped, 1);
  assert.equal(stats.duplicate, 1);
});

test('imports China numbers as valid when skip China option is disabled', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-import-'));
  const filePath = path.join(dir, 'contacts.xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    { phone: '18612345678', country: '中国' }
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  XLSX.writeFile(workbook, filePath);

  const result = importContacts(filePath, { skipChinaNumbers: false });

  assert.equal(result.stats.valid, 1);
  assert.equal(result.stats.chinaNumbers, 1);
  assert.equal(result.stats.chinaSkipped, 0);
  assert.equal(result.rows[0].status, 'valid');
  assert.equal(result.rows[0].whatsappId, '8618612345678@c.us');
});
