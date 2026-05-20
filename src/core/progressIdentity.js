const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function createFileFingerprint(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function sourceIdentityFor(filePath) {
  if (!filePath) return null;
  return {
    fileName: path.basename(filePath),
    fileFingerprint: fs.existsSync(filePath) ? createFileFingerprint(filePath) : null
  };
}

function sameSourceIdentity(left = {}, right = {}) {
  if (left.fileFingerprint && right.fileFingerprint) {
    return left.fileFingerprint === right.fileFingerprint;
  }
  return Boolean(left.fileName && right.fileName && left.fileName.toLowerCase() === right.fileName.toLowerCase());
}

module.exports = {
  createFileFingerprint,
  sameSourceIdentity,
  sourceIdentityFor
};
