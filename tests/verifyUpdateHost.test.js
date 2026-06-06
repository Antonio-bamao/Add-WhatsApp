const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { verifyHostedUpdate } = require('../scripts/verify-update-host');

test('verifies hosted size, byte ranges, and sha512 before metadata publication', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-host-verify-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const installerPath = path.join(directory, 'Add-WhatsApp-Setup-0.1.5.exe');
  const installer = Buffer.from('hosted-installer');
  fs.writeFileSync(installerPath, installer);

  const fetchImpl = async (_url, options = {}) => {
    if (options.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { 'content-length': String(installer.length) }
      });
    }
    if (options.headers && options.headers.range) {
      return new Response(installer.subarray(0, 1), {
        status: 206,
        headers: {
          'content-length': '1',
          'content-range': `bytes 0-0/${installer.length}`
        }
      });
    }
    return new Response(installer, {
      status: 200,
      headers: { 'content-length': String(installer.length) }
    });
  };

  const result = await verifyHostedUpdate({
    baseUrl: 'https://example.com/updates/',
    version: '0.1.5',
    installerPath,
    fetchImpl
  });

  assert.equal(result.ok, true);
  assert.equal(result.sizeBytes, installer.length);
});

test('rejects a host that does not support range requests', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-host-range-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const installerPath = path.join(directory, 'Add-WhatsApp-Setup-0.1.5.exe');
  fs.writeFileSync(installerPath, 'installer');

  await assert.rejects(() => verifyHostedUpdate({
    baseUrl: 'https://example.com/updates/',
    version: '0.1.5',
    installerPath,
    fetchImpl: async (_url, options = {}) => new Response(
      options.method === 'HEAD' ? null : 'installer',
      {
        status: 200,
        headers: { 'content-length': '9' }
      }
    )
  }), /UPDATE_VERIFY_RANGE_HTTP_200/);
});
