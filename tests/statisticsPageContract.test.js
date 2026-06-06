const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('desktop exposes a statistics page backed by the analytics IPC', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const styles = fs.readFileSync(path.join(root, 'src', 'renderer', 'styles.css'), 'utf-8');
  const preload = fs.readFileSync(path.join(root, 'src', 'main', 'preload.js'), 'utf-8');
  const main = fs.readFileSync(path.join(root, 'src', 'main', 'main.js'), 'utf-8');

  assert.match(html, /data-page-target="statisticsPage"/);
  assert.match(html, /id="statisticsPage"/);
  assert.match(html, /id="activityHeatmap"/);
  assert.match(html, /id="statisticsActivityTitle"/);
  assert.match(html, /id="statisticsActivityDescription"/);
  assert.match(html, /id="statisticsPeakLabel"/);
  assert.match(html, /id="statisticsTrend"/);
  assert.match(html, /id="statisticsSources"/);
  assert.match(renderer, /function loadStatistics\(/);
  assert.match(renderer, /window\.addWhatsapp\.getAnalytics/);
  assert.match(renderer, /function renderActivityHeatmap\(/);
  assert.match(renderer, /processed-mode/);
  assert.match(renderer, /analytics\.activity\[metric\]/);
  assert.match(styles, /\.activity-heatmap/);
  assert.match(styles, /\.processed-mode \.activity-cell\.level-4/);
  assert.match(styles, /\.statistics-kpis/);
  assert.match(preload, /getAnalytics: options => ipcRenderer\.invoke\('analytics:get', options\)/);
  assert.match(main, /ipcMain\.handle\('analytics:get'/);
  assert.match(main, /buildAnalytics/);
});

test('desktop no longer exposes the discontinued referral rewards page', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const styles = fs.readFileSync(path.join(root, 'src', 'renderer', 'styles.css'), 'utf-8');

  assert.doesNotMatch(html, /referralPage|推荐奖励|我的推荐码|推荐链接|推荐记录/);
  assert.doesNotMatch(renderer, /referralPage/);
  assert.doesNotMatch(styles, /\.referral-overview|\.referral-code-panel/);
});
