const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAnalytics } = require('../src/core/analytics');

test('aggregates final contact outcomes without double counting retried rows', () => {
  const analytics = buildAnalytics({
    now: '2026-06-06T12:00:00.000Z',
    days: 30,
    progressEntries: [{
      sourceFile: 'C:\\lists\\customers.xlsx',
      sent: [
        { rowNumber: 2, language: 'en', date: '2026-06-05' },
        { rowNumber: 3, language: 'es', date: '2026-06-06' }
      ],
      failed: [
        { rowNumber: 2, fatal: true, date: '2026-06-04' },
        { rowNumber: 4, fatal: false, date: '2026-06-06' }
      ],
      skipped: [
        { rowNumber: 5, reason: 'unregistered', date: '2026-06-06' }
      ],
      invalid: [
        { rowNumber: 6, status: 'duplicate', date: '2026-06-06' }
      ]
    }],
    history: [
      { id: 'run-1', sourceFile: 'C:\\lists\\customers.xlsx', startedAt: '2026-06-06T10:00:00.000Z', finishedAt: '2026-06-06T10:10:00.000Z', reason: 'complete' }
    ]
  });

  assert.deepEqual(analytics.summary, {
    sent: 2,
    processed: 5,
    failed: 1,
    unregistered: 1,
    invalid: 1,
    successRate: 66.7,
    completedTasks: 1,
    activeDays: 2,
    currentStreak: 2,
    longestStreak: 2,
    peakSent: 1
  });
  assert.equal(analytics.daily.find(item => item.date === '2026-06-04').failed, 0);
  assert.deepEqual(analytics.languages, [
    { language: 'en', count: 1 },
    { language: 'es', count: 1 }
  ]);
  assert.equal(analytics.sources[0].sourceFile, 'customers.xlsx');
  assert.equal(analytics.sources[0].sent, 2);
  assert.equal(analytics.sources[0].anomalies, 3);
  assert.equal(analytics.sources[0].successRate, 66.7);
  assert.deepEqual(analytics.activity.sent, {
    peak: 1,
    activeDays: 2,
    currentStreak: 2,
    longestStreak: 2
  });
  assert.deepEqual(analytics.activity.processed, {
    peak: 4,
    activeDays: 2,
    currentStreak: 2,
    longestStreak: 2
  });
});

test('fills the requested date range and calculates a current streak through yesterday', () => {
  const analytics = buildAnalytics({
    now: '2026-06-06T00:30:00.000Z',
    days: 5,
    progressEntries: [{
      sourceFile: 'customers.csv',
      sent: [
        { rowNumber: 2, language: 'fr', date: '2026-06-03' },
        { rowNumber: 3, language: 'fr', date: '2026-06-04' },
        { rowNumber: 4, language: 'fr', date: '2026-06-05' }
      ],
      failed: [],
      skipped: [],
      invalid: []
    }],
    history: []
  });

  assert.deepEqual(analytics.daily.map(item => item.date), [
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06'
  ]);
  assert.equal(analytics.summary.currentStreak, 3);
  assert.equal(analytics.summary.longestStreak, 3);
  assert.equal(analytics.summary.activeDays, 3);
  assert.deepEqual(analytics.languages, [{ language: 'fr', count: 3 }]);
  assert.equal(analytics.activity.processed.peak, 1);
});

test('returns an empty but complete analytics response when no records exist', () => {
  const analytics = buildAnalytics({
    now: '2026-06-06T12:00:00.000Z',
    days: 3,
    progressEntries: [],
    history: []
  });

  assert.equal(analytics.daily.length, 3);
  assert.ok(analytics.daily.every(item => item.processed === 0));
  assert.deepEqual(analytics.languages, []);
  assert.deepEqual(analytics.sources, []);
  assert.equal(analytics.summary.successRate, 0);
});
