const path = require('path');
const XLSX = require('xlsx');
const { parsePhoneRow } = require('./phoneParser');

const PHONE_HEADERS = ['电话', '手机号', '手机', 'phonenumber', 'phone', 'mobile', 'tel', 'telephone'];
const COUNTRY_HEADERS = ['收货国家', '国家', 'country', '国家代码', 'countrycode', 'country code'];
const LANGUAGE_HEADERS = ['语言', 'language', 'lang'];

function normalizeHeader(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function findColumn(headers, candidates) {
  const normalizedCandidates = new Set(candidates.map(normalizeHeader));
  return headers.find(header => normalizedCandidates.has(normalizeHeader(header))) || null;
}

function workbookRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function importContacts(filePath, options = {}) {
  const rows = workbookRows(filePath);
  if (!rows.length) {
    return { filePath, rows: [], stats: summarize([]), error: 'empty-file' };
  }

  const headers = Object.keys(rows[0]);
  const phoneColumn = findColumn(headers, PHONE_HEADERS) || headers[0];
  const countryColumn = findColumn(headers, COUNTRY_HEADERS);
  const languageColumn = findColumn(headers, LANGUAGE_HEADERS);

  const seen = new Set();
  const parsedRows = rows.map((row, index) => {
    const parsed = parsePhoneRow({
      phone: row[phoneColumn],
      country: countryColumn ? row[countryColumn] : '',
      language: languageColumn ? row[languageColumn] : ''
    }, options);
    const duplicate = parsed.status === 'valid' && parsed.e164 && seen.has(parsed.e164);
    if (parsed.status === 'valid' && parsed.e164) seen.add(parsed.e164);

    return {
      rowNumber: index + 2,
      source: row,
      phoneColumn,
      countryColumn,
      languageColumn,
      duplicate,
      ...parsed,
      status: duplicate ? 'duplicate' : parsed.status
    };
  });

  return {
    filePath,
    fileName: path.basename(filePath),
    columns: { phoneColumn, countryColumn, languageColumn },
    rows: parsedRows,
    stats: summarize(parsedRows)
  };
}

function summarize(rows) {
  return rows.reduce(
    (stats, row) => {
      stats.total += 1;
      if (row.status === 'china-skipped') {
        stats.chinaSkipped += 1;
      } else {
        stats[row.status] = (stats[row.status] || 0) + 1;
      }
      if (row.isChinaNumber || row.status === 'china-skipped') stats.chinaNumbers += 1;
      if (row.language) stats.languages[row.language] = (stats.languages[row.language] || 0) + 1;
      return stats;
    },
    {
      total: 0,
      valid: 0,
      invalid: 0,
      pending: 0,
      duplicate: 0,
      chinaNumbers: 0,
      chinaSkipped: 0,
      languages: {}
    }
  );
}

module.exports = {
  importContacts,
  summarize,
  findColumn
};
