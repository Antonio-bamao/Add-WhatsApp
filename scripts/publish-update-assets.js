const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { compareVersions } = require('../src/main/updateManager');

function fileDigest(filePath, algorithm, encoding) {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest(encoding);
}

function copyFileAtomic(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporaryPath = `${destination}.tmp`;
  fs.copyFileSync(source, temporaryPath);
  fs.renameSync(temporaryPath, destination);
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function pruneStableArtifacts(stableDir, retainVersions = 3) {
  if (!fs.existsSync(stableDir)) return [];
  const versions = [...new Set(
    fs.readdirSync(stableDir)
      .map(name => /^Add-WhatsApp-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.exe(?:\.blockmap)?$/.exec(name))
      .filter(Boolean)
      .map(match => match[1])
  )].sort((left, right) => compareVersions(right, left));
  const removed = versions.slice(retainVersions);
  for (const version of removed) {
    for (const suffix of ['.exe', '.exe.blockmap']) {
      fs.rmSync(path.join(stableDir, `Add-WhatsApp-Setup-${version}${suffix}`), { force: true });
    }
  }
  return removed;
}

function publishUpdateAssets({
  version,
  distDir,
  downloadsDir,
  releaseDate = new Date().toISOString().slice(0, 10),
  phase = 'all',
  retainVersions = 3
}) {
  if (!['all', 'artifacts', 'metadata'].includes(phase)) {
    throw new Error('UPDATE_PUBLISH_PHASE_INVALID');
  }
  const installerName = `Add-WhatsApp-Setup-${version}.exe`;
  const installerPath = path.join(distDir, installerName);
  const blockmapPath = path.join(distDir, `${installerName}.blockmap`);
  const latestYmlPath = path.join(distDir, 'latest.yml');
  for (const requiredPath of [installerPath, blockmapPath, latestYmlPath]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`UPDATE_ARTIFACT_MISSING:${requiredPath}`);
  }

  const latest = YAML.parse(fs.readFileSync(latestYmlPath, 'utf8'));
  if (!latest || latest.version !== version || latest.path !== installerName) {
    throw new Error('UPDATE_METADATA_MISMATCH');
  }
  const sha512 = fileDigest(installerPath, 'sha512', 'base64');
  if (latest.sha512 !== sha512) throw new Error('UPDATE_SHA512_MISMATCH');
  const sizeBytes = fs.statSync(installerPath).size;
  if (latest.files && latest.files[0] && Number(latest.files[0].size) !== sizeBytes) {
    throw new Error('UPDATE_SIZE_MISMATCH');
  }

  const stableDir = path.join(downloadsDir, 'updates', 'win', 'stable');
  const stableInstallerPath = path.join(stableDir, installerName);
  const stableBlockmapPath = path.join(stableDir, `${installerName}.blockmap`);
  if (phase === 'all' || phase === 'artifacts') {
    copyFileAtomic(installerPath, stableInstallerPath);
    copyFileAtomic(blockmapPath, stableBlockmapPath);
    pruneStableArtifacts(stableDir, retainVersions);
  }

  const result = {
    version,
    fileName: installerName,
    sizeBytes,
    sha256: fileDigest(installerPath, 'sha256', 'hex'),
    sha512
  };
  if (phase === 'artifacts') return result;

  if (!fs.existsSync(stableInstallerPath) || !fs.existsSync(stableBlockmapPath)) {
    throw new Error('UPDATE_ARTIFACTS_NOT_PUBLISHED');
  }
  if (fileDigest(stableInstallerPath, 'sha512', 'base64') !== sha512) {
    throw new Error('UPDATE_PUBLISHED_ARTIFACT_MISMATCH');
  }
  copyFileAtomic(latestYmlPath, path.join(stableDir, 'latest.yml'));

  const latestDir = path.join(downloadsDir, 'latest');
  const latestInstallerName = 'Add-WhatsApp-Setup.exe';
  copyFileAtomic(installerPath, path.join(latestDir, latestInstallerName));
  const policyPath = path.join(latestDir, 'update.json');
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  } catch {
    previous = {};
  }
  const policy = {
    schemaVersion: 1,
    enabled: previous.enabled !== false,
    version,
    mandatoryOnNextLaunch: previous.mandatoryOnNextLaunch !== false,
    revokedVersions: Array.isArray(previous.revokedVersions) ? previous.revokedVersions : [],
    fileName: latestInstallerName,
    downloadUrl: `/downloads/latest/${latestInstallerName}`,
    updateFeedUrl: '/downloads/updates/win/stable/',
    releaseDate,
    sizeBytes,
    sha256: result.sha256,
    sha512,
    notesUrl: '/releases',
    releaseNotesUrl: 'https://addwhatsapp.com/releases'
  };
  writeJsonAtomic(policyPath, policy);
  return policy;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const phaseArgument = process.argv.find(argument => argument.startsWith('--phase='));
  const phase = phaseArgument ? phaseArgument.slice('--phase='.length) : 'all';
  const result = publishUpdateAssets({
    version: packageJson.version,
    distDir: path.join(root, 'dist'),
    downloadsDir: path.join(root, 'website', 'public', 'downloads'),
    phase
  });
  process.stdout.write(`Published ${phase} for ${result.version} (${result.sizeBytes} bytes)\n`);
}

module.exports = {
  pruneStableArtifacts,
  publishUpdateAssets
};
