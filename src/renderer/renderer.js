const state = {
  imported: null
};

const elements = {
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
  tableState: document.getElementById('tableState')
  ,
  runButton: document.getElementById('runButton'),
  stopButton: document.getElementById('stopButton'),
  dailyLimitInput: document.getElementById('dailyLimitInput'),
  delayMinInput: document.getElementById('delayMinInput'),
  delayMaxInput: document.getElementById('delayMaxInput'),
  taskState: document.getElementById('taskState'),
  logList: document.getElementById('logList')
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

function setText(key, value) {
  elements[key].textContent = String(value);
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

  state.imported = response.data;
  renderStats(response.data.stats);
  renderRows(response.data.rows);
  elements.exportButton.disabled = false;
  elements.runButton.disabled = (response.data.stats.valid || 0) === 0;
  elements.fileMeta.textContent = `当前文件：${response.data.fileName}；电话列：${response.data.columns.phoneColumn || '未识别'}；国家列：${response.data.columns.countryColumn || '未识别'}`;
  elements.tableState.textContent = `已解析 ${response.data.rows.length} 行`;
  addLog(`已导入 ${response.data.fileName}，有效号码 ${response.data.stats.valid || 0} 个。`, 'strong');
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
    elements.taskState.textContent = '连接中';
    elements.runButton.disabled = true;
    elements.stopButton.disabled = false;
  }
  if (event.type === 'auth:ready') elements.taskState.textContent = '运行中';
  if (event.type === 'task:finished' || event.type === 'task:error') {
    elements.taskState.textContent = event.type === 'task:error' ? '出错' : '已结束';
    elements.runButton.disabled = !state.imported;
    elements.stopButton.disabled = true;
  }
}

async function startTask() {
  if (!state.imported) return;
  const minDelay = Number(elements.delayMinInput.value || 22);
  const maxDelay = Number(elements.delayMaxInput.value || 26);
  elements.taskState.textContent = '准备中';
  addLog('准备连接 WhatsApp。如果是第一次使用，请在弹出的浏览器里扫码。', 'strong');

  const response = await window.addWhatsapp.startTask({
    maxPerDay: Number(elements.dailyLimitInput.value || 80),
    delayMinSeconds: Math.max(5, minDelay),
    delayMaxSeconds: Math.max(5, maxDelay)
  });

  if (!response.started) {
    elements.taskState.textContent = '未开始';
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

elements.importButton.addEventListener('click', importContacts);
elements.dropImportButton.addEventListener('click', importContacts);
elements.exportButton.addEventListener('click', exportReport);
elements.runButton.addEventListener('click', startTask);
elements.stopButton.addEventListener('click', stopTask);
window.addWhatsapp.onTaskEvent(handleTaskEvent);
