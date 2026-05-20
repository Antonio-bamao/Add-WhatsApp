const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_MARKER = path.join('state', 'legacy-migration.json');

function copyFileIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

function copyDirectoryFilesIfMissing(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return 0;
  let copied = 0;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyDirectoryFilesIfMissing(source, target);
    } else if (entry.isFile() && !fs.existsSync(target)) {
      fs.copyFileSync(source, target);
      copied += 1;
    }
  }
  return copied;
}

function hasLegacyData(userDataPath) {
  return [
    path.join(userDataPath, 'history', 'runs.json'),
    path.join(userDataPath, 'progress'),
    path.join(userDataPath, 'state', 'last-import.json'),
    path.join(userDataPath, 'templates.json'),
    path.join(userDataPath, 'whatsapp-session')
  ].some(item => fs.existsSync(item));
}

function migrateLegacyUserData({ userDataPath, accountDir }) {
  const markerPath = path.join(accountDir, MIGRATION_MARKER);
  if (fs.existsSync(markerPath)) {
    return { migrated: false, reason: 'already-migrated' };
  }

  if (!hasLegacyData(userDataPath)) {
    return { migrated: false, reason: 'no-legacy-data' };
  }

  const copied = {
    history: copyFileIfMissing(
      path.join(userDataPath, 'history', 'runs.json'),
      path.join(accountDir, 'history', 'runs.json')
    ) ? 1 : 0,
    state: copyFileIfMissing(
      path.join(userDataPath, 'state', 'last-import.json'),
      path.join(accountDir, 'state', 'last-import.json')
    ) ? 1 : 0,
    templates: copyFileIfMissing(
      path.join(userDataPath, 'templates.json'),
      path.join(accountDir, 'templates.json')
    ) ? 1 : 0,
    progress: copyDirectoryFilesIfMissing(
      path.join(userDataPath, 'progress'),
      path.join(accountDir, 'progress')
    ),
    whatsappSession: copyDirectoryFilesIfMissing(
      path.join(userDataPath, 'whatsapp-session'),
      path.join(accountDir, 'whatsapp-session')
    )
  };

  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, JSON.stringify({
    migratedAt: new Date().toISOString(),
    copied
  }, null, 2));

  return {
    migrated: true,
    copied
  };
}

module.exports = {
  migrateLegacyUserData
};
