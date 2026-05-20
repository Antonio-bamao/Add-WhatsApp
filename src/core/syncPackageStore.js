const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SYNC_PACKAGE_VERSION = 1;

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password || ''), salt, 32);
}

function sanitizePayload(payload) {
  return {
    account: payload.account || null,
    history: Array.isArray(payload.history) ? payload.history : [],
    progress: Array.isArray(payload.progress) ? payload.progress : [],
    exportedAt: payload.exportedAt || new Date().toISOString()
  };
}

class SyncPackageStore {
  exportPackage({ filePath, password, payload }) {
    if (!filePath) throw new Error('同步包路径不能为空。');
    if (!password || String(password).length < 8) throw new Error('同步包密码至少 8 位。');

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = deriveKey(password, salt);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(sanitizePayload(payload)), 'utf-8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
      version: SYNC_PACKAGE_VERSION,
      kdf: 'scrypt',
      cipher: 'aes-256-gcm',
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64')
    }, null, 2));
    return { filePath };
  }

  importPackage({ filePath, password }) {
    let envelope;
    try {
      envelope = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      throw new Error('同步包无法读取。');
    }

    if (!envelope || envelope.version !== SYNC_PACKAGE_VERSION) {
      throw new Error('同步包版本不支持。');
    }

    try {
      const salt = Buffer.from(envelope.salt, 'base64');
      const iv = Buffer.from(envelope.iv, 'base64');
      const tag = Buffer.from(envelope.tag, 'base64');
      const encrypted = Buffer.from(envelope.data, 'base64');
      const key = deriveKey(password, salt);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return {
        version: envelope.version,
        payload: JSON.parse(decrypted.toString('utf-8'))
      };
    } catch {
      throw new Error('同步包密码不正确，或文件已损坏。');
    }
  }
}

module.exports = {
  SYNC_PACKAGE_VERSION,
  SyncPackageStore,
  sanitizePayload
};
