const fs = require('node:fs');
const path = require('node:path');

const MAX_PENDING_CONTACT_IMPORT_ATTEMPTS = 8;

class PendingContactImportStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  list({ retryableOnly = false } = {}) {
    const data = this.#read();
    const normalized = this.#normalize(data.items);
    if (normalized.changed) this.#write({ items: normalized.items });
    return retryableOnly ? normalized.items.filter(item => !item.giveUp) : normalized.items;
  }

  upsert({ payload, reason = 'UNKNOWN' } = {}) {
    const clientImportKey = String(payload && payload.clientImportKey ? payload.clientImportKey : '');
    if (!clientImportKey) throw new Error('PENDING_CONTACT_IMPORT_KEY_REQUIRED');
    const persisted = {
      clientImportKey,
      payload,
      reason,
      attempts: 0,
      giveUp: false,
      updatedAt: new Date().toISOString()
    };
    const data = this.#read();
    const index = data.items.findIndex(item => item.clientImportKey === clientImportKey);
    let stored;
    if (index >= 0) {
      persisted.attempts = Number(data.items[index].attempts || 0);
      const merged = { ...data.items[index], ...persisted };
      stored = { ...merged, giveUp: this.#shouldGiveUp(merged) };
      data.items[index] = stored;
    } else {
      stored = { ...persisted, giveUp: this.#shouldGiveUp(persisted), createdAt: persisted.updatedAt };
      data.items.push(stored);
    }
    this.#write(data);
    return stored;
  }

  markAttempt(clientImportKey, reason = 'UNKNOWN') {
    const data = this.#read();
    const index = data.items.findIndex(item => item.clientImportKey === clientImportKey);
    if (index < 0) return null;
    const updated = {
      ...data.items[index],
      reason,
      attempts: Number(data.items[index].attempts || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    data.items[index] = { ...updated, giveUp: this.#shouldGiveUp(updated) };
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

  #normalize(items) {
    let changed = false;
    const normalizedItems = items.map(item => {
      const normalized = {
        ...item,
        attempts: Number(item.attempts || 0),
        giveUp: this.#shouldGiveUp(item)
      };
      if (normalized.attempts !== item.attempts || normalized.giveUp !== item.giveUp) changed = true;
      return normalized;
    });
    return { items: normalizedItems, changed };
  }

  #shouldGiveUp(item = {}) {
    return String(item.reason || '').startsWith('PERMANENT_')
      || Number(item.attempts || 0) >= MAX_PENDING_CONTACT_IMPORT_ATTEMPTS;
  }

  #write(payload) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify({ items: payload.items || [] }, null, 2));
  }
}

module.exports = {
  PendingContactImportStore
};
