const { countSentToday } = require('./progressStore');
const { DEFAULT_TEMPLATES } = require('./templateStore');

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nextDelayMs(config = {}) {
  const fixed = Number(config.delayMs || 0);
  if (fixed > 0) return fixed;

  const min = Number(config.delayMinMs || 0);
  const max = Number(config.delayMaxMs || min);
  if (min <= 0 && max <= 0) return 0;
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseTemplate(language, templates = DEFAULT_TEMPLATES, random = Math.random) {
  const pool = templates[language] && templates[language].length ? templates[language] : templates.en;
  return pool[Math.floor(random() * pool.length)];
}

function createEmptyStats() {
  return {
    sent: 0,
    failed: 0,
    unregistered: 0,
    invalid: 0,
    processed: 0
  };
}

async function runSendTask({
  rows,
  client,
  progressStore,
  config = {},
  templates = DEFAULT_TEMPLATES,
  shouldStop = () => false,
  onEvent = () => {}
}) {
  const today = config.today || new Date().toISOString().slice(0, 10);
  const maxPerDay = Number(config.maxPerDay || 80);
  const progress = progressStore.load();
  const stats = createEmptyStats();
  let sentToday = countSentToday(progress, today);

  for (let index = (progress.lastIndex ?? -1) + 1; index < rows.length; index += 1) {
    if (shouldStop()) {
      return { reason: 'stopped', stats, progress };
    }

    if (sentToday >= maxPerDay) {
      return { reason: 'daily-limit', stats, progress };
    }

    const row = rows[index];
    onEvent({ type: 'row:start', index, row });

    if (row.status !== 'valid') {
      progress.invalid.push({
        rowNumber: row.rowNumber,
        rawPhone: row.rawPhone,
        status: row.status,
        error: row.error,
        date: today
      });
      progress.lastIndex = index;
      stats.invalid += 1;
      stats.processed += 1;
      progressStore.save(progress);
      onEvent({ type: 'row:invalid', index, row });
      continue;
    }

    try {
      const isRegistered = await client.isRegisteredUser(row.whatsappId);
      if (!isRegistered) {
        progress.skipped.push({
          rowNumber: row.rowNumber,
          whatsappId: row.whatsappId,
          reason: 'unregistered',
          date: today
        });
        progress.lastIndex = index;
        stats.unregistered += 1;
        stats.processed += 1;
        progressStore.save(progress);
        onEvent({ type: 'row:unregistered', index, row });
        await sleep(nextDelayMs(config));
        continue;
      }

      const message = chooseTemplate(row.language, templates);
      await client.sendMessage(row.whatsappId, message);
      progress.sent.push({
        rowNumber: row.rowNumber,
        whatsappId: row.whatsappId,
        language: row.language,
        message,
        date: today
      });
      progress.lastIndex = index;
      stats.sent += 1;
      stats.processed += 1;
      sentToday += 1;
      progressStore.save(progress);
      onEvent({ type: 'row:sent', index, row, message });
      await sleep(nextDelayMs(config));
    } catch (error) {
      progress.failed.push({
        rowNumber: row.rowNumber,
        whatsappId: row.whatsappId,
        error: error.message,
        date: today
      });
      progress.lastIndex = index;
      stats.failed += 1;
      stats.processed += 1;
      progressStore.save(progress);
      onEvent({ type: 'row:failed', index, row, error: error.message });
      await sleep(nextDelayMs(config));
    }
  }

  return { reason: 'complete', stats, progress };
}

module.exports = {
  DEFAULT_TEMPLATES,
  chooseTemplate,
  nextDelayMs,
  runSendTask
};
