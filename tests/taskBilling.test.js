const assert = require('node:assert/strict');
const test = require('node:test');

const { selectNewlySentRows } = require('../src/core/taskBilling');

test('selects only the rows sent during the current run', () => {
  const progress = {
    sent: [
      { rowNumber: 1, whatsappId: 'old@c.us' },
      { rowNumber: 2, whatsappId: 'new-1@c.us' },
      { rowNumber: 3, whatsappId: 'new-2@c.us' }
    ]
  };

  assert.deepEqual(selectNewlySentRows(progress, 1), [
    { rowNumber: 2, whatsappId: 'new-1@c.us' },
    { rowNumber: 3, whatsappId: 'new-2@c.us' }
  ]);
});

test('returns an empty list when the progress snapshot has no new successful sends', () => {
  assert.deepEqual(selectNewlySentRows({ sent: [{ rowNumber: 1 }] }, 1), []);
  assert.deepEqual(selectNewlySentRows(null, 0), []);
});
