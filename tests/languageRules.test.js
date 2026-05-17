const test = require('node:test');
const assert = require('node:assert/strict');

const { detectLanguage } = require('../src/core/languageRules');

test('detects French for France calling code', () => {
  assert.equal(detectLanguage({ e164: '+33788346039', countryIso: 'FR' }).language, 'fr');
});

test('detects Spanish for Spain and Mexico calling codes', () => {
  assert.equal(detectLanguage({ e164: '+34600111222', countryIso: 'ES' }).language, 'es');
  assert.equal(detectLanguage({ e164: '+525512345678', countryIso: 'MX' }).language, 'es');
});

test('detects English for United States and United Kingdom calling codes', () => {
  assert.equal(detectLanguage({ e164: '+12566654606', countryIso: 'US' }).language, 'en');
  assert.equal(detectLanguage({ e164: '+447851692353', countryIso: 'GB' }).language, 'en');
});

test('uses NANP area overrides before defaulting to English', () => {
  assert.equal(detectLanguage({ e164: '+17875550100', countryIso: 'US' }).language, 'es');
  assert.equal(detectLanguage({ e164: '+15145550100', countryIso: 'CA' }).language, 'fr');
  assert.equal(detectLanguage({ e164: '+13025550100', countryIso: 'US' }).language, 'en');
});

test('defaults unsupported countries to English with a default reason', () => {
  const result = detectLanguage({ e164: '+4917685664819', countryIso: 'DE' });

  assert.equal(result.language, 'en');
  assert.equal(result.reason, 'default');
});
