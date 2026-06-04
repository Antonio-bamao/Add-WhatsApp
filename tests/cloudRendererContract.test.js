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

test('account settings shows the current database user uid', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const main = fs.readFileSync(path.join(root, 'src', 'main', 'main.js'), 'utf-8');
  const restorer = fs.readFileSync(path.join(root, 'src', 'main', 'cloudSessionRestorer.js'), 'utf-8');

  assert.match(html, /id="accountUidValue"/);
  assert.match(html, />UID</);
  assert.match(renderer, /accountUidValue: document\.getElementById\('accountUidValue'\)/);
  assert.match(renderer, /function displayUserUid\(user = {}\)/);
  assert.match(renderer, /user\.uid/);
  assert.doesNotMatch(renderer, /user\.cloudUserId \|\| user\.accountId \|\| user\.id/);
  assert.match(renderer, /const uid = authenticated \? displayUserUid\(state\.auth\.user\) : '-'/);
  assert.match(renderer, /elements\.accountUidValue\.textContent = uid/);
  assert.match(main, /function shortUserUid\(userId\)/);
  assert.match(main, /const uidSource = user\.id \|\| user\.cloudUserId \|\| user\.accountId/);
  assert.match(main, /uid: user\.uid \|\| \(uidSource \? shortUserUid\(uidSource\) : null\)/);
  assert.match(restorer, /function shortUserUid\(userId\)/);
  assert.match(restorer, /const uidSource = user\.id \|\| user\.cloudUserId \|\| user\.accountId/);
  assert.match(restorer, /uid: user\.uid \|\| \(uidSource \? shortUserUid\(uidSource\) : null\)/);
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
  assert.match(html, /id="paymentCountdown"/);
  assert.match(html, /id="paymentCancelButton"/);
  assert.match(html, /id="paymentRetryButton"/);
  assert.match(renderer, /startWechatTopUp/);
  assert.match(renderer, /renderWechatPaymentLoading/);
  assert.match(renderer, /支付链路正在加载中/);
  assert.match(renderer, /payment-loading-spinner/);
  assert.match(renderer, /renderWechatPayment/);
  assert.match(renderer, /payment\.codeUrl/);
  assert.match(renderer, /PAYMENT_ORDER_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(renderer, /closePaymentOrder/);
  assert.match(renderer, /getPaymentOrderStatus/);
  assert.match(renderer, /listPaymentOrders/);
  assert.match(renderer, /function refreshBillingOrders/);
  assert.match(renderer, /renderBillingHistory/);
  assert.match(renderer, /billingHistoryBody/);
  assert.match(renderer, /paymentCancelButton/);
  assert.match(renderer, /paymentRetryButton/);
  assert.match(renderer, /function renderPaymentClosingState/);
  assert.match(renderer, /renderPaymentClosingState\(isExpired \? '订单已超时，正在关闭支付链路\.\.\.' : '正在关闭支付链路\.\.\.'\)/);
  assert.match(renderer, /支付链路正在关闭，二维码已停止显示。/);
  assert.match(renderer, /function renderPaymentUnavailable/);
  assert.match(renderer, /订单已失效，可重新生成/);
  assert.doesNotMatch(renderer, /服务端还没有确认关单|二维码继续隐藏|NOT_FOUND|ORDER_NOT_FOUND|WECHAT_CLOSE_ORDER_TIMEOUT/);
  assert.match(renderer, /openExternalUrl/);
  assert.match(renderer, /copyText/);
  assert.match(renderer, /response\.authRequired \|\| response\.error === 'UNAUTHORIZED'/);
  assert.match(renderer, /finally\s*{\s*updateActionLocks\(\);/);
  assert.match(preload, /startWechatTopUp/);
  assert.match(preload, /getPaymentOrderStatus/);
  assert.match(preload, /closePaymentOrder/);
  assert.match(preload, /listPaymentOrders/);
  assert.match(preload, /openExternalUrl/);
  assert.match(preload, /copyText/);
  assert.match(main, /cloud:wechat-top-up/);
  assert.match(main, /cloud:order-status/);
  assert.match(main, /cloud:close-payment-order/);
  assert.match(main, /app:open-external-url/);
  assert.match(main, /qrImageDataUrl/);
  assert.doesNotMatch(main, /openDevTools|toggleDevTools|before-input-event|F12/);
  assert.match(renderer, /startManualTopUp/);
  assert.match(renderer, /assets\/pay\/alipay-qr\.png/);
  assert.match(renderer, /manualPaymentQr\.onerror/);
  assert.match(preload, /startManualTopUp/);
  assert.match(main, /cloud:manual-top-up/);
  assert.doesNotMatch(html, /支付宝沙盒官方异常修复中/);
  assert.doesNotMatch(renderer, /支付维护中/);
  assert.match(main, /devTools:\s*false/);
  assert.match(main, /process\.on\('unhandledRejection'/);
  assert.match(main, /isKnownWhatsAppAutomationRejection/);
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

test('contact import audit uploads both manual and restored imports without renderer UI changes', () => {
  const main = fs.readFileSync(path.join(root, 'src', 'main', 'main.js'), 'utf-8');

  assert.match(main, /contacts:select-and-import[\s\S]*queueContactImportAuditUpload\(data, currentImportOptions\)/);

  const restoreStart = main.indexOf('function restoreLastImport()');
  assert.notEqual(restoreStart, -1);
  const restoreEnd = main.indexOf('function getImportedSummary()', restoreStart);
  assert.notEqual(restoreEnd, -1);
  const restoreBody = main.slice(restoreStart, restoreEnd);
  assert.match(restoreBody, /queueContactImportAuditUpload\(data, currentImportOptions\)/);
});
