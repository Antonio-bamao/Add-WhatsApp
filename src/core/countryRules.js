const COUNTRY_ALIASES = new Map([
  ['us', 'US'],
  ['usa', 'US'],
  ['u.s.', 'US'],
  ['united states', 'US'],
  ['united states of america', 'US'],
  ['america', 'US'],
  ['美国', 'US'],
  ['ca', 'CA'],
  ['canada', 'CA'],
  ['加拿大', 'CA'],
  ['gb', 'GB'],
  ['uk', 'GB'],
  ['united kingdom', 'GB'],
  ['great britain', 'GB'],
  ['england', 'GB'],
  ['英国', 'GB'],
  ['fr', 'FR'],
  ['france', 'FR'],
  ['法国', 'FR'],
  ['es', 'ES'],
  ['spain', 'ES'],
  ['españa', 'ES'],
  ['西班牙', 'ES'],
  ['de', 'DE'],
  ['germany', 'DE'],
  ['deutschland', 'DE'],
  ['德国', 'DE'],
  ['mx', 'MX'],
  ['mexico', 'MX'],
  ['méxico', 'MX'],
  ['墨西哥', 'MX'],
  ['ar', 'AR'],
  ['argentina', 'AR'],
  ['阿根廷', 'AR'],
  ['cl', 'CL'],
  ['chile', 'CL'],
  ['智利', 'CL'],
  ['co', 'CO'],
  ['colombia', 'CO'],
  ['哥伦比亚', 'CO'],
  ['pe', 'PE'],
  ['peru', 'PE'],
  ['perú', 'PE'],
  ['秘鲁', 'PE'],
  ['ve', 'VE'],
  ['venezuela', 'VE'],
  ['委内瑞拉', 'VE'],
  ['au', 'AU'],
  ['australia', 'AU'],
  ['澳大利亚', 'AU'],
  ['nz', 'NZ'],
  ['new zealand', 'NZ'],
  ['新西兰', 'NZ'],
  ['ie', 'IE'],
  ['ireland', 'IE'],
  ['爱尔兰', 'IE'],
  ['be', 'BE'],
  ['belgium', 'BE'],
  ['比利时', 'BE'],
  ['ch', 'CH'],
  ['switzerland', 'CH'],
  ['瑞士', 'CH'],
  ['lu', 'LU'],
  ['luxembourg', 'LU'],
  ['卢森堡', 'LU']
]);

function normalizeCountry(value) {
  if (!value) return null;
  const normalized = String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (!normalized) return null;
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  return COUNTRY_ALIASES.get(normalized) || null;
}

module.exports = {
  COUNTRY_ALIASES,
  normalizeCountry
};
