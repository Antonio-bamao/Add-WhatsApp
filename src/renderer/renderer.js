const state = {
  auth: { authenticated: false, user: null },
  subscription: null,
  pendingRecovery: null,
  imported: null,
  templates: { en: [], es: [], fr: [] },
  taskStats: { sent: 0, failed: 0, unregistered: 0, invalid: 0 },
  activeTemplateLanguage: 'en'
};

const elements = {
  authGate: document.getElementById('authGate'),
  appShell: document.getElementById('appShell'),
  authTabs: [...document.querySelectorAll('[data-auth-mode]')],
  authForms: [...document.querySelectorAll('[data-auth-form]')],
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  registerForm: document.getElementById('registerForm'),
  registerUsername: document.getElementById('registerUsername'),
  registerPassword: document.getElementById('registerPassword'),
  resetForm: document.getElementById('resetForm'),
  resetUsername: document.getElementById('resetUsername'),
  resetRecoveryCode: document.getElementById('resetRecoveryCode'),
  resetPassword: document.getElementById('resetPassword'),
  recoveryBox: document.getElementById('recoveryBox'),
  recoveryCodeText: document.getElementById('recoveryCodeText'),
  downloadRecoveryButton: document.getElementById('downloadRecoveryButton'),
  authMessage: document.getElementById('authMessage'),
  pageEyebrow: document.getElementById('pageEyebrow'),
  pageTitle: document.getElementById('pageTitle'),
  topbarActions: document.querySelector('.topbar-actions'),
  navItems: [...document.querySelectorAll('[data-page-target]')],
  plansToggle: document.getElementById('plansToggle'),
  plansSubnav: document.getElementById('plansSubnav'),
  pages: [...document.querySelectorAll('.page')],
  importButton: document.getElementById('importButton'),
  dropImportButton: document.getElementById('dropImportButton'),
  skipChinaNumbersToggle: document.getElementById('skipChinaNumbersToggle'),
  exportButton: document.getElementById('exportButton'),
  fileMeta: document.getElementById('fileMeta'),
  totalCount: document.getElementById('totalCount'),
  validCount: document.getElementById('validCount'),
  pendingCount: document.getElementById('pendingCount'),
  chinaSkippedCount: document.getElementById('chinaSkippedCount'),
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
  closeCancelButton: document.getElementById('closeCancelButton'),
  currentAccountBadge: document.getElementById('currentAccountBadge'),
  accountNameBadge: document.getElementById('accountNameBadge'),
  openWorkspaceButton: document.getElementById('openWorkspaceButton'),
  proxySettingsButton: document.getElementById('proxySettingsButton'),
  logoutButton: document.getElementById('logoutButton'),
  clearWhatsAppButton: document.getElementById('clearWhatsAppButton'),
  syncPasswordInput: document.getElementById('syncPasswordInput'),
  exportSyncButton: document.getElementById('exportSyncButton'),
  importSyncButton: document.getElementById('importSyncButton'),
  syncState: document.getElementById('syncState'),
  workspaceRiskModal: document.getElementById('workspaceRiskModal'),
  workspaceRiskConfirmButton: document.getElementById('workspaceRiskConfirmButton'),
  workspaceRiskCancelButton: document.getElementById('workspaceRiskCancelButton'),
  proxySettingsModal: document.getElementById('proxySettingsModal'),
  proxySettingsForm: document.getElementById('proxySettingsForm'),
  proxyTypeInput: document.getElementById('proxyTypeInput'),
  proxyHostInput: document.getElementById('proxyHostInput'),
  proxyPortInput: document.getElementById('proxyPortInput'),
  proxyUsernameInput: document.getElementById('proxyUsernameInput'),
  proxyPasswordInput: document.getElementById('proxyPasswordInput'),
  proxyLookupChannelInput: document.getElementById('proxyLookupChannelInput'),
  proxyChangeReminderInput: document.getElementById('proxyChangeReminderInput'),
  proxySettingsState: document.getElementById('proxySettingsState'),
  proxyCheckButton: document.getElementById('proxyCheckButton'),
  proxySaveButton: document.getElementById('proxySaveButton'),
  proxyCancelButton: document.getElementById('proxyCancelButton'),
  activePlanBadge: document.getElementById('activePlanBadge'),
  planCards: document.getElementById('planCards'),
  usageLedgerBody: document.getElementById('usageLedgerBody'),
  balanceCreditsMetric: document.getElementById('balanceCreditsMetric'),
  usedTodayMetric: document.getElementById('usedTodayMetric'),
  dailyLimitValue: document.getElementById('dailyLimitValue'),
  dailyUsageResetHint: document.getElementById('dailyUsageResetHint'),
  monthUsedMetric: document.getElementById('monthUsedMetric'),
  monthLimitMetric: document.getElementById('monthLimitMetric'),
  workspaceUsageMetric: document.getElementById('workspaceUsageMetric'),
  usagePolicyText: document.getElementById('usagePolicyText'),
  dailyUsageBar: document.getElementById('dailyUsageBar'),
  monthlyUsageBar: document.getElementById('monthlyUsageBar'),
  workspaceUsageBar: document.getElementById('workspaceUsageBar'),
  membershipCard: document.getElementById('membershipCard'),
  quotaCardPlanName: document.getElementById('quotaCardPlanName'),
  quotaCardUserName: document.getElementById('quotaCardUserName'),
  quotaCardPlanSubtitle: document.getElementById('quotaCardPlanSubtitle'),
  quotaEstimate: document.getElementById('quotaEstimate'),
  billingPlanDescription: document.getElementById('billingPlanDescription'),
  billingIncludedList: document.getElementById('billingIncludedList'),
  billingExcludedList: document.getElementById('billingExcludedList')
};

const PAGE_ACTIONS = new Set(['importPage']);
const IMPORT_OPTIONS_STORAGE_KEY = 'addWhatsapp.importOptions';
const TEMPLATE_META = {
  en: { title: '英语模板', description: '英语区号码随机选择这些文案。', badge: 'EN' },
  es: { title: '西班牙语模板', description: '西班牙、墨西哥和拉美号码随机选择这些文案。', badge: 'ES' },
  fr: { title: '法语模板', description: '法国和法语区号码随机选择这些文案。', badge: 'FR' }
};

function switchAuthMode(mode) {
  for (const tab of elements.authTabs) {
    tab.classList.toggle('active', tab.dataset.authMode === mode);
  }
  for (const form of elements.authForms) {
    form.classList.toggle('active', form.dataset.authForm === mode);
  }
  elements.authMessage.textContent = '';
}

function setAuthMessage(message, tone = '') {
  elements.authMessage.textContent = message || '';
  elements.authMessage.classList.toggle('error', tone === 'error');
  elements.authMessage.classList.toggle('strong', tone === 'strong');
}

function applyAuthState(auth) {
  state.auth = auth || { authenticated: false, user: null };
  if (state.auth.subscription) renderSubscriptionState(state.auth.subscription);
  const authenticated = Boolean(state.auth.authenticated && state.auth.user);
  elements.authGate.hidden = authenticated;
  elements.appShell.hidden = !authenticated;
  const username = authenticated ? state.auth.user.username : '未登录';
  elements.currentAccountBadge.textContent = username;
  elements.accountNameBadge.textContent = username;
  if (elements.quotaCardUserName) elements.quotaCardUserName.textContent = username;
  const isSecondaryWorkspace = Boolean(state.auth.workspace && state.auth.workspace.isSecondary);
  elements.openWorkspaceButton.hidden = isSecondaryWorkspace;
  elements.proxySettingsButton.hidden = !isSecondaryWorkspace;
  updateWorkspaceButtonState();
  if (isSecondaryWorkspace) {
    const proxy = state.auth.workspace.proxy;
    elements.syncState.textContent = proxy ? proxyStatusText(proxy) : '当前是独立工作台。请先通过 IP 设置保存可用 SOCKS5 代理，再开始任务。';
  }
  if (!authenticated) {
    state.imported = null;
    elements.recoveryBox.hidden = !state.pendingRecovery;
  }
}

function formatCredits(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatPlanPrice(plan) {
  if (!plan.unitPriceCents) return '¥0';
  return `¥${(plan.unitPriceCents / 100).toFixed(plan.unitPriceCents % 100 === 0 ? 0 : 2)}`;
}

function renderPlanCards(subscription) {
  if (!elements.planCards) return;
  const activePlanId = subscription.plan && subscription.plan.id;
  elements.planCards.innerHTML = '';
  for (const plan of subscription.catalog || []) {
    const isActive = plan.id === activePlanId;
    const card = document.createElement('article');
    card.className = `plan-card ${isActive ? 'active' : ''} ${plan.recommended ? 'recommended' : ''}`.trim();
    const topUp = plan.minimumTopUpCredits
      ? `${formatCredits(plan.minimumTopUpCredits)} 额度起充`
      : '无需充值';
    const templateLimit = plan.templateLimit ? `自定义文案模板 X${plan.templateLimit}` : '自定义文案模板不限';
    card.innerHTML = `
      <div class="plan-card-head">
        <div>
          <h3>${escapeHtml(plan.name)}</h3>
          <p>${escapeHtml(plan.audience)}</p>
        </div>
        ${plan.recommended ? '<span class="table-state">推荐</span>' : ''}
      </div>
      <div class="plan-price">
        <strong>${formatPlanPrice(plan)}</strong>
        <span>/ 成功添加</span>
      </div>
      <ul class="plan-facts">
        <li>${topUp}</li>
        <li>每日可用上限：${formatCredits(plan.dailyLimit)}</li>
        <li>工作台：${formatCredits(plan.workspaceLimit)} 个</li>
        <li>${templateLimit}</li>
        <li>未使用额度长期保留</li>
      </ul>
      <div class="plan-feature-list">
        ${(plan.features || []).map(feature => `<span>${escapeHtml(feature)}</span>`).join('')}
      </div>
      <button class="button ${isActive ? 'secondary' : 'ghost'}" type="button" disabled>${isActive ? '当前套餐' : '联系开通'}</button>
    `;
    elements.planCards.appendChild(card);
  }
}

function renderSubscriptionState(subscription) {
  state.subscription = subscription;
  const plan = subscription.plan || {};
  const usage = subscription.usage || {};
  const today = usage.today || { used: subscription.usedToday || 0, limit: plan.dailyLimit || 0, percent: 0 };
  const month = usage.month || { used: subscription.usedThisMonth || 0, limit: subscription.monthlyLimit || 0, percent: 0 };
  renderPlanCards(subscription);
  elements.activePlanBadge.textContent = `当前：${plan.name || '-'}`;
  elements.balanceCreditsMetric.textContent = formatCredits(subscription.balanceCredits);
  elements.usedTodayMetric.textContent = formatCredits(today.used);
  elements.dailyLimitValue.textContent = formatCredits(today.limit);
  elements.monthUsedMetric.textContent = formatCredits(month.used);
  elements.monthLimitMetric.textContent = formatCredits(month.limit);
  elements.dailyUsageResetHint.textContent = subscription.nextResetAt ? `${formatTime(subscription.nextResetAt)} 重置` : '每日 00:00 重置';
  elements.workspaceUsageMetric.textContent = `${1 + (subscription.openSecondaryCount || 0)}/${plan.workspaceLimit || '-'}`;
  elements.usagePolicyText.textContent = subscription.resetPolicy || '每日上限和账户余额分开计算。';
  const workspacePercent = plan.workspaceLimit ? Math.min(100, ((1 + Number(subscription.openSecondaryCount || 0)) / plan.workspaceLimit) * 100) : 0;
  elements.dailyUsageBar.style.width = `${today.percent || 0}%`;
  elements.monthlyUsageBar.style.width = `${month.percent || 0}%`;
  elements.workspaceUsageBar.style.width = `${workspacePercent}%`;
  renderMembershipCard(plan);
  elements.quotaEstimate.textContent = plan.unitPriceCents ? `¥${((plan.minimumTopUpCredits || 0) * plan.unitPriceCents / 100).toFixed(2)}` : '¥0.00';
  elements.billingPlanDescription.textContent = `${plan.name || '-'}：每日可用上限 ${formatCredits(plan.dailyLimit)}，工作台 ${formatCredits(plan.workspaceLimit)} 个。`;
  renderUsageLedger(subscription);
  renderBillingFeatureLists(plan);
  if (elements.dailyLimitInput && plan.dailyLimit) {
    elements.dailyLimitInput.max = String(plan.dailyLimit);
    if (Number(elements.dailyLimitInput.value || 0) > plan.dailyLimit) {
      elements.dailyLimitInput.value = String(plan.dailyLimit);
    }
  }
  updateWorkspaceButtonState();
}

function renderMembershipCard(plan) {
  if (!elements.membershipCard) return;
  const tier = plan.cardTier || 'FREE';
  const tone = plan.cardTone === 'silver' ? 'silver' : 'gold';
  elements.membershipCard.classList.toggle('silver-card', tone === 'silver');
  elements.membershipCard.classList.toggle('gold-card', tone === 'gold');
  elements.quotaCardPlanName.textContent = tier;
  elements.quotaCardPlanSubtitle.textContent = plan.name || '当前套餐';
}

function updateMembershipCardLight(event) {
  const card = elements.membershipCard;
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  card.style.setProperty('--card-x', `${(x * 100).toFixed(2)}%`);
  card.style.setProperty('--card-y', `${(y * 100).toFixed(2)}%`);
  card.style.setProperty('--card-rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
  card.style.setProperty('--card-ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
  const side = (x - 0.5) * 12;
  card.style.setProperty('--card-light-side', `${(-side).toFixed(2)}px`);
  card.style.setProperty('--card-shadow-side', `${side.toFixed(2)}px`);
}

function resetMembershipCardLight() {
  const card = elements.membershipCard;
  if (!card) return;
  card.style.setProperty('--card-x', '50%');
  card.style.setProperty('--card-y', '50%');
  card.style.setProperty('--card-rx', '0deg');
  card.style.setProperty('--card-ry', '0deg');
  card.style.setProperty('--card-light-side', '-12px');
  card.style.setProperty('--card-shadow-side', '12px');
}

function renderUsageLedger(subscription) {
  if (!elements.usageLedgerBody) return;
  const rows = [
    { at: new Date().toISOString(), type: '成功添加', source: '发送任务', result: '本地预览', credits: subscription.usedToday || 0, duration: '-' },
    { at: subscription.nextResetAt, type: '额度恢复', source: '每日上限', result: '等待重置', credits: 0, duration: '-' }
  ];
  elements.usageLedgerBody.innerHTML = rows.map(row => `
    <tr>
      <td>${formatTime(row.at)}</td>
      <td><span class="status-tag status-valid">${row.type}</span></td>
      <td>${row.source}</td>
      <td>${row.result}</td>
      <td>${formatCredits(row.credits)}</td>
      <td>${row.duration}</td>
    </tr>
  `).join('');
}

function renderBillingFeatureLists(plan) {
  if (!elements.billingIncludedList || !elements.billingExcludedList) return;
  const included = [
    `${formatCredits(plan.dailyLimit)} 每日可用额度`,
    `${formatCredits(plan.workspaceLimit)} 个工作台`,
    plan.templateLimit ? `自定义文案模板 X${plan.templateLimit}` : '自定义文案模板不限',
    '导入预检和历史报表'
  ];
  const excluded = [
    '线上自动支付',
    '自动发票',
    '云端同步账号',
    '企业人工扩容'
  ];
  elements.billingIncludedList.innerHTML = included.map(item => `<span class="feature-ok">${escapeHtml(item)}</span>`).join('');
  elements.billingExcludedList.innerHTML = excluded.map(item => `<span class="feature-no">${escapeHtml(item)}</span>`).join('');
}

function updateWorkspaceButtonState() {
  if (!elements.openWorkspaceButton || !state.subscription) return;
  const plan = state.subscription.plan || {};
  const isSecondaryWorkspace = Boolean(state.auth.workspace && state.auth.workspace.isSecondary);
  const totalOpen = 1 + Number(state.subscription.openSecondaryCount || 0);
  const blocked = !isSecondaryWorkspace && plan.workspaceLimit && totalOpen >= plan.workspaceLimit;
  elements.openWorkspaceButton.disabled = Boolean(blocked);
  if (blocked) {
    elements.openWorkspaceButton.textContent = `已达到${plan.name}工作台上限`;
  } else {
    elements.openWorkspaceButton.textContent = '新建工作台 / 打开另一个账号';
  }
}

function proxyStatusText(proxy) {
  const exitIp = proxy.lastExitIp || proxy.baselineIp;
  const checkedAt = proxy.lastCheckedAt ? formatTime(proxy.lastCheckedAt) : '尚未复查';
  const error = proxy.lastProxyError ? `，上次异常：${proxy.lastProxyError}` : '';
  return `当前是独立工作台，代理：${proxy.proxyServer}${exitIp ? `，出口 IP：${exitIp}` : ''}，检测：${checkedAt}${error}`;
}

async function handleLogin(event) {
  event.preventDefault();
  const response = await window.addWhatsapp.loginAccount({
    username: elements.loginUsername.value,
    password: elements.loginPassword.value
  });
  if (!response.ok) {
    setAuthMessage(response.error || '登录失败。', 'error');
    return;
  }
  applyAuthState({ authenticated: true, user: response.user });
  await loadAuthenticatedWorkspace();
}

async function handleRegister(event) {
  event.preventDefault();
  const response = await window.addWhatsapp.registerAccount({
    username: elements.registerUsername.value,
    password: elements.registerPassword.value
  });
  if (!response.ok) {
    setAuthMessage(response.error || '注册失败。', 'error');
    return;
  }
  state.pendingRecovery = {
    username: response.user.username,
    accountId: response.user.accountId,
    recoveryCode: response.recoveryCode
  };
  elements.recoveryCodeText.textContent = response.recoveryCode;
  elements.recoveryBox.hidden = false;
  setAuthMessage('账号已注册。请先下载恢复信息，再继续使用。', 'strong');
  applyAuthState({ authenticated: true, user: response.user });
  await loadAuthenticatedWorkspace();
}

async function handleResetPassword(event) {
  event.preventDefault();
  const response = await window.addWhatsapp.resetPassword({
    username: elements.resetUsername.value,
    recoveryCode: elements.resetRecoveryCode.value,
    newPassword: elements.resetPassword.value
  });
  if (!response.ok) {
    setAuthMessage(response.error || '重置失败。', 'error');
    return;
  }
  state.pendingRecovery = {
    username: response.user.username,
    accountId: response.user.accountId,
    recoveryCode: response.recoveryCode
  };
  elements.recoveryCodeText.textContent = response.recoveryCode;
  elements.recoveryBox.hidden = false;
  switchAuthMode('login');
  setAuthMessage('密码已重置。新的恢复码已生成，请下载保存。', 'strong');
}

async function downloadRecovery() {
  if (!state.pendingRecovery) return;
  const response = await window.addWhatsapp.downloadRecovery(state.pendingRecovery);
  if (!response.ok) {
    setAuthMessage(response.error || '下载失败。', 'error');
    return;
  }
  setAuthMessage(`恢复信息已保存到桌面：${shortPath(response.filePath)}`, 'strong');
  elements.recoveryBox.hidden = true;
}

async function logoutAccount() {
  const response = await window.addWhatsapp.logoutAccount();
  if (!response.ok) {
    elements.syncState.textContent = response.error || '退出失败。';
    return;
  }
  applyAuthState({ authenticated: false, user: null });
  switchAuthMode('login');
}

function showWorkspaceRiskModal() {
  elements.workspaceRiskModal.hidden = false;
  elements.workspaceRiskConfirmButton.focus();
}

function hideWorkspaceRiskModal() {
  elements.workspaceRiskModal.hidden = true;
}

async function openAnotherWorkspace() {
  elements.workspaceRiskConfirmButton.disabled = true;
  const response = await window.addWhatsapp.openAnotherWorkspace({});
  elements.workspaceRiskConfirmButton.disabled = false;
  if (!response.ok) {
    elements.syncState.textContent = response.error || '打开新工作台失败。';
    return;
  }
  hideWorkspaceRiskModal();
  elements.syncState.textContent = response.ok
    ? '已打开独立工作台。请在新窗口登录另一个本地账号，任务不会自动开始。'
    : (response.error || '打开新工作台失败。');
  const subscription = await window.addWhatsapp.getSubscriptionState();
  renderSubscriptionState(subscription);
}

function proxyFormPayload() {
  const mode = [...document.querySelectorAll('[name="proxyIpMode"]')].find(item => item.checked);
  return {
    type: elements.proxyTypeInput.value,
    host: elements.proxyHostInput.value,
    port: elements.proxyPortInput.value,
    username: elements.proxyUsernameInput.value,
    password: elements.proxyPasswordInput.value,
    ipMode: mode ? mode.value : 'ipv4',
    lookupChannel: elements.proxyLookupChannelInput.value,
    changeReminder: elements.proxyChangeReminderInput.checked
  };
}

function setProxyLookupChannel(value) {
  const channel = value || 'IP2Location';
  elements.proxyLookupChannelInput.value = channel;
  for (const button of document.querySelectorAll('[data-proxy-lookup]')) {
    button.classList.toggle('active', button.dataset.proxyLookup === channel);
  }
}

function fillProxyForm(proxy) {
  elements.proxyTypeInput.value = 'socks5';
  elements.proxyHostInput.value = proxy ? proxy.host : '';
  elements.proxyPortInput.value = proxy ? proxy.port : '';
  elements.proxyUsernameInput.value = proxy ? proxy.username || '' : '';
  elements.proxyPasswordInput.value = '';
  setProxyLookupChannel(proxy ? proxy.lookupChannel || 'IP2Location' : 'IP2Location');
  elements.proxyChangeReminderInput.checked = proxy ? proxy.changeReminder !== false : true;
  for (const item of document.querySelectorAll('[name="proxyIpMode"]')) {
    item.checked = item.value === (proxy ? proxy.ipMode || 'ipv4' : 'ipv4');
  }
  if (!proxy) {
    elements.proxySettingsState.textContent = '请输入代理信息后点击检查或保存。';
  } else if (proxy.hasPassword) {
    elements.proxySettingsState.textContent = `已加载已保存代理。密码已保存但不回显，出口 IP：${proxy.lastExitIp || proxy.baselineIp || '未记录'}。`;
  } else {
    elements.proxySettingsState.textContent = `已加载已保存代理，出口 IP：${proxy.lastExitIp || proxy.baselineIp || '未记录'}。`;
  }
}

async function showProxySettings() {
  const response = await window.addWhatsapp.getProxySettings();
  if (response.ok) {
    fillProxyForm(response.proxy);
    elements.proxySettingsModal.hidden = false;
    elements.proxyHostInput.focus();
  } else {
    elements.syncState.textContent = response.error || '主工作台不提供 IP 设置。';
  }
}

function hideProxySettings() {
  elements.proxySettingsModal.hidden = true;
}

async function testProxySettings() {
  elements.proxyCheckButton.disabled = true;
  elements.proxySettingsState.textContent = '正在检测 SOCKS5 代理和出口 IP...';
  const response = await window.addWhatsapp.testProxySettings(proxyFormPayload());
  elements.proxyCheckButton.disabled = false;
  elements.proxySettingsState.textContent = response.ok
    ? `检测通过：${response.result.proxyServer}，出口 IP：${response.result.exitIp || '未返回'}`
    : (response.error || '代理检测失败。');
  return response;
}

async function saveProxySettings() {
  elements.proxySaveButton.disabled = true;
  elements.proxySettingsState.textContent = '正在检测出口 IP 并保存代理...';
  const response = await window.addWhatsapp.saveProxySettings(proxyFormPayload());
  elements.proxySaveButton.disabled = false;
  if (!response.ok) {
    elements.proxySettingsState.textContent = response.error || '代理保存失败。';
    return;
  }
  state.auth.workspace.proxy = response.proxy;
  elements.syncState.textContent = `代理已保存并检测通过：${response.proxy.proxyServer}，出口 IP 基线：${response.proxy.baselineIp || response.result.exitIp || '未记录'}`;
  hideProxySettings();
}

async function clearWhatsAppSession() {
  const response = await window.addWhatsapp.clearWhatsAppSession();
  elements.syncState.textContent = response.ok
    ? '当前账号的 WhatsApp 缓存已清除，下次任务会重新扫码。'
    : (response.error || '清除失败。');
}

async function exportSyncPackage() {
  const password = elements.syncPasswordInput.value;
  const response = await window.addWhatsapp.exportSyncPackage(password);
  if (response.canceled) return;
  elements.syncState.textContent = response.ok
    ? `同步包已导出：${shortPath(response.filePath)}`
    : (response.error || '导出失败。');
}

async function importSyncPackage() {
  const password = elements.syncPasswordInput.value;
  const response = await window.addWhatsapp.importSyncPackage(password);
  if (response.canceled) return;
  elements.syncState.textContent = response.ok
    ? `同步包已导入：历史 ${response.historyImported || 0} 条，进度 ${response.progressImported || 0} 份。`
    : (response.error || '导入失败。');
  if (response.ok) {
    await loadHistory();
    await refreshCurrentProgress();
  }
}

function statusLabel(status) {
  const labels = {
    valid: '有效',
    pending: '待确认',
    invalid: '无效',
    duplicate: '重复',
    'china-skipped': '中国号码'
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

function rowErrorLabel(error) {
  const labels = {
    'china-number-skipped': '中国号码已排除',
    'missing-phone': '缺少电话',
    'country-required': '需要国家确认',
    'ambiguous-or-invalid-for-country': '号码与国家不匹配',
    'unparseable-phone': '无法解析'
  };
  return labels[error] || error || '-';
}

function setText(key, value) {
  elements[key].textContent = String(value);
}

function getImportOptions() {
  return {
    skipChinaNumbers: elements.skipChinaNumbersToggle.checked
  };
}

function saveImportOptions() {
  localStorage.setItem(IMPORT_OPTIONS_STORAGE_KEY, JSON.stringify(getImportOptions()));
}

function loadImportOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(IMPORT_OPTIONS_STORAGE_KEY) || '{}');
    elements.skipChinaNumbersToggle.checked = saved.skipChinaNumbers !== false;
  } catch {
    elements.skipChinaNumbersToggle.checked = true;
  }
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
  const isPlanPage = ['planPage', 'usagePage', 'quotaPage', 'billingPage', 'referralPage'].includes(pageId);
  elements.plansToggle.classList.toggle('active', isPlanPage);
  if (isPlanPage) setPlansExpanded(true);
  if (pageId === 'historyPage') loadHistory();
}

function setPlansExpanded(expanded) {
  elements.plansToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  elements.plansSubnav.classList.toggle('collapsed', !expanded);
}

function renderStats(stats) {
  const blocked = (stats.invalid || 0) + (stats.duplicate || 0);
  setText('totalCount', stats.total || 0);
  setText('validCount', stats.valid || 0);
  setText('pendingCount', stats.pending || 0);
  setText('chinaSkippedCount', stats.chinaNumbers || stats.chinaSkipped || 0);
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
      <td>${escapeHtml(rowErrorLabel(row.error))}</td>
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

  saveImportOptions();
  const response = await window.addWhatsapp.importContacts(getImportOptions());

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
  const chinaCount = response.data.stats.chinaNumbers || response.data.stats.chinaSkipped || 0;
  const chinaMode = response.data.importOptions && response.data.importOptions.skipChinaNumbers === false
    ? `中国号码 ${chinaCount} 个已加入队列。`
    : `中国号码 ${chinaCount} 个已排除。`;
  addLog(`已导入 ${response.data.fileName}，有效号码 ${response.data.stats.valid || 0} 个，${chinaMode}`, 'strong');
}

function applyImportedData(data) {
  state.imported = data;
  if (data.importOptions) {
    elements.skipChinaNumbersToggle.checked = data.importOptions.skipChinaNumbers !== false;
    saveImportOptions();
  }
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
    'task:proxy-error': event.message,
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
  if (event.type === 'task:proxy-error') {
    elements.taskState.textContent = '代理异常';
    elements.taskStateMetric.textContent = '正在停下';
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
    return;
  }

  elements.runButton.disabled = true;
  elements.stopButton.disabled = false;
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
  if (!state.auth.authenticated) return;
  try {
    renderTemplates(await window.addWhatsapp.getTemplates());
  } catch (error) {
    addLog(error.message || '模板加载失败。', 'error');
  }
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
  if (!state.auth.authenticated) return;
  renderHistory(await window.addWhatsapp.listHistory());
}

async function loadAuthenticatedWorkspace(bootstrap = null) {
  const data = bootstrap || await window.addWhatsapp.getBootstrapState();
  if (data.auth) applyAuthState(data.auth);
  if (!state.auth.authenticated) return;
  if (data.imported) {
    applyImportedData(data.imported);
    addLog(`已恢复上次表格 ${data.imported.fileName}，可从记录位置继续。`, 'strong');
  }
  if (data.history) renderHistory(data.history);
  await loadTemplates();
}

async function bootstrapApp() {
  const bootstrap = await window.addWhatsapp.getBootstrapState();
  applyAuthState(bootstrap.auth);
  if (bootstrap.auth && bootstrap.auth.error) {
    setAuthMessage(bootstrap.auth.error, 'error');
    return;
  }
  await loadAuthenticatedWorkspace(bootstrap);
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
elements.plansToggle.addEventListener('click', () => {
  const expanded = elements.plansToggle.getAttribute('aria-expanded') === 'true';
  setPlansExpanded(!expanded);
});
for (const tab of elements.authTabs) {
  tab.addEventListener('click', () => switchAuthMode(tab.dataset.authMode));
}
elements.loginForm.addEventListener('submit', handleLogin);
elements.registerForm.addEventListener('submit', handleRegister);
elements.resetForm.addEventListener('submit', handleResetPassword);
elements.downloadRecoveryButton.addEventListener('click', downloadRecovery);
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
elements.openWorkspaceButton.addEventListener('click', showWorkspaceRiskModal);
elements.proxySettingsButton.addEventListener('click', showProxySettings);
elements.logoutButton.addEventListener('click', logoutAccount);
elements.clearWhatsAppButton.addEventListener('click', clearWhatsAppSession);
elements.exportSyncButton.addEventListener('click', exportSyncPackage);
elements.importSyncButton.addEventListener('click', importSyncPackage);
elements.membershipCard.addEventListener('pointermove', updateMembershipCardLight);
elements.membershipCard.addEventListener('pointerleave', resetMembershipCardLight);
elements.workspaceRiskConfirmButton.addEventListener('click', openAnotherWorkspace);
elements.workspaceRiskCancelButton.addEventListener('click', hideWorkspaceRiskModal);
elements.workspaceRiskModal.addEventListener('click', event => {
  if (event.target === elements.workspaceRiskModal) hideWorkspaceRiskModal();
});
elements.proxyCheckButton.addEventListener('click', testProxySettings);
elements.proxySaveButton.addEventListener('click', saveProxySettings);
elements.proxyCancelButton.addEventListener('click', hideProxySettings);
for (const button of document.querySelectorAll('[data-proxy-lookup]')) {
  button.addEventListener('click', () => setProxyLookupChannel(button.dataset.proxyLookup));
}
elements.proxySettingsModal.addEventListener('click', event => {
  if (event.target === elements.proxySettingsModal) hideProxySettings();
});
elements.closeModal.addEventListener('click', event => {
  if (event.target === elements.closeModal) handleCloseChoice('cancel');
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !elements.closeModal.hidden) handleCloseChoice('cancel');
  if (event.key === 'Escape' && !elements.workspaceRiskModal.hidden) hideWorkspaceRiskModal();
  if (event.key === 'Escape' && !elements.proxySettingsModal.hidden) hideProxySettings();
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
window.addWhatsapp.onAuthChanged(applyAuthState);
loadImportOptions();
elements.skipChinaNumbersToggle.addEventListener('change', saveImportOptions);
bootstrapApp();
