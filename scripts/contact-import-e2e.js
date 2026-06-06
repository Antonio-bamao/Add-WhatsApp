const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const XLSX = require('xlsx');

const DEFAULT_ROWS = 16630;
const DEFAULT_BASE_URL = 'https://api.addwhatsapp.com';
const DEFAULT_ORIGINAL_MODE = 'base64';

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    baseUrl: env.ADD_WHATSAPP_E2E_BASE_URL || DEFAULT_BASE_URL,
    username: env.ADD_WHATSAPP_E2E_USERNAME || '',
    password: env.ADD_WHATSAPP_E2E_PASSWORD || '',
    adminUsername: env.ADD_WHATSAPP_E2E_ADMIN_USERNAME || '',
    adminPassword: env.ADD_WHATSAPP_E2E_ADMIN_PASSWORD || '',
    rows: DEFAULT_ROWS,
    originalMode: env.ADD_WHATSAPP_E2E_ORIGINAL_MODE || DEFAULT_ORIGINAL_MODE,
    file: env.ADD_WHATSAPP_E2E_FILE || '',
    deviceId: env.ADD_WHATSAPP_E2E_DEVICE_ID || `contact-import-e2e-${Date.now()}`
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    const [rawKey, inlineValue] = arg.startsWith('--') ? arg.slice(2).split(/=(.*)/s, 2) : ['', ''];
    if (!rawKey) throw new Error(`Unknown argument: ${arg}`);
    const value = inlineValue !== undefined && inlineValue !== '' ? inlineValue : argv[++i];
    if (value === undefined) throw new Error(`Missing value for --${rawKey}`);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (key === 'rows') {
      options.rows = Number(value);
    } else if (key in options) {
      options[key] = value;
    } else {
      throw new Error(`Unknown argument: --${rawKey}`);
    }
  }

  options.rows = Math.floor(Number(options.rows) || DEFAULT_ROWS);
  options.originalMode = String(options.originalMode || 'gzip').toLowerCase();
  return options;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/contact-import-e2e.js --base-url https://api.addwhatsapp.com --username USER --password PASS --admin-username ADMIN --admin-password PASS',
    '',
    'Options:',
    '  --base-url              Public API origin that goes through Nginx. Default: https://api.addwhatsapp.com',
    '  --username              Test user username. Env: ADD_WHATSAPP_E2E_USERNAME',
    '  --password              Test user password. Env: ADD_WHATSAPP_E2E_PASSWORD',
    '  --admin-username        Admin username. Env: ADD_WHATSAPP_E2E_ADMIN_USERNAME',
    '  --admin-password        Admin password. Env: ADD_WHATSAPP_E2E_ADMIN_PASSWORD',
    '  --rows                  Parsed row count. Default: 16630',
    '  --file                  Optional existing workbook file to upload as original bytes',
    '  --original-mode         base64, gzip, or both. Default: base64 to reproduce the old larger desktop body; use gzip for the current desktop payload.',
    '  --device-id             Login device id. Default: generated per run'
  ].join('\n');
}

function assertPublicNginxBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || /^127\./.test(hostname)) {
    throw new Error('baseUrl must go through Nginx and must not point to localhost/127.0.0.1');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('baseUrl must be http or https');
  }
}

function makeParsedRows(count = DEFAULT_ROWS) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const rowNumber = index + 2;
    const local = String(1000000 + index).padStart(7, '0');
    rows.push({
      rowNumber,
      status: 'valid',
      e164: `+1555${local}`,
      countryIso: 'US',
      language: 'en',
      source: {
        phone: `555${local}`,
        country: 'US',
        language: 'en',
        name: `Contact ${rowNumber}`
      }
    });
  }
  return rows;
}

function buildSyntheticWorkbook(parsedRows, { runId = String(Date.now()) } = {}) {
  const worksheetRows = parsedRows.map((row) => ({
    phone: row.source.phone,
    country: row.source.country,
    language: row.source.language,
    name: row.source.name
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(worksheetRows), 'contacts');
  return {
    buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }),
    fileName: `contact-import-e2e-${runId}.xlsx`
  };
}

function readWorkbook(file) {
  if (!file) return null;
  const resolved = path.resolve(file);
  return {
    buffer: fs.readFileSync(resolved),
    fileName: path.basename(resolved)
  };
}

function buildContactImportAuditPayload({ workbook, parsedRows, originalMode = 'gzip', importOptions = { skipChinaNumbers: true } }) {
  if (!workbook || !Buffer.isBuffer(workbook.buffer)) throw new Error('workbook.buffer is required');
  if (!Array.isArray(parsedRows)) throw new Error('parsedRows must be an array');
  const originalFormat = path.extname(workbook.fileName || 'contacts.xlsx').replace(/^\./, '').toLowerCase() || 'xlsx';
  const originalSha256 = crypto.createHash('sha256').update(workbook.buffer).digest('hex');
  const parsedRowsGzipBase64 = zlib.gzipSync(Buffer.from(JSON.stringify(parsedRows), 'utf8')).toString('base64');
  const payload = {
    clientImportKey: crypto
      .createHash('sha256')
      .update(`${originalSha256}:${parsedRowsGzipBase64}`)
      .digest('hex'),
    originalFileName: workbook.fileName || 'contacts.xlsx',
    originalFormat,
    originalMimeType: mimeTypeForImportFormat(originalFormat),
    originalSizeBytes: workbook.buffer.length,
    originalSha256,
    columns: { phoneColumn: 'phone', countryColumn: 'country', languageColumn: 'language' },
    stats: { total: parsedRows.length, valid: parsedRows.length, invalid: 0 },
    importOptions,
    parsedRowsGzipBase64
  };

  const mode = String(originalMode || 'gzip').toLowerCase();
  if (mode === 'gzip' || mode === 'both') {
    payload.originalGzipBase64 = zlib.gzipSync(workbook.buffer).toString('base64');
  }
  if (mode === 'base64' || mode === 'both') {
    payload.originalBase64 = workbook.buffer.toString('base64');
  }
  if (!payload.originalGzipBase64 && !payload.originalBase64) {
    throw new Error('--original-mode must be gzip, base64, or both');
  }

  const bodyJson = JSON.stringify(payload);
  return {
    payload,
    bodyBytes: Buffer.byteLength(bodyJson, 'utf8'),
    bodyJson
  };
}

function mimeTypeForImportFormat(format) {
  if (format === 'csv') return 'text/csv';
  if (format === 'xls') return 'application/vnd.ms-excel';
  if (format === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

async function requestJson(baseUrl, pathName, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { rawBody: text.slice(0, 500) };
  }
  return { response, payload };
}

async function run(options) {
  if (options.help) {
    console.log(usage());
    return;
  }
  for (const name of ['username', 'password', 'adminUsername', 'adminPassword']) {
    if (!options[name]) throw new Error(`Missing required option: --${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`);
  }
  assertPublicNginxBaseUrl(options.baseUrl);
  const baseUrl = String(options.baseUrl).replace(/\/+$/, '');
  const runId = `e2e-${Date.now()}`;
  const parsedRows = makeParsedRows(options.rows);
  const workbook = readWorkbook(options.file) || buildSyntheticWorkbook(parsedRows, { runId });
  const { payload, bodyBytes } = buildContactImportAuditPayload({
    workbook,
    parsedRows,
    originalMode: options.originalMode
  });

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Rows: ${parsedRows.length}`);
  console.log(`Client import key: ${payload.clientImportKey}`);
  console.log(`Original file: ${payload.originalFileName}`);
  console.log(`Original size bytes: ${payload.originalSizeBytes}`);
  console.log(`JSON body bytes: ${bodyBytes} (${(bodyBytes / 1024 / 1024).toFixed(2)} MiB)`);

  const login = await requestJson(baseUrl, '/v1/auth/login', {
    method: 'POST',
    body: {
      username: options.username,
      password: options.password,
      deviceId: options.deviceId
    }
  });
  console.log(`POST /v1/auth/login -> ${login.response.status}`);
  assert.equal(login.response.status, 200, `login failed: ${JSON.stringify(login.payload)}`);
  const accessToken = login.payload && login.payload.accessToken;
  assert.ok(accessToken, 'login response missing accessToken');

  const created = await requestJson(baseUrl, '/v1/contact-imports', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: payload
  });
  console.log(`POST /v1/contact-imports -> ${created.response.status}`);
  assert.equal(created.response.status, 201, `contact import failed: ${JSON.stringify(created.payload)}`);
  assert.ok(created.payload && created.payload.id, 'contact import response missing id');

  const adminLogin = await requestJson(baseUrl, '/v1/admin/auth/login', {
    method: 'POST',
    body: {
      username: options.adminUsername,
      password: options.adminPassword
    }
  });
  console.log(`POST /v1/admin/auth/login -> ${adminLogin.response.status}`);
  assert.equal(adminLogin.response.status, 200, `admin login failed: ${JSON.stringify(adminLogin.payload)}`);
  const adminAccessToken = adminLogin.payload && adminLogin.payload.adminAccessToken;
  assert.ok(adminAccessToken, 'admin login response missing adminAccessToken');

  const adminListPath = `/v1/admin/contact-imports?q=${encodeURIComponent(payload.originalSha256)}&limit=100&offset=0`;
  const adminList = await requestJson(baseUrl, adminListPath, {
    headers: { authorization: `Bearer ${adminAccessToken}` }
  });
  console.log(`GET ${adminListPath} -> ${adminList.response.status}`);
  assert.equal(adminList.response.status, 200, `admin contact import list failed: ${JSON.stringify(adminList.payload)}`);
  const items = Array.isArray(adminList.payload && adminList.payload.items) ? adminList.payload.items : [];
  const matched = items.find((item) => item.clientImportKey === payload.clientImportKey);
  assert.ok(matched, `admin list did not include clientImportKey ${payload.clientImportKey}`);
  assert.equal(Number(matched.parsedRowCount), parsedRows.length);
  console.log(`Verified admin record id=${matched.id} parsedRowCount=${matched.parsedRowCount}`);
}

if (require.main === module) {
  run(parseArgs()).catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {
  assertPublicNginxBaseUrl,
  buildContactImportAuditPayload,
  buildSyntheticWorkbook,
  makeParsedRows,
  parseArgs,
  run
};
