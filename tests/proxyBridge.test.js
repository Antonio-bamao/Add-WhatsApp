const test = require('node:test');
const assert = require('node:assert/strict');

const { parseConnectTarget, socksProxyOptions } = require('../src/main/proxyBridge');

test('parses HTTP CONNECT targets for the local proxy bridge', () => {
  assert.deepEqual(parseConnectTarget('web.whatsapp.com:443'), {
    host: 'web.whatsapp.com',
    port: 443
  });
});

test('keeps SOCKS5 credentials inside the local proxy bridge', () => {
  const options = socksProxyOptions({
    host: '86.104.162.245',
    port: 12324,
    username: 'user',
    password: 'secret'
  });

  assert.equal(options.host, '86.104.162.245');
  assert.equal(options.port, 12324);
  assert.equal(options.type, 5);
  assert.equal(options.userId, 'user');
  assert.equal(options.password, 'secret');
});
