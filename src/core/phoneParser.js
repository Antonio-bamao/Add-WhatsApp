const {
  parsePhoneNumberFromString,
  getCountryCallingCode
} = require('libphonenumber-js');
const { normalizeCountry } = require('./countryRules');
const { detectLanguage } = require('./languageRules');

function cleanRawPhone(value) {
  return String(value || '')
    .trim()
    .replace(/^[`'"]+|[`'"]+$/g, '')
    .replace(/\u00a0/g, ' ');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeInternationalPrefix(value) {
  const cleaned = cleanRawPhone(value);
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  return cleaned;
}

function countryCallingCode(countryIso) {
  if (!countryIso) return null;
  try {
    return getCountryCallingCode(countryIso);
  } catch {
    return null;
  }
}

function looksAmbiguousWithoutCountry(raw, digits) {
  return !raw.trim().startsWith('+') && digits.length <= 10 && /[-()\s]/.test(raw);
}

function looksLikeChinaInternational(rawPhone, digits) {
  const normalized = normalizeInternationalPrefix(rawPhone);
  if (normalized.startsWith('+86')) return digits.length >= 12;
  return !normalized.startsWith('+') && digits.startsWith('86') && digits.length >= 12;
}

function chinaE164FromRaw(rawPhone, digits) {
  const normalized = normalizeInternationalPrefix(rawPhone);
  const normalizedDigits = digitsOnly(normalized);
  if (normalized.startsWith('+86')) return `+${normalizedDigits}`;
  return `+${digits.startsWith('86') ? digits : `86${digits}`}`;
}

function buildChinaSkippedResult({ rawPhone, countryIso, e164, languageOverride }) {
  const languageInfo = detectLanguage({ e164, countryIso, languageOverride });
  return {
    rawPhone,
    countryIso,
    status: 'china-skipped',
    e164,
    nationalNumber: e164 ? e164.replace('+86', '') : null,
    whatsappId: null,
    isChinaNumber: true,
    language: languageInfo.language,
    languageReason: languageInfo.reason,
    error: 'china-number-skipped'
  };
}

function buildResult({ rawPhone, countryIso, parsed, languageOverride, status = 'valid', error = null }) {
  const e164 = parsed ? parsed.number : null;
  const languageInfo = detectLanguage({ e164, countryIso, languageOverride });
  return {
    rawPhone,
    countryIso,
    status,
    e164,
    nationalNumber: parsed ? parsed.nationalNumber : null,
    whatsappId: e164 ? `${e164.replace('+', '')}@c.us` : null,
    isChinaNumber: Boolean(parsed && (parsed.country === 'CN' || parsed.number.startsWith('+86'))),
    language: languageInfo.language,
    languageReason: languageInfo.reason,
    error
  };
}

function parseWithFallback(rawPhone, countryIso) {
  const normalized = normalizeInternationalPrefix(rawPhone);
  const digits = digitsOnly(normalized);
  const code = countryCallingCode(countryIso);

  const candidates = [];
  if (normalized.startsWith('+')) candidates.push(normalized);
  if (countryIso && code && digits.startsWith(code)) candidates.push(`+${digits}`);
  if (countryIso) candidates.push(normalized);
  if (!countryIso && digits.length >= 10) candidates.push(`+${digits}`);

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate, countryIso || undefined);
    if (parsed && (parsed.isValid() || parsed.isPossible())) return parsed;
  }

  return null;
}

function parsePhoneRow(row = {}, options = {}) {
  const skipChinaNumbers = options.skipChinaNumbers !== false;
  const rawPhone = cleanRawPhone(row.phone);
  const countryIso = normalizeCountry(row.country);
  const languageOverride = row.language;
  const digits = digitsOnly(rawPhone);

  if (!rawPhone || !digits) {
    return {
      rawPhone,
      countryIso,
      status: 'invalid',
      e164: null,
      nationalNumber: null,
      whatsappId: null,
      language: 'en',
      languageReason: 'default',
      error: 'missing-phone'
    };
  }

  if (skipChinaNumbers && looksLikeChinaInternational(rawPhone, digits)) {
    return buildChinaSkippedResult({
      rawPhone,
      countryIso,
      e164: chinaE164FromRaw(rawPhone, digits),
      languageOverride
    });
  }

  if (!countryIso && looksAmbiguousWithoutCountry(rawPhone, digits)) {
    return {
      rawPhone,
      countryIso: null,
      status: 'pending',
      e164: null,
      nationalNumber: null,
      whatsappId: null,
      language: 'en',
      languageReason: 'default',
      error: 'country-required'
    };
  }

  const parsed = parseWithFallback(rawPhone, countryIso);
  if (!parsed) {
    if (countryIso && /[-()\s]/.test(rawPhone) && digits.length >= 8) {
      const languageInfo = detectLanguage({
        e164: `+${countryCallingCode(countryIso) || ''}${digits}`,
        countryIso,
        languageOverride
      });
      return {
        rawPhone,
        countryIso,
        status: 'pending',
        e164: null,
        nationalNumber: null,
        whatsappId: null,
        language: languageInfo.language,
        languageReason: languageInfo.reason,
        error: 'ambiguous-or-invalid-for-country'
      };
    }

    return {
      rawPhone,
      countryIso,
      status: 'invalid',
      e164: null,
      nationalNumber: null,
      whatsappId: null,
      language: 'en',
      languageReason: 'default',
      error: 'unparseable-phone'
    };
  }

  if (skipChinaNumbers && (parsed.country === 'CN' || parsed.number.startsWith('+86'))) {
    return buildChinaSkippedResult({
      rawPhone,
      countryIso: countryIso || parsed.country,
      e164: parsed.number,
      languageOverride
    });
  }

  return buildResult({ rawPhone, countryIso, parsed, languageOverride });
}

module.exports = {
  cleanRawPhone,
  digitsOnly,
  parsePhoneRow
};
