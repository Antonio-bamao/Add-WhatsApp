const fs = require('node:fs');
const path = require('node:path');

class JsonHistoryStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  list() {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      const items = Array.isArray(parsed) ? parsed : [];
      return items.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
    } catch {
      return [];
    }
  }

  append(entry) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const items = [entry, ...this.list()].slice(0, 200);
    fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2));
    return items;
  }
}

module.exports = {
  JsonHistoryStore
};
