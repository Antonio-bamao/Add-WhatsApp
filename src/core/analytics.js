const path = require('node:path');

const OUTCOME_PRIORITY = {
  failed: 1,
  invalid: 2,
  unregistered: 3,
  sent: 4
};

function dateKey(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function addUtcDays(date, amount) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

function buildDateRange(today, days) {
  const safeDays = Math.max(1, Math.min(366, Number(days) || 365));
  const start = addUtcDays(today, -(safeDays - 1));
  return Array.from({ length: safeDays }, (_value, index) => addUtcDays(start, index));
}

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}

function eventKey(record, index) {
  if (record && record.rowNumber !== undefined && record.rowNumber !== null) {
    return `row:${record.rowNumber}`;
  }
  if (record && record.whatsappId) return `whatsapp:${record.whatsappId}`;
  return `event:${index}`;
}

function finalOutcomes(entry = {}) {
  const outcomes = new Map();
  const categories = [
    ['failed', entry.failed],
    ['invalid', entry.invalid],
    ['unregistered', entry.skipped],
    ['sent', entry.sent]
  ];

  for (const [outcome, records] of categories) {
    for (const [index, record] of (Array.isArray(records) ? records : []).entries()) {
      const key = eventKey(record, index);
      const current = outcomes.get(key);
      if (!current || OUTCOME_PRIORITY[outcome] > OUTCOME_PRIORITY[current.outcome]) {
        outcomes.set(key, {
          ...record,
          outcome,
          date: dateKey(record && record.date)
        });
      }
    }
  }
  return [...outcomes.values()];
}

function activitySummary(daily, today, metric) {
  const activeDates = new Set(daily.filter(item => Number(item[metric] || 0) > 0).map(item => item.date));
  let longestStreak = 0;
  let running = 0;
  for (const item of daily) {
    running = Number(item[metric] || 0) > 0 ? running + 1 : 0;
    longestStreak = Math.max(longestStreak, running);
  }

  const yesterday = addUtcDays(today, -1);
  let cursor = activeDates.has(today) ? today : (activeDates.has(yesterday) ? yesterday : null);
  let currentStreak = 0;
  while (cursor && activeDates.has(cursor)) {
    currentStreak += 1;
    cursor = addUtcDays(cursor, -1);
  }
  return {
    peak: daily.reduce((peak, item) => Math.max(peak, Number(item[metric] || 0)), 0),
    activeDays: activeDates.size,
    currentStreak,
    longestStreak
  };
}

function buildAnalytics({
  progressEntries = [],
  history = [],
  days = 365,
  now = new Date().toISOString()
} = {}) {
  const today = dateKey(now) || new Date().toISOString().slice(0, 10);
  const dates = buildDateRange(today, days);
  const startDate = dates[0];
  const dailyMap = new Map(dates.map(date => [date, {
    date,
    sent: 0,
    processed: 0,
    failed: 0,
    unregistered: 0,
    invalid: 0
  }]));
  const languageCounts = new Map();
  const sourceMap = new Map();

  for (const entry of progressEntries) {
    const sourceKey = String(entry.sourceFile || entry.progressPath || 'unknown');
    const source = sourceMap.get(sourceKey) || {
      sourceFile: entry.sourceFile ? path.basename(entry.sourceFile) : '未知来源',
      sent: 0,
      processed: 0,
      failed: 0,
      unregistered: 0,
      invalid: 0,
      anomalies: 0,
      successRate: 0
    };

    for (const record of finalOutcomes(entry)) {
      if (!record.date || record.date < startDate || record.date > today) continue;
      const day = dailyMap.get(record.date);
      if (!day) continue;
      day.processed += 1;
      day[record.outcome] += 1;
      source.processed += 1;
      source[record.outcome] += 1;
      if (record.outcome === 'sent') {
        const language = String(record.language || 'unknown').toLowerCase();
        languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
      }
    }

    source.anomalies = source.failed + source.unregistered + source.invalid;
    const sendable = source.sent + source.failed;
    source.successRate = sendable ? roundPercent((source.sent / sendable) * 100) : 0;
    if (source.processed > 0) sourceMap.set(sourceKey, source);
  }

  const daily = [...dailyMap.values()];
  const totals = daily.reduce((result, item) => {
    result.sent += item.sent;
    result.processed += item.processed;
    result.failed += item.failed;
    result.unregistered += item.unregistered;
    result.invalid += item.invalid;
    return result;
  }, { sent: 0, processed: 0, failed: 0, unregistered: 0, invalid: 0 });
  const sendable = totals.sent + totals.failed;
  const completedTasks = history.filter(item => {
    const startedDate = dateKey(item && item.startedAt);
    return startedDate
      && startedDate >= startDate
      && startedDate <= today
      && item.finishedAt
      && item.reason !== 'running';
  }).length;
  const sentActivity = activitySummary(daily, today, 'sent');
  const processedActivity = activitySummary(daily, today, 'processed');

  return {
    range: { days: dates.length, startDate, endDate: today },
    summary: {
      ...totals,
      successRate: sendable ? roundPercent((totals.sent / sendable) * 100) : 0,
      completedTasks,
      activeDays: sentActivity.activeDays,
      currentStreak: sentActivity.currentStreak,
      longestStreak: sentActivity.longestStreak,
      peakSent: sentActivity.peak
    },
    activity: {
      sent: sentActivity,
      processed: processedActivity
    },
    daily,
    languages: [...languageCounts.entries()]
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language)),
    sources: [...sourceMap.values()]
      .sort((a, b) => b.sent - a.sent || b.processed - a.processed || a.sourceFile.localeCompare(b.sourceFile))
      .slice(0, 8)
  };
}

module.exports = {
  buildAnalytics,
  finalOutcomes
};
