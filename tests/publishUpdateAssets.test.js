const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const { publishUpdateAssets } = require('../scripts/publish-update-assets');

test('publishes immutable updater artifacts and atomically refreshes latest policy', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-publish-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const distDir = path.join(root, 'dist');
  const websiteDir = path.join(root, 'website', 'public', 'downloads');
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(websiteDir, 'latest'), { recursive: true });
  const installerName = 'Add-WhatsApp-Setup-0.1.5.exe';
  const installer = Buffer.from('installer-data');
  fs.writeFileSync(path.join(distDir, installerName), installer);
  fs.writeFileSync(path.join(distDir, `${installerName}.blockmap`), 'blockmap');
  const sha512 = crypto.createHash('sha512').update(installer).digest('base64');
  fs.writeFileSync(path.join(distDir, 'latest.yml'), YAML.stringify({
    version: '0.1.5',
    files: [{ url: installerName, sha512, size: installer.length }],
    path: installerName,
    sha512,
    releaseDate: '2026-06-06T00:00:00.000Z'
  }));
  fs.writeFileSync(path.join(websiteDir, 'latest', 'update.json'), JSON.stringify({
    enabled: true,
    revokedVersions: []
  }));

  const result = publishUpdateAssets({
    version: '0.1.5',
    distDir,
    downloadsDir: websiteDir,
    releaseDate: '2026-06-06'
  });

  assert.equal(result.version, '0.1.5');
  assert.ok(fs.existsSync(path.join(websiteDir, 'updates', 'win', 'stable', installerName)));
  assert.ok(fs.existsSync(path.join(websiteDir, 'updates', 'win', 'stable', `${installerName}.blockmap`)));
  assert.ok(fs.existsSync(path.join(websiteDir, 'updates', 'win', 'stable', 'latest.yml')));
  assert.deepEqual(
    fs.readFileSync(path.join(websiteDir, 'latest', 'Add-WhatsApp-Setup.exe')),
    installer
  );
  const policy = JSON.parse(fs.readFileSync(path.join(websiteDir, 'latest', 'update.json'), 'utf8'));
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.version, '0.1.5');
  assert.equal(policy.sizeBytes, installer.length);
  assert.equal(policy.sha512, sha512);
  assert.equal(policy.downloadUrl, '/downloads/latest/Add-WhatsApp-Setup.exe');
  assert.equal(policy.updateFeedUrl, '/downloads/updates/win/stable/');
});

test('refuses to publish when latest.yml hash does not match the installer', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-publish-bad-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'Add-WhatsApp-Setup-0.1.5.exe'), 'installer-data');
  fs.writeFileSync(path.join(root, 'dist', 'Add-WhatsApp-Setup-0.1.5.exe.blockmap'), 'blockmap');
  fs.writeFileSync(path.join(root, 'dist', 'latest.yml'), YAML.stringify({
    version: '0.1.5',
    path: 'Add-WhatsApp-Setup-0.1.5.exe',
    sha512: 'wrong'
  }));

  assert.throws(() => publishUpdateAssets({
    version: '0.1.5',
    distDir: path.join(root, 'dist'),
    downloadsDir: path.join(root, 'downloads')
  }), /UPDATE_SHA512_MISMATCH/);
});

test('supports artifact-first publishing and retains only three updater versions', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-publish-phases-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const distDir = path.join(root, 'dist');
  const downloadsDir = path.join(root, 'downloads');
  const stableDir = path.join(downloadsDir, 'updates', 'win', 'stable');
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(stableDir, { recursive: true });
  for (const oldVersion of ['0.1.4', '0.1.5', '0.1.6']) {
    fs.writeFileSync(path.join(stableDir, `Add-WhatsApp-Setup-${oldVersion}.exe`), oldVersion);
    fs.writeFileSync(path.join(stableDir, `Add-WhatsApp-Setup-${oldVersion}.exe.blockmap`), oldVersion);
  }
  const installerName = 'Add-WhatsApp-Setup-0.1.7.exe';
  const installer = Buffer.from('new-installer');
  const sha512 = crypto.createHash('sha512').update(installer).digest('base64');
  fs.writeFileSync(path.join(distDir, installerName), installer);
  fs.writeFileSync(path.join(distDir, `${installerName}.blockmap`), 'blockmap');
  fs.writeFileSync(path.join(distDir, 'latest.yml'), YAML.stringify({
    version: '0.1.7',
    files: [{ url: installerName, sha512, size: installer.length }],
    path: installerName,
    sha512
  }));

  publishUpdateAssets({
    version: '0.1.7',
    distDir,
    downloadsDir,
    phase: 'artifacts'
  });

  assert.ok(fs.existsSync(path.join(stableDir, installerName)));
  assert.equal(fs.existsSync(path.join(stableDir, 'latest.yml')), false);
  assert.equal(fs.existsSync(path.join(downloadsDir, 'latest', 'update.json')), false);
  assert.equal(fs.existsSync(path.join(stableDir, 'Add-WhatsApp-Setup-0.1.4.exe')), false);
  assert.ok(fs.existsSync(path.join(stableDir, 'Add-WhatsApp-Setup-0.1.5.exe')));

  publishUpdateAssets({
    version: '0.1.7',
    distDir,
    downloadsDir,
    phase: 'metadata'
  });

  assert.ok(fs.existsSync(path.join(stableDir, 'latest.yml')));
  assert.ok(fs.existsSync(path.join(downloadsDir, 'latest', 'update.json')));
});
