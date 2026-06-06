const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

async function responseSha512(response) {
  const hash = crypto.createHash('sha512');
  for await (const chunk of response.body) hash.update(chunk);
  return hash.digest('base64');
}

async function verifyHostedUpdate({
  baseUrl,
  version,
  installerPath,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') throw new Error('UPDATE_VERIFY_FETCH_UNAVAILABLE');
  const fileName = `Add-WhatsApp-Setup-${version}.exe`;
  const url = new URL(fileName, baseUrl).toString();
  const expectedSize = fs.statSync(installerPath).size;
  const expectedSha512 = crypto.createHash('sha512')
    .update(fs.readFileSync(installerPath))
    .digest('base64');

  const head = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' });
  if (!head.ok) throw new Error(`UPDATE_VERIFY_HEAD_HTTP_${head.status}`);
  if (Number(head.headers.get('content-length')) !== expectedSize) {
    throw new Error('UPDATE_VERIFY_CONTENT_LENGTH_MISMATCH');
  }

  const range = await fetchImpl(url, {
    headers: { range: 'bytes=0-0' },
    cache: 'no-store'
  });
  if (range.status !== 206) throw new Error(`UPDATE_VERIFY_RANGE_HTTP_${range.status}`);
  if (range.headers.get('content-range') !== `bytes 0-0/${expectedSize}`) {
    throw new Error('UPDATE_VERIFY_CONTENT_RANGE_MISMATCH');
  }

  const download = await fetchImpl(url, { cache: 'no-store' });
  if (!download.ok) throw new Error(`UPDATE_VERIFY_DOWNLOAD_HTTP_${download.status}`);
  if (Number(download.headers.get('content-length')) !== expectedSize) {
    throw new Error('UPDATE_VERIFY_DOWNLOAD_SIZE_MISMATCH');
  }
  if (await responseSha512(download) !== expectedSha512) {
    throw new Error('UPDATE_VERIFY_SHA512_MISMATCH');
  }
  return { ok: true, url, sizeBytes: expectedSize, sha512: expectedSha512 };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  verifyHostedUpdate({
    baseUrl: process.env.UPDATE_FEED_URL
      || 'https://addwhatsapp.com/downloads/updates/win/stable/',
    version: packageJson.version,
    installerPath: path.join(root, 'dist', `Add-WhatsApp-Setup-${packageJson.version}.exe`)
  }).then(result => {
    process.stdout.write(`Verified ${result.url} (${result.sizeBytes} bytes)\n`);
  }).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  verifyHostedUpdate
};
