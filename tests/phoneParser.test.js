const test = require('node:test');
const assert = require('node:assert/strict');

const { parsePhoneRow } = require('../src/core/phoneParser');

test('parses compact French international number as French', () => {
  const result = parsePhoneRow({ phone: '33781387438', country: '法国' });

  assert.equal(result.status, 'valid');
  assert.equal(result.e164, '+33781387438');
  assert.equal(result.whatsappId, '33781387438@c.us');
  assert.equal(result.language, 'fr');
});

test('parses French number with country code separated by hyphen', () => {
  const result = parsePhoneRow({ phone: '33-771147488', country: 'France' });

  assert.equal(result.status, 'valid');
  assert.equal(result.e164, '+33771147488');
  assert.equal(result.language, 'fr');
});

test('parses French spaced number as international when country is France', () => {
  const result = parsePhoneRow({ phone: '33 7 88 34 60 39', country: 'FR' });

  assert.equal(result.status, 'valid');
  assert.equal(result.e164, '+33788346039');
  assert.equal(result.language, 'fr');
});

test('uses country column to parse US local phone numbers', () => {
  const result = parsePhoneRow({ phone: '(256) 665-4606', country: '美国' });

  assert.equal(result.status, 'valid');
  assert.equal(result.e164, '+12566654606');
  assert.equal(result.language, 'en');
});

test('uses country context to resolve ambiguous grouped numbers safely', () => {
  const french = parsePhoneRow({ phone: '337-340-6764', country: '法国' });
  const us = parsePhoneRow({ phone: '337-340-6764', country: '美国' });

  assert.equal(french.status, 'pending');
  assert.equal(french.error, 'ambiguous-or-invalid-for-country');
  assert.equal(us.status, 'valid');
  assert.equal(us.e164, '+13373406764');
  assert.equal(us.language, 'en');
});

test('marks ambiguous numbers without country as pending', () => {
  const result = parsePhoneRow({ phone: '337-340-6764', country: '' });

  assert.equal(result.status, 'pending');
});
