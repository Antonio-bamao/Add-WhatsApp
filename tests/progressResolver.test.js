const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { JsonProgressStore } = require('../src/core/progressStore');
const { resolveProgressPathForSource } = require('../src/core/progressResolver');

test('reuses the most advanced progress for the same workbook filename after moving folders', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-whatsapp-progress-resolver-'));
  const oldProgressPath = path.join(dir, 'old.json');
  const newProgressPath = path.join(dir, 'new.json');
  const oldSource = 'C:\\Users\\m1591\\Desktop\\2023.3.2(2318条)(2)(1).xlsx';
  const newSource = 'C:\\Users\\m1591\\Desktop\\运营\\客户名单\\2023.3.2(2318条)(2)(1).xlsx';

  new JsonProgressStore(oldProgressPath).save({ sourceFile: oldSource, lastIndex: 297 });
  new JsonProgressStore(newProgressPath).save({ sourceFile: newSource, lastIndex: 2 });

  const resolved = resolveProgressPathForSource({
    sourceFile: newSource,
    defaultPath: newProgressPath,
    historyItems: [{ sourceFile: oldSource, progressPath: oldProgressPath }]
  });

  assert.equal(resolved, oldProgressPath);
});
