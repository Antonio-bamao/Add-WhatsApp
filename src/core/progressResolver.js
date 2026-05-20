const fs = require('node:fs');
const path = require('node:path');
const { JsonProgressStore } = require('./progressStore');

function sameWorkbookName(left, right) {
  return Boolean(left && right && path.basename(left).toLowerCase() === path.basename(right).toLowerCase());
}

function progressScore(progressPath) {
  if (!progressPath || !fs.existsSync(progressPath)) return -1;
  const progress = new JsonProgressStore(progressPath).load();
  return Number(progress.lastIndex ?? -1);
}

function resolveProgressPathForSource({ sourceFile, defaultPath, historyItems = [] }) {
  const candidates = [defaultPath];
  for (const item of historyItems) {
    if (sameWorkbookName(item.sourceFile, sourceFile)) {
      candidates.push(item.progressPath);
    }
  }

  return candidates
    .filter(Boolean)
    .reduce((best, candidate) => (
      progressScore(candidate) > progressScore(best) ? candidate : best
    ), defaultPath);
}

module.exports = {
  resolveProgressPathForSource,
  sameWorkbookName
};
