const EN_COUNTRY_CODES = new Set([
  '1',
  '27',
  '44',
  '60',
  '61',
  '64',
  '65',
  '234',
  '254',
  '260',
  '263',
  '353'
]);

const ES_COUNTRY_CODES = new Set([
  '34',
  '51',
  '52',
  '53',
  '54',
  '56',
  '57',
  '58',
  '502',
  '503',
  '504',
  '505',
  '506',
  '507',
  '591',
  '593',
  '595',
  '598'
]);

const FR_COUNTRY_CODES = new Set([
  '32',
  '33',
  '41',
  '221',
  '223',
  '224',
  '225',
  '226',
  '227',
  '228',
  '229',
  '237',
  '242',
  '243',
  '352',
  '377',
  '509',
  '590',
  '594',
  '596'
]);

const NANP_SPANISH_AREA_CODES = new Set([
  '787',
  '939',
  '809',
  '829',
  '849'
]);

const NANP_FRENCH_AREA_CODES = new Set([
  '367',
  '418',
  '438',
  '450',
  '514',
  '579',
  '581',
  '819',
  '873'
]);

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function extractCallingCode(e164) {
  const digits = digitsOnly(e164);
  const allCodes = [...FR_COUNTRY_CODES, ...ES_COUNTRY_CODES, ...EN_COUNTRY_CODES]
    .sort((a, b) => b.length - a.length);
  return allCodes.find(code => digits.startsWith(code)) || null;
}

function detectNanpLanguage(digits) {
  const areaCode = digits.slice(1, 4);
  if (NANP_SPANISH_AREA_CODES.has(areaCode)) {
    return { language: 'es', reason: 'nanp-area-code', areaCode };
  }
  if (NANP_FRENCH_AREA_CODES.has(areaCode)) {
    return { language: 'fr', reason: 'nanp-area-code', areaCode };
  }
  return { language: 'en', reason: 'nanp-default', areaCode };
}

function detectLanguage({ e164, countryIso, languageOverride } = {}) {
  const override = String(languageOverride || '').trim().toLowerCase();
  if (['en', 'es', 'fr'].includes(override)) {
    return { language: override, reason: 'override' };
  }

  const digits = digitsOnly(e164);
  if (!digits) return { language: 'en', reason: 'default' };

  if (digits.startsWith('1') && digits.length >= 11) {
    return detectNanpLanguage(digits);
  }

  const callingCode = extractCallingCode(digits);
  if (callingCode && FR_COUNTRY_CODES.has(callingCode)) {
    return { language: 'fr', reason: 'calling-code', callingCode };
  }
  if (callingCode && ES_COUNTRY_CODES.has(callingCode)) {
    return { language: 'es', reason: 'calling-code', callingCode };
  }
  if (callingCode && EN_COUNTRY_CODES.has(callingCode)) {
    return { language: 'en', reason: 'calling-code', callingCode };
  }

  if (countryIso === 'FR') return { language: 'fr', reason: 'country' };
  if (['ES', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE'].includes(countryIso)) {
    return { language: 'es', reason: 'country' };
  }

  return { language: 'en', reason: 'default' };
}

module.exports = {
  EN_COUNTRY_CODES,
  ES_COUNTRY_CODES,
  FR_COUNTRY_CODES,
  NANP_SPANISH_AREA_CODES,
  NANP_FRENCH_AREA_CODES,
  detectLanguage
};
