const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('renderer exposes a cloud account panel wired to preload cloud APIs', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const preload = fs.readFileSync(path.join(root, 'src', 'main', 'preload.js'), 'utf-8');

  for (const id of [
    'cloudAccountPanel',
    'cloudLoginForm',
    'cloudUsernameInput',
    'cloudPasswordInput',
    'cloudStatusText',
    'cloudRefreshButton',
    'cloudLogoutButton'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(renderer, new RegExp(id));
  }

  assert.match(preload, /loginCloudAccount/);
  assert.match(preload, /refreshCloudEntitlements/);
  assert.match(preload, /logoutCloudAccount/);
  assert.match(renderer, /loginCloudAccount/);
  assert.match(renderer, /refreshCloudEntitlements/);
  assert.match(renderer, /logoutCloudAccount/);
});

test('pricing page makes payment maintenance and package locks visible', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');

  assert.match(html, /id="planPaymentNotice"/);
  assert.match(html, /支付宝沙盒官方异常修复中/);
  assert.match(renderer, /支付维护中/);
  assert.match(renderer, /lockedFeatureList/);
});

test('task controls enforce package daily limit and 44 second minimum delay', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const main = fs.readFileSync(path.join(root, 'src', 'main', 'main.js'), 'utf-8');

  assert.match(html, /id="delayMinInput" type="number" min="44" value="44"/);
  assert.match(html, /id="delayMaxInput" type="number" min="44"/);
  assert.match(renderer, /elements\.dailyLimitInput\.value = String\(plan\.dailyLimit\)/);
  assert.match(renderer, /Math\.max\(44, minDelay\)/);
  assert.match(main, /Math\.max\(44, Number\(config\.delayMinSeconds \|\| 44\)\)/);
});
