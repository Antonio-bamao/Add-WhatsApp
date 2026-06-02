const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('auth surface uses one database account and removes the secondary cloud login panel', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const preload = fs.readFileSync(path.join(root, 'src', 'main', 'preload.js'), 'utf-8');
  const main = fs.readFileSync(path.join(root, 'src', 'main', 'main.js'), 'utf-8');

  for (const id of [
    'cloudAccountPanel',
    'cloudLoginForm',
    'cloudUsernameInput',
    'cloudPasswordInput',
    'downloadRecoveryButton',
    'resetPasswordForm'
  ]) {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`));
    assert.doesNotMatch(renderer, new RegExp(id));
  }

  assert.doesNotMatch(html, /本地账号|云端账号和套餐|恢复码/);
  assert.doesNotMatch(renderer, /请先在设置页登录云端账号|loginCloudAccount|logoutCloudAccount/);
  assert.doesNotMatch(preload, /loginCloudAccount|logoutCloudAccount/);
  assert.doesNotMatch(main, /new AuthStore|authStore\.login|authStore\.register/);
  assert.match(main, /cloudController\.login/);
  assert.match(main, /cloudController\.register/);
});

test('pricing page exposes official WeChat Native payment actions instead of maintenance copy', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const preload = fs.readFileSync(path.join(root, 'src', 'main', 'preload.js'), 'utf-8');
  const main = fs.readFileSync(path.join(root, 'src', 'main', 'main.js'), 'utf-8');

  assert.match(html, /id="quotaPayButton"/);
  assert.match(html, /id="manualPaymentPanel"/);
  assert.match(html, /微信 Native 扫码支付/);
  assert.match(html, /微信支付/);
  assert.match(html, /id="paymentLinkBox"/);
  assert.match(html, /id="paymentCopyButton"/);
  assert.match(html, /id="paymentOpenButton"/);
  assert.match(renderer, /startWechatTopUp/);
  assert.match(renderer, /renderWechatPayment/);
  assert.match(renderer, /payment\.codeUrl/);
  assert.match(renderer, /openExternalUrl/);
  assert.match(renderer, /copyText/);
  assert.match(renderer, /response\.authRequired \|\| response\.error === 'UNAUTHORIZED'/);
  assert.match(renderer, /finally\s*{\s*updateActionLocks\(\);/);
  assert.match(preload, /startWechatTopUp/);
  assert.match(preload, /openExternalUrl/);
  assert.match(preload, /copyText/);
  assert.match(main, /cloud:wechat-top-up/);
  assert.match(main, /app:open-external-url/);
  assert.match(main, /qrImageDataUrl/);
  assert.match(renderer, /startManualTopUp/);
  assert.match(renderer, /assets\/pay\/alipay-qr\.png/);
  assert.match(renderer, /manualPaymentQr\.onerror/);
  assert.match(preload, /startManualTopUp/);
  assert.match(main, /cloud:manual-top-up/);
  assert.doesNotMatch(html, /支付宝沙盒官方异常修复中/);
  assert.doesNotMatch(renderer, /支付维护中/);
  assert.match(renderer, /lockedFeatureList/);
  assert.match(html, /assets\/icon\.png/);
  assert.ok(fs.existsSync(path.join(root, 'assets', 'icon.png')));
  assert.ok(fs.existsSync(path.join(root, 'assets', 'icon.ico')));
  assert.ok(fs.existsSync(path.join(root, 'assets', 'pay', 'alipay-qr.png')));
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
