const state = {
  imported: null,
  templates: { en: [], es: [], fr: [] },
  taskStats: { sent: 0, failed: 0, unregistered: 0, invalid: 0 },
  activeTemplateLanguage: 'en'
};

const elements = {
  pageEyebrow: document.getElementById('pageEyebrow'),
  pageTitle: document.getElementById('pageTitle'),
  topbarActions: document.querySelector('.topbar-actions'),
  navItems: [...document.querySelectorAll('.nav-item')],
  pages: [...document.querySelectorAll('.page')],
  importButton: document.getElementById('importButton'),
  dropImportButton: document.getElementById('dropImportButton'),
  exportButton: document.getElementById('exportButton'),
  fileMeta: document.getElementById('fileMeta'),
  totalCount: document.getElementById('totalCount'),
  validCount: document.getElementById('validCount'),
  pendingCount: document.getElementById('pendingCount'),
  blockedCount: document.getElementById('blockedCount'),
  enCount: document.getElementById('enCount'),
  esCount: document.getElementById('esCount'),
  frCount: document.getElementById('frCount'),
  previewBody: document.getElementById('previewBody'),
  tableState: document.getElementById('tableState'),
  sentMetric: document.getElementById('sentMetric'),
  unregisteredMetric: document.getElementById('unregisteredMetric'),
  failedMetric: document.getElementById('failedMetric'),
  taskStateMetric: document.getElementById('taskStateMetric'),
  runButton: document.getElementById('runButton'),
  stopButton: document.getElementById('stopButton'),
  dailyLimitInput: document.getElementById('dailyLimitInput'),
  delayMinInput: document.getElementById('delayMinInput'),
  delayMaxInput: document.getElementById('delayMaxInput'),
  taskState: document.getElementById('taskState'),
  logList: document.getElementById('logList'),
  templatePoolSummary: document.getElementById('templatePoolSummary'),
  resumeSummary: document.getElementById('resumeSummary'),
  resumeDetail: document.getElementById('resumeDetail'),
  templateEnList: document.getElementById('templateEnList'),
  templateEsList: document.getElementById('templateEsList'),
  templateFrList: document.getElementById('templateFrList'),
  templateTabs: [...document.querySelectorAll('[data-template-tab]')],
  templatePanes: [...document.querySelectorAll('[data-language]')],
  templateAddButtons: [...document.querySelectorAll('[data-template-add]')],
  templateActiveTitle: document.getElementById('templateActiveTitle'),
  templateActiveDescription: document.getElementById('templateActiveDescription'),
  templateActiveBadge: document.getElementById('templateActiveBadge'),
  templateEnCount: document.getElementById('templateEnCount'),
  templateEsCount: document.getElementById('templateEsCount'),
  templateFrCount: document.getElementById('templateFrCount'),
  saveTemplatesButton: document.getElementById('saveTemplatesButton'),
  templateSaveState: document.getElementById('templateSaveState'),
  refreshHistoryButton: document.getElementById('refreshHistoryButton'),
  historyBody: document.getElementById('historyBody'),
  closeModal: document.getElementById('closeModal'),
  closeModalDetail: document.getElementById('closeModalDetail'),
  closeMinimizeButton: document.getElementById('closeMinimizeButton'),
  closeQuitButton: document.getElementById('closeQuitButton'),
  closeCancelButton: document.getElementById('closeCancelButton')
};

const PAGE_ACTIONS = new Set(['importPage']);
const TEMPLATE_META = {
  en: { title: '英语模板', description: '英语区号码随机选择这些文案。', badge: 'EN' },
  es: { title: '西班牙语模板', description: '西班牙、墨西哥和拉美号码随机选择这些文案。', badge: 'ES' },
  fr: { title: '法语模板', description: '法国和法语区号码随机选择这些文案。', badge: 'FR' }
};

function statusLabel(status) {
  const labels = {
    valid: '有效',
    pending: '待确认',
    invalid: '无效',
    duplicate: '重复'
  };
  return labels[status] || status;
}

function languageLabel(language) {
  const labels = {
    en: '英语',
    es: '西语',
    fr: '法语'
  };
  return labels[language] || language || '-';
}

function reasonLabel(reason) {
  const labels = {
    complete: '完成',
    stopped: '已暂停',
    'daily-limit': '达到限额',
    'automation-lost': '浏览器中断',
    interrupted: '异常中断',
    closed: '用户关闭',
    error: '出错',
    running: '运行中'
  };
  return labels[reason] || reason || '-';
}

function setText(key, value) {
  elements[key].textContent = String(value);
}

function switchPage(pageId) {
  for (const page of elements.pages) {
    page.classList.toggle('active-page', page.id === pageId);
  }
  for (const item of elements.navItems) {
    item.classList.toggle('active', item.dataset.pageTarget === pageId);
  }
  const active = document.getElementById(pageId);
  elements.pageTitle.textContent = active.dataset.title;
  elements.pageEyebrow.textContent = active.dataset.eyebrow;
  elements.topbarActions.hidden = !PAGE_ACTIONS.has(pageId);
  if (pageId === 'historyPage') loadHistory();
}

function renderStats(stats) {
  const blocked = (stats.invalid || 0) + (stats.duplicate || 0);
  setText('totalCount', stats.total || 0);
  setText('validCount', stats.valid || 0);
  setText('pendingCount', stats.pending || 0);
  setText('blockedCount', blocked);
  setText('enCount', stats.languages.en || 0);
  setText('esCount', stats.languages.es || 0);
  setText('frCount', stats.languages.fr || 0);
}

function renderTaskStats() {
  setText('sentMetric', state.taskStats.sent || 0);
  setText('unregisteredMetric', state.taskStats.unregistered || 0);
  setText('failedMetric', state.taskStats.failed || 0);
}

function renderProgressSummary(progress) {
  if (!progress || !progress.available) {
    elements.resumeSummary.textContent = '等待导入';
    elements.resumeDetail.textContent = '导入表格后显示下一次开始处理的行号。';
    return;
  }

  if (progress.nextRowNumber) {
    elements.resumeSummary.textContent = `已处理 ${progress.processed} / ${progress.total}`;
    elements.resumeDetail.textContent = `下次开始会从表格第 ${progress.nextRowNumber} 行继续。成功 ${progress.sent || 0}，跳过 ${progress.skipped || 0}，失败 ${progress.failed || 0}。`;
    return;
  }

  elements.resumeSummary.textContent = `已处理 ${progress.processed} / ${progress.total}`;
  elements.resumeDetail.textContent = '这个表格已经处理到最后一行。';
}

function renderRows(rows) {
  const visibleRows = rows.slice(0, 80);
  elements.previewBody.innerHTML = '';

  if (!visibleRows.length) {
    elements.previewBody.innerHTML = '<tr class="empty-row"><td colspan="7">没有可展示的行。</td></tr>';
    return;
  }

  for (const row of visibleRows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.rowNumber}</td>
      <td>${escapeHtml(row.rawPhone || '')}</td>
      <td>${escapeHtml(row.e164 || '-')}</td>
      <td>${escapeHtml(row.countryIso || '-')}</td>
      <td>${languageLabel(row.language)}</td>
      <td><span class="status-tag status-${row.status}">${statusLabel(row.status)}</span></td>
      <td>${escapeHtml(row.error || '-')}</td>
    `;
    elements.previewBody.appendChild(tr);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function importContacts() {
  elements.importButton.disabled = true;
  elements.dropImportButton.disabled = true;
  elements.fileMeta.textContent = '正在读取表格并解析号码...';

  const response = await window.addWhatsapp.importContacts();

  elements.importButton.disabled = false;
  elements.dropImportButton.disabled = false;

  if (response.canceled) {
    elements.fileMeta.textContent = state.imported
      ? `当前文件：${state.imported.fileName}`
      : '还没有选择表格。支持电话列、国家列和语言列自动识别。';
    return;
  }

  if (response.error) {
    elements.fileMeta.textContent = `导入失败：${response.error}`;
    return;
  }

  applyImportedData(response.data);
  addLog(`已导入 ${response.data.fileName}，有效号码 ${response.data.stats.valid || 0} 个。`, 'strong');
}

function applyImportedData(data) {
  state.imported = data;
  renderStats(data.stats);
  renderRows(data.rows);
  renderProgressSummary(data.progress);
  elements.exportButton.disabled = false;
  elements.runButton.disabled = (data.stats.valid || 0) === 0;
  elements.fileMeta.textContent = `当前文件：${data.fileName}；电话列：${data.columns.phoneColumn || '未识别'}；国家列：${data.columns.countryColumn || '未识别'}`;
  elements.tableState.textContent = `已解析 ${data.rows.length} 行`;
}

async function refreshCurrentProgress() {
  if (!state.imported) return;
  const progress = await window.addWhatsapp.getCurrentProgress();
  state.imported.progress = progress;
  renderProgressSummary(progress);
}

async function exportReport() {
  if (!state.imported) return;
  elements.exportButton.disabled = true;
  const response = await window.addWhatsapp.exportReport(state.imported.rows);
  elements.exportButton.disabled = false;

  if (!response.canceled && response.filePath) {
    elements.tableState.textContent = '报表已导出';
  }
}

function addLog(message, tone = '') {
  if (elements.logList.querySelector('.muted')) {
    elements.logList.innerHTML = '';
  }
  const line = document.createElement('div');
  line.className = `log-line ${tone}`.trim();
  line.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  elements.logList.prepend(line);
}

function taskEventMessage(event) {
  const map = {
    'task:starting': event.message,
    'auth:qr': event.message,
    'auth:authenticated': event.message,
    'auth:ready': event.message,
    'auth:failure': event.message,
    'auth:disconnected': event.message,
    'task:stopping': event.message,
    'row:start': `正在处理第 ${event.row.rowNumber} 行：${event.row.e164 || event.row.rawPhone || ''}`,
    'row:invalid': `第 ${event.row.rowNumber} 行跳过：${statusLabel(event.row.status)}`,
    'row:unregistered': `第 ${event.row.rowNumber} 行未注册 WhatsApp，已跳过。`,
    'row:sent': `第 ${event.row.rowNumber} 行已发送：${languageLabel(event.row.language)}`,
    'row:failed': `第 ${event.row.rowNumber} 行发送失败：${event.error}`,
    'row:fatal': `自动化浏览器已关闭或失联，停在第 ${event.row.rowNumber} 行：${event.error}`,
    'task:finished': event.message,
    'task:error': event.message
  };
  return map[event.type] || event.message || event.type;
}

function handleTaskEvent(event) {
  const errorTone = event.type.includes('failure') || event.type.includes('error') ? 'error' : '';
  const strongTone = event.type.includes('ready') || event.type.includes('finished') ? 'strong' : '';
  addLog(taskEventMessage(event), errorTone || strongTone);

  if (event.type === 'task:starting') {
    state.taskStats = { sent: 0, failed: 0, unregistered: 0, invalid: 0 };
    renderTaskStats();
    elements.taskState.textContent = '连接中';
    elements.taskStateMetric.textContent = '连接中';
    elements.runButton.disabled = true;
    elements.stopButton.disabled = false;
  }
  if (event.type === 'auth:ready') {
    elements.taskState.textContent = '运行中';
    elements.taskStateMetric.textContent = '运行中';
  }
  if (event.type === 'row:sent') state.taskStats.sent += 1;
  if (event.type === 'row:unregistered') state.taskStats.unregistered += 1;
  if (event.type === 'row:failed' || event.type === 'row:fatal') state.taskStats.failed += 1;
  if (event.type === 'row:invalid') state.taskStats.invalid += 1;
  if (event.type === 'row:sent' || event.type === 'row:unregistered' || event.type === 'row:failed' || event.type === 'row:fatal' || event.type === 'row:invalid') {
    if (state.imported && Number.isInteger(event.index)) {
      const isFatal = event.type === 'row:fatal';
      const nextRow = state.imported.rows[isFatal ? event.index : event.index + 1];
      state.imported.progress = {
        ...(state.imported.progress || {}),
        available: true,
        total: state.imported.rows.length,
        processed: Math.min(isFatal ? event.index : event.index + 1, state.imported.rows.length),
        nextRowNumber: nextRow ? nextRow.rowNumber : null,
        sent: state.taskStats.sent,
        skipped: state.taskStats.unregistered,
        failed: state.taskStats.failed,
        invalid: state.taskStats.invalid
      };
      renderProgressSummary(state.imported.progress);
    }
    renderTaskStats();
  }
  if (event.type === 'task:finished' || event.type === 'task:error') {
    elements.taskState.textContent = event.type === 'task:error' ? '出错' : '已结束';
    elements.taskStateMetric.textContent = event.type === 'task:error' ? '出错' : '已结束';
    elements.runButton.disabled = !state.imported;
    elements.stopButton.disabled = true;
    refreshCurrentProgress();
  }
}

async function startTask() {
  if (!state.imported) {
    addLog('请先导入表格。', 'error');
    return;
  }
  const minDelay = Number(elements.delayMinInput.value || 22);
  const maxDelay = Number(elements.delayMaxInput.value || 26);
  elements.taskState.textContent = '准备中';
  elements.taskStateMetric.textContent = '准备中';
  addLog('准备连接 WhatsApp。如果是第一次使用，请在弹出的浏览器里扫码。', 'strong');

  const response = await window.addWhatsapp.startTask({
    maxPerDay: Number(elements.dailyLimitInput.value || 80),
    delayMinSeconds: Math.max(5, minDelay),
    delayMaxSeconds: Math.max(5, maxDelay)
  });

  if (!response.started) {
    elements.taskState.textContent = '未开始';
    elements.taskStateMetric.textContent = '待机';
    elements.runButton.disabled = false;
    addLog(response.error || '任务启动失败。', 'error');
  }
}

async function stopTask() {
  elements.stopButton.disabled = true;
  const response = await window.addWhatsapp.stopTask();
  if (!response.stopped) {
    addLog(response.error || '暂停失败。', 'error');
    elements.stopButton.disabled = false;
  }
}

function templateListElement(language) {
  return elements[`template${language[0].toUpperCase()}${language.slice(1)}List`];
}

function templateInputs(language) {
  return [...templateListElement(language).querySelectorAll('.template-editor')];
}

function templateLines(language) {
  return templateInputs(language).map(input => input.value.trim()).filter(Boolean);
}

function createTemplateItem(language, value = '', index = 0) {
  const item = document.createElement('div');
  item.className = 'template-item';
  item.innerHTML = `
    <div class="template-item-head">
      <span>文案 ${index + 1}</span>
      <button class="icon-button" type="button" data-template-remove="${language}" aria-label="删除文案">×</button>
    </div>
    <textarea class="template-editor" spellcheck="false"></textarea>
  `;
  const textarea = item.querySelector('textarea');
  textarea.value = value;
  textarea.addEventListener('input', markTemplatesDirty);
  item.querySelector('button').addEventListener('click', () => {
    item.remove();
    renumberTemplateItems(language);
    markTemplatesDirty();
  });
  return item;
}

function renumberTemplateItems(language) {
  templateListElement(language).querySelectorAll('.template-item-head span').forEach((label, index) => {
    label.textContent = `文案 ${index + 1}`;
  });
}

function renderTemplateList(language, lines) {
  const list = templateListElement(language);
  list.innerHTML = '';
  const values = lines.length ? lines : [''];
  values.forEach((line, index) => list.appendChild(createTemplateItem(language, line, index)));
}

function updateTemplateCounts() {
  elements.templateEnCount.textContent = templateInputs('en').length;
  elements.templateEsCount.textContent = templateInputs('es').length;
  elements.templateFrCount.textContent = templateInputs('fr').length;
}

function switchTemplateLanguage(language) {
  state.activeTemplateLanguage = language;
  const meta = TEMPLATE_META[language];
  elements.templateActiveTitle.textContent = meta.title;
  elements.templateActiveDescription.textContent = meta.description;
  elements.templateActiveBadge.textContent = meta.badge;

  for (const tab of elements.templateTabs) {
    tab.classList.toggle('active', tab.dataset.templateTab === language);
  }
  for (const pane of elements.templatePanes) {
    pane.classList.toggle('active', pane.dataset.language === language);
  }
  for (const button of elements.templateAddButtons) {
    button.hidden = button.dataset.templateAdd !== language;
  }
}

function markTemplatesDirty() {
  elements.templateSaveState.textContent = '有未保存修改';
  updateTemplateCounts();
}

function renderTemplates(templates) {
  state.templates = templates;
  renderTemplateList('en', templates.en);
  renderTemplateList('es', templates.es);
  renderTemplateList('fr', templates.fr);
  elements.templatePoolSummary.textContent = `EN ${templates.en.length} / ES ${templates.es.length} / FR ${templates.fr.length}`;
  elements.templateSaveState.textContent = '模板已加载';
  updateTemplateCounts();
  switchTemplateLanguage(state.activeTemplateLanguage);
}

async function loadTemplates() {
  renderTemplates(await window.addWhatsapp.getTemplates());
}

async function saveTemplates() {
  const saved = await window.addWhatsapp.saveTemplates({
    en: templateLines('en'),
    es: templateLines('es'),
    fr: templateLines('fr')
  });
  renderTemplates(saved);
  elements.templateSaveState.textContent = '已保存';
}

function renderHistory(items) {
  elements.historyBody.innerHTML = '';
  if (!items.length) {
    elements.historyBody.innerHTML = '<tr class="empty-row"><td colspan="8">还没有历史任务。</td></tr>';
    return;
  }

  for (const item of items) {
    const stats = item.stats || {};
    const invalid = (stats.invalid || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatTime(item.startedAt)}</td>
      <td>${formatTime(item.finishedAt)}</td>
      <td>${reasonLabel(item.reason)}</td>
      <td>${stats.sent || 0}</td>
      <td>${stats.unregistered || 0}</td>
      <td>${stats.failed || 0}</td>
      <td>${invalid}</td>
      <td>${escapeHtml(shortPath(item.sourceFile || '-'))}</td>
    `;
    elements.historyBody.appendChild(tr);
  }
}

function shortPath(value) {
  return String(value).split(/[\\/]/).pop();
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

async function loadHistory() {
  renderHistory(await window.addWhatsapp.listHistory());
}

async function bootstrapApp() {
  const bootstrap = await window.addWhatsapp.getBootstrapState();
  if (bootstrap.imported) {
    applyImportedData(bootstrap.imported);
    addLog(`已恢复上次表格 ${bootstrap.imported.fileName}，可从记录位置继续。`, 'strong');
  }
  if (bootstrap.history) renderHistory(bootstrap.history);
}

function showCloseModal(payload = {}) {
  elements.closeModal.hidden = false;
  elements.closeModalDetail.textContent = payload.hasActiveTask
    ? '当前有任务正在运行。最小化会让任务继续；完全关闭会先保存任务记录，再结束软件进程。'
    : '最小化会保留窗口状态和登录缓存；完全关闭会结束软件进程。';
  elements.closeMinimizeButton.focus();
}

async function handleCloseChoice(action) {
  elements.closeModal.hidden = true;
  await window.addWhatsapp.closeChoiceAction(action);
}

for (const item of elements.navItems) {
  item.addEventListener('click', () => switchPage(item.dataset.pageTarget));
}
elements.importButton.addEventListener('click', importContacts);
elements.dropImportButton.addEventListener('click', importContacts);
elements.exportButton.addEventListener('click', exportReport);
elements.runButton.addEventListener('click', startTask);
elements.stopButton.addEventListener('click', stopTask);
elements.saveTemplatesButton.addEventListener('click', saveTemplates);
elements.refreshHistoryButton.addEventListener('click', loadHistory);
elements.closeMinimizeButton.addEventListener('click', () => handleCloseChoice('minimize'));
elements.closeQuitButton.addEventListener('click', () => handleCloseChoice('quit'));
elements.closeCancelButton.addEventListener('click', () => handleCloseChoice('cancel'));
elements.closeModal.addEventListener('click', event => {
  if (event.target === elements.closeModal) handleCloseChoice('cancel');
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !elements.closeModal.hidden) handleCloseChoice('cancel');
});
for (const tab of elements.templateTabs) {
  tab.addEventListener('click', () => switchTemplateLanguage(tab.dataset.templateTab));
}
for (const button of elements.templateAddButtons) {
  button.addEventListener('click', () => {
    const language = button.dataset.templateAdd;
    const list = templateListElement(language);
    list.appendChild(createTemplateItem(language, '', list.children.length));
    markTemplatesDirty();
  });
}

window.addWhatsapp.onTaskEvent(handleTaskEvent);
window.addWhatsapp.onHistoryUpdated(renderHistory);
window.addWhatsapp.onShowCloseChoice(showCloseModal);
loadTemplates();
bootstrapApp();
