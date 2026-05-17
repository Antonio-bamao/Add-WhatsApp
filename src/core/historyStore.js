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
      const items = Array.isArray(parsed) ? parsed : (parsed && parsed.id ? [parsed] : []);
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

  upsert(entry) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const items = this.list();
    const index = items.findIndex(item => item.id === entry.id);
    if (index >= 0) {
      items[index] = { ...items[index], ...entry };
    } else {
      items.unshift(entry);
    }
    const next = items.slice(0, 200);
    fs.writeFileSync(this.filePath, JSON.stringify(next, null, 2));
    return next;
  }

  markOpenInterrupted(finishedAt = new Date().toISOString()) {
    const items = this.list();
    let changed = false;
    const next = items.map(item => {
      if (item.reason === 'running' && !item.finishedAt) {
        changed = true;
        return {
          ...item,
          reason: 'interrupted',
          finishedAt,
          message: item.message || '上次任务异常中断，已保留进度。'
        };
      }
      return item;
    });
    if (changed) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(next, null, 2));
    }
    return next;
  }
}

module.exports = {
  JsonHistoryStore
};
