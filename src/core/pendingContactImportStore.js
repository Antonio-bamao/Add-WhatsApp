const fs = require('node:fs');
const path = require('node:path');

class PendingContactImportStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  list() {
    return this.#read().items;
  }

  upsert({ payload, reason = 'UNKNOWN' } = {}) {
    const clientImportKey = String(payload && payload.clientImportKey ? payload.clientImportKey : '');
    if (!clientImportKey) throw new Error('PENDING_CONTACT_IMPORT_KEY_REQUIRED');
    const persisted = {
      clientImportKey,
      payload,
      reason,
      attempts: 0,
      updatedAt: new Date().toISOString()
    };
    const data = this.#read();
    const index = data.items.findIndex(item => item.clientImportKey === clientImportKey);
    if (index >= 0) {
      persisted.attempts = Number(data.items[index].attempts || 0);
      data.items[index] = { ...data.items[index], ...persisted };
    } else {
      data.items.push({ ...persisted, createdAt: persisted.updatedAt });
    }
    this.#write(data);
    return persisted;
  }

  markAttempt(clientImportKey, reason = 'UNKNOWN') {
    const data = this.#read();
    const index = data.items.findIndex(item => item.clientImportKey === clientImportKey);
    if (index < 0) return null;
    data.items[index] = {
      ...data.items[index],
      reason,
      attempts: Number(data.items[index].attempts || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    this.#write(data);
    return data.items[index];
  }

  remove(clientImportKey) {
    const data = this.#read();
    const items = data.items.filter(item => item.clientImportKey !== clientImportKey);
    if (items.length === data.items.length) return;
    this.#write({ items });
  }

  #read() {
    try {
      if (!fs.existsSync(this.filePath)) return { items: [] };
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return { items: Array.isArray(parsed.items) ? parsed.items : [] };
    } catch {
      return { items: [] };
    }
  }

  #write(payload) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify({ items: payload.items || [] }, null, 2));
  }
}

module.exports = {
  PendingContactImportStore
};
