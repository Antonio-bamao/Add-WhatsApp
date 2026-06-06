const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const {
  buildContactImportAuditPayload,
  buildSyntheticWorkbook,
  makeParsedRows,
  parseArgs
} = require('../scripts/contact-import-e2e.js');

test('contact import e2e script builds desktop-style payload variants', () => {
  const rows = makeParsedRows(8);
  const workbook = buildSyntheticWorkbook(rows, { runId: 'test-run' });
  const gzipPayload = buildContactImportAuditPayload({ workbook, parsedRows: rows, originalMode: 'gzip' });
  const base64Payload = buildContactImportAuditPayload({ workbook, parsedRows: rows, originalMode: 'base64' });
  const bothPayload = buildContactImportAuditPayload({ workbook, parsedRows: rows, originalMode: 'both' });

  assert.equal(gzipPayload.payload.originalSizeBytes, workbook.buffer.length);
  assert.equal(gzipPayload.payload.stats.total, 8);
  assert.equal(gzipPayload.payload.clientImportKey, base64Payload.payload.clientImportKey);
  assert.equal(gzipPayload.payload.clientImportKey, bothPayload.payload.clientImportKey);
  assert.equal(gzipPayload.payload.originalBase64, undefined);
  assert.ok(gzipPayload.payload.originalGzipBase64);
  assert.ok(base64Payload.payload.originalBase64);
  assert.equal(base64Payload.payload.originalGzipBase64, undefined);
  assert.ok(bothPayload.payload.originalBase64);
  assert.ok(bothPayload.payload.originalGzipBase64);
  assert.deepEqual(JSON.parse(zlib.gunzipSync(Buffer.from(gzipPayload.payload.parsedRowsGzipBase64, 'base64')).toString('utf8')), rows);
  assert.equal(gzipPayload.bodyBytes, Buffer.byteLength(JSON.stringify(gzipPayload.payload), 'utf8'));
  assert.ok(gzipPayload.bodyBytes > 0);
});

test('contact import e2e script can generate 16630 parsed rows', () => {
  const rows = makeParsedRows(16630);

  assert.equal(rows.length, 16630);
  assert.equal(rows[0].rowNumber, 2);
  assert.equal(rows[16629].rowNumber, 16631);
});

test('contact import e2e script defaults to legacy originalBase64 mode for Nginx stress checks', () => {
  const options = parseArgs([], {});

  assert.equal(options.originalMode, 'base64');
});
