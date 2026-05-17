const fs = require('node:fs');
const path = require('node:path');

function defaultProgress() {
  return {
    version: 1,
    taskId: null,
    sourceFile: null,
    lastIndex: -1,
    sent: [],
    failed: [],
    skipped: [],
    invalid: []
  };
}

class JsonProgressStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    if (!fs.existsSync(this.filePath)) return defaultProgress();

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      return {
        ...defaultProgress(),
        ...parsed,
        sent: Array.isArray(parsed.sent) ? parsed.sent : [],
        failed: Array.isArray(parsed.failed) ? parsed.failed : [],
        skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
        invalid: Array.isArray(parsed.invalid) ? parsed.invalid : []
      };
    } catch {
      return defaultProgress();
    }
  }

  save(progress) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify({ ...defaultProgress(), ...progress }, null, 2));
  }
}

function countSentToday(progress, today) {
  return progress.sent.filter(record => record.date === today).length;
}

module.exports = {
  JsonProgressStore,
  countSentToday,
  defaultProgress
};
