const state = {
  auth: { authenticated: false, user: null },
  subscription: null,
  imported: null,
  templates: { en: [], es: [], fr: [] },
  taskStats: { sent: 0, failed: 0, unregistered: 0, invalid: 0 },
  activeTemplateLanguage: 'en',
  activePayment: null,
  paymentRequestInFlight: false,
  taskStartInFlight: false,
  selectedQuotaCredits: 2000,
  statisticsDays: 365,
  statisticsMetric: 'sent',
  analytics: null,
  update: null
};

const CLOUD_ENTITLEMENT_REFRESH_MIN_INTERVAL_MS = 30 * 1000;
let cloudEntitlementRefreshInFlight = null;
let lastCloudEntitlementRefreshAt = 0;

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
  resetWhatsAppButton: document.getElementById('resetWhatsAppButton'),
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
  statisticsSent: document.getElementById('statisticsSent'),
  statisticsProcessedNote: document.getElementById('statisticsProcessedNote'),
  statisticsSuccessRate: document.getElementById('statisticsSuccessRate'),
  statisticsUnregistered: document.getElementById('statisticsUnregistered'),
  statisticsUnregisteredNote: document.getElementById('statisticsUnregisteredNote'),
  statisticsTasks: document.getElementById('statisticsTasks'),
  statisticsActivityTitle: document.getElementById('statisticsActivityTitle'),
  statisticsActivityDescription: document.getElementById('statisticsActivityDescription'),
  statisticsPeak: document.getElementById('statisticsPeak'),
  statisticsPeakLabel: document.getElementById('statisticsPeakLabel'),
  statisticsCurrentStreak: document.getElementById('statisticsCurrentStreak'),
  statisticsLongestStreak: document.getElementById('statisticsLongestStreak'),
  statisticsActiveDays: document.getElementById('statisticsActiveDays'),
  activityMonthLabels: document.getElementById('activityMonthLabels'),
  activityHeatmap: document.getElementById('activityHeatmap'),
  statisticsTrend: document.getElementById('statisticsTrend'),
  statisticsOutcomes: document.getElementById('statisticsOutcomes'),
  statisticsLanguages: document.getElementById('statisticsLanguages'),
  statisticsSources: document.getElementById('statisticsSources'),
  statisticsDayButtons: [...document.querySelectorAll('[data-statistics-days]')],
  statisticsMetricButtons: [...document.querySelectorAll('[data-statistics-metric]')],
  closeModal: document.getElementById('closeModal'),
  closeModalDetail: document.getElementById('closeModalDetail'),
  closeMinimizeButton: document.getElementById('closeMinimizeButton'),
  closeQuitButton: document.getElementById('closeQuitButton'),
  closeCancelButton: document.getElementById('closeCancelButton'),
  currentAccountBadge: document.getElementById('currentAccountBadge'),
  accountNameBadge: document.getElementById('accountNameBadge'),
  accountUidValue: document.getElementById('accountUidValue'),
  openWorkspaceButton: document.getElementById('openWorkspaceButton'),
  proxySettingsButton: document.getElementById('proxySettingsButton'),
  logoutButton: document.getElementById('logoutButton'),
  clearWhatsAppButton: document.getElementById('clearWhatsAppButton'),
  currentVersionValue: document.getElementById('currentVersionValue'),
  targetVersionValue: document.getElementById('targetVersionValue'),
  updateStatusText: document.getElementById('updateStatusText'),
  updateProgress: document.getElementById('updateProgress'),
  updateErrorText: document.getElementById('updateErrorText'),
  updateNotesButton: document.getElementById('updateNotesButton'),
  checkUpdateButton: document.getElementById('checkUpdateButton'),
  installUpdateButton: document.getElementById('installUpdateButton'),
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
  quotaPayButton: document.getElementById('quotaPayButton'),
  quotaCreditButtons: [...document.querySelectorAll('[data-quota-credits]')],
  quotaCustomCreditsField: document.getElementById('quotaCustomCreditsField'),
  quotaCustomCreditsInput: document.getElementById('quotaCustomCreditsInput'),
  manualPaymentPanel: document.getElementById('manualPaymentPanel'),
  manualPaymentTitle: document.getElementById('manualPaymentTitle'),
  manualPaymentDescription: document.getElementById('manualPaymentDescription'),
  manualPaymentOrderNo: document.getElementById('manualPaymentOrderNo'),
  manualPaymentAmount: document.getElementById('manualPaymentAmount'),
  manualPaymentNote: document.getElementById('manualPaymentNote'),
  manualPaymentQr: document.getElementById('manualPaymentQr'),
  manualPaymentQrFallback: document.getElementById('manualPaymentQrFallback'),
  paymentLinkBox: document.getElementById('paymentLinkBox'),
  paymentLink: document.getElementById('paymentLink'),
  paymentOpenButton: document.getElementById('paymentOpenButton'),
  paymentCopyButton: document.getElementById('paymentCopyButton'),
  paymentCountdown: document.getElementById('paymentCountdown'),
  paymentCancelButton: document.getElementById('paymentCancelButton'),
  paymentRetryButton: document.getElementById('paymentRetryButton'),
  paymentSuccessModal: document.getElementById('paymentSuccessModal'),
  paymentSuccessDetail: document.getElementById('paymentSuccessDetail'),
  paymentSuccessConfirmButton: document.getElementById('paymentSuccessConfirmButton'),
  planPaymentSlot: document.getElementById('planPaymentSlot'),
  quotaPaymentSlot: document.getElementById('quotaPaymentSlot'),
  billingPlanDescription: document.getElementById('billingPlanDescription'),
  billingPayButton: document.getElementById('billingPayButton'),
  billingIncludedList: document.getElementById('billingIncludedList'),
  billingExcludedList: document.getElementById('billingExcludedList'),
  billingHistoryBody: document.getElementById('billingHistoryBody'),
  refreshEntitlementsButton: document.getElementById('refreshEntitlementsButton')
};

const PAGE_ACTIONS = new Set(['importPage']);
const IMPORT_OPTIONS_STORAGE_KEY = 'addWhatsapp.importOptions';
const DEFAULT_MANUAL_ALIPAY_QR = '../../assets/pay/alipay-qr.png';
const PAYMENT_ORDER_TTL_MS = 5 * 60 * 1000;
const PAYMENT_POLL_INTERVAL_MS = 3000;
const PAYMENT_DEBUG_PREFIX = '[payment-debug]';
const TEMPLATE_META = {
  en: { title: '英语模板', description: '英语区号码随机选择这些文案。', badge: 'EN' },
  es: { title: '西班牙语模板', description: '西班牙、墨西哥和拉美号码随机选择这些文案。', badge: 'ES' },
  fr: { title: '法语模板', description: '法国和法语区号码随机选择这些文案。', badge: 'FR' }
};

function debugPayment(step, payload = {}) {
  if (localStorage.getItem('addWhatsapp.paymentDebug') !== '1') return;
  console.log(PAYMENT_DEBUG_PREFIX, step, payload);
}

let paymentCountdownTimer = null;
let paymentPollTimer = null;

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

function displayUserUid(user = {}) {
  const uid = String(user.uid || '').trim();
  return /^\d{8}$/.test(uid) ? uid : '-';
}

function applyAuthState(auth) {
  state.auth = auth || { authenticated: false, user: null };
  if (state.auth.subscription) renderSubscriptionState(state.auth.subscription);
  const authenticated = Boolean(state.auth.authenticated && state.auth.user);
  elements.authGate.hidden = authenticated;
  elements.appShell.hidden = !authenticated;
  const username = authenticated ? state.auth.user.username : '未登录';
  const uid = authenticated ? displayUserUid(state.auth.user) : '-';
  elements.currentAccountBadge.textContent = username;
  elements.accountNameBadge.textContent = username;
  elements.accountUidValue.textContent = uid;
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
  }
}

function formatCredits(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatPlanPrice(plan) {
  if (!plan.unitPriceCents) return '¥0';
  const unitPriceYuan = Number(plan.unitPriceCents) / 100;
  if (unitPriceYuan > 0 && unitPriceYuan < 0.01) return `¥${unitPriceYuan.toFixed(4)}`;
  return `¥${unitPriceYuan.toFixed(plan.unitPriceCents % 100 === 0 ? 0 : 2)}`;
}

function planRank(catalog = [], planId = '') {
  const index = catalog.findIndex(plan => plan.id === planId);
  return index >= 0 ? index : -1;
}

function updateQuotaEstimate(subscription = state.subscription) {
  if (!elements.quotaEstimate || !subscription || !subscription.plan) return;
  const credits = Math.max(0, Number(state.selectedQuotaCredits || 0));
  const amountCents = Math.round(credits * Number(subscription.plan.unitPriceCents || 0));
  elements.quotaEstimate.textContent = `¥${(amountCents / 100).toFixed(2)}`;
}

function applySelectedQuotaCredits(credits) {
  const normalized = Math.floor(Number(credits || 0));
  state.selectedQuotaCredits = Number.isInteger(normalized) && normalized > 0 ? normalized : 0;
  updateQuotaEstimate();
  updateActionLocks();
  return state.selectedQuotaCredits;
}

function setCustomQuotaVisible(visible) {
  if (!elements.quotaCustomCreditsField) return;
  elements.quotaCustomCreditsField.hidden = !visible;
  if (visible && elements.quotaCustomCreditsInput) {
    elements.quotaCustomCreditsInput.value = state.selectedQuotaCredits > 0
      ? String(state.selectedQuotaCredits)
      : '';
    elements.quotaCustomCreditsInput.focus();
  }
}

function selectQuotaCredits(button) {
  if (!button) return;
  const value = button.dataset.quotaCredits;
  const isCustom = value === 'custom';
  const credits = isCustom ? state.selectedQuotaCredits : Number(value);
  state.selectedQuotaCredits = credits;
  for (const item of elements.quotaCreditButtons) {
    item.classList.toggle('active', item === button);
  }
  setCustomQuotaVisible(isCustom);
  if (!isCustom) applySelectedQuotaCredits(credits);
  else updateQuotaEstimate();
}

function handleCustomQuotaInput() {
  const credits = applySelectedQuotaCredits(elements.quotaCustomCreditsInput.value);
  if (!credits) {
    elements.syncState.textContent = '请输入有效的充值额度。';
  } else {
    elements.syncState.textContent = '自定义额度已更新。';
  }
}

function renderPlanCards(subscription) {
  if (!elements.planCards) return;
  const activePlanId = subscription.plan && subscription.plan.id;
  const activeRank = planRank(subscription.catalog || [], activePlanId);
  elements.planCards.innerHTML = '';
  for (const plan of subscription.catalog || []) {
    const isActive = plan.id === activePlanId;
    const isHigherPlan = planRank(subscription.catalog || [], plan.id) > activeRank;
    const isLowerPlan = !isActive && !isHigherPlan;
    const card = document.createElement('article');
    card.className = `plan-card ${isActive ? 'active' : ''} ${plan.recommended ? 'recommended' : ''}`.trim();
    const topUp = plan.minimumTopUpCredits
      ? `${formatCredits(plan.minimumTopUpCredits)} 额度起充`
      : '无需充值';
    const templateLimit = plan.templateLimit ? `自定义文案模板 X${plan.templateLimit}` : '自定义文案模板不限';
    const canTopUp = Boolean(isHigherPlan && plan.capabilities && plan.capabilities.onlinePayment && Number(plan.minimumTopUpCredits || 0) > 0);
    const actionText = isActive ? '当前套餐' : (isLowerPlan ? '低于当前套餐' : (canTopUp ? '微信支付' : '暂不支持'));
    const disabled = !canTopUp;
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
      <button class="button ${isActive ? 'secondary' : 'ghost'}" type="button" data-plan-pay="${escapeHtml(plan.id)}" ${disabled ? 'disabled' : ''}>${actionText}</button>
    `;
    const payButton = card.querySelector('[data-plan-pay]');
    debugPayment('render plan card', {
      planId: plan.id,
      activePlanId,
      isActive,
      isHigherPlan,
      canTopUp,
      disabled,
      actionText
    });
    if (payButton && !disabled) {
      payButton.addEventListener('click', () => {
        debugPayment('plan card button clicked', {
          planId: plan.id,
          activePlanId: state.subscription && state.subscription.plan && state.subscription.plan.id,
          disabled: payButton.disabled,
          text: payButton.textContent
        });
        startWechatTopUp(plan.id, payButton);
      });
    }
    elements.planCards.appendChild(card);
  }
}

function renderSubscriptionState(subscription) {
  const catalog = Array.isArray(subscription.catalog) && subscription.catalog.length
    ? subscription.catalog
    : (state.subscription && Array.isArray(state.subscription.catalog) ? state.subscription.catalog : []);
  state.subscription = { ...subscription, catalog };
  subscription = state.subscription;
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
  updateQuotaEstimate(subscription);
  elements.billingPlanDescription.textContent = `${plan.name || '-'}：每日可用上限 ${formatCredits(plan.dailyLimit)}，工作台 ${formatCredits(plan.workspaceLimit)} 个。`;
  renderUsageLedger(subscription);
  renderBillingFeatureLists(plan);
  if (elements.dailyLimitInput && plan.dailyLimit) {
    elements.dailyLimitInput.max = String(plan.dailyLimit);
    elements.dailyLimitInput.value = String(plan.dailyLimit);
  }
  enforceDelayInputs();
  if (state.templates) renderTemplates(state.templates);
  updateWorkspaceButtonState();
  updateActionLocks();
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
  const included = planIncludedFeatures(plan);
  const excluded = planExcludedFeatures(plan);
  elements.billingIncludedList.innerHTML = included.map(item => `<span class="feature-ok">${escapeHtml(item)}</span>`).join('');
  elements.billingExcludedList.innerHTML = excluded.map(item => `<span class="feature-no">${escapeHtml(item)}</span>`).join('');
}

function billingStatusMeta(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    created: ['待支付', 'pending'],
    paid: ['已支付', 'valid'],
    paid_pending_credit: ['入账处理中', 'pending'],
    canceled: ['已取消', 'invalid'],
    expired: ['已超时', 'invalid'],
    closed: ['已关闭', 'invalid']
  };
  return labels[normalized] || [status || '-', 'pending'];
}

function renderBillingHistory(orders = []) {
  if (!elements.billingHistoryBody) return;
  if (!orders.length) {
    elements.billingHistoryBody.innerHTML = '<tr class="empty-row"><td colspan="5">暂无充值订单。</td></tr>';
    return;
  }
  elements.billingHistoryBody.innerHTML = orders.map((order) => {
    const [label, tone] = billingStatusMeta(order.status);
    const paidOrClosedAt = order.paidAt || order.closedAt || order.createdAt;
    const action = order.status === 'paid'
      ? '已入账'
      : (order.status === 'created' ? '等待支付' : '无需处理');
    return `
      <tr>
        <td>${escapeHtml(order.orderNo || order.id || '-')}</td>
        <td><span class="status-tag status-${tone}">${escapeHtml(label)}</span></td>
        <td>¥${(Number(order.amountCents || 0) / 100).toFixed(2)}</td>
        <td>${formatTime(paidOrClosedAt)}</td>
        <td>${action}</td>
      </tr>
    `;
  }).join('');
}

async function refreshBillingOrders({ quiet = false } = {}) {
  if (!elements.billingHistoryBody || !window.addWhatsapp.listPaymentOrders || !state.auth.authenticated) return;
  if (!quiet) {
    elements.billingHistoryBody.innerHTML = '<tr class="empty-row"><td colspan="5">正在刷新账单...</td></tr>';
  }
  try {
    const response = await window.addWhatsapp.listPaymentOrders();
    if (await handleApiError(response)) return;
    if (response.ok) {
      renderBillingHistory(response.items || []);
    } else if (!quiet) {
      elements.billingHistoryBody.innerHTML = `<tr class="empty-row"><td colspan="5">${escapeHtml(response.error || '账单刷新失败。')}</td></tr>`;
    }
  } catch (error) {
    if (!quiet) {
      elements.billingHistoryBody.innerHTML = `<tr class="empty-row"><td colspan="5">${escapeHtml(error.message || '账单刷新失败。')}</td></tr>`;
    }
  }
}

function planIncludedFeatures(plan = {}) {
  const capabilities = plan.capabilities || {};
  const features = [
    `${formatCredits(plan.dailyLimit)} 每日可用上限`,
    `${formatCredits(plan.workspaceLimit)} 个工作台`,
    plan.templateLimit ? `自定义文案模板 X${plan.templateLimit}` : '自定义文案模板不限',
    '导入预检和历史报表'
  ];
  if (capabilities.exportPreview) features.push('导出预检报表');
  if (capabilities.secondaryWorkspace) features.push('新建独立工作台');
  if (capabilities.proxySettings) features.push('第二工作台代理 IP 设置');
  if (capabilities.workspaceExpansionReview) features.push('工作台扩容可人工审核');
  return features;
}

function planExcludedFeatures(plan = {}) {
  const capabilities = plan.capabilities || {};
  const excluded = [];
  if (!capabilities.exportPreview) excluded.push('导出预检报表');
  if (!capabilities.secondaryWorkspace) excluded.push('新建独立工作台');
  if (!capabilities.proxySettings) excluded.push('代理 IP 设置');
  if (plan.templateLimit) excluded.push(`超过 ${formatCredits(plan.templateLimit)} 条自定义文案模板`);
  if (plan.id === 'business') excluded.push('第 6 个及以上工作台需人工审核扩容');
  if (!capabilities.onlinePayment) excluded.push('人工充值');
  excluded.push('自动发票');
  return excluded;
}

function featureAccess(feature) {
  const plan = state.subscription && state.subscription.plan ? state.subscription.plan : {};
  if (plan.capabilities && plan.capabilities[feature]) return { ok: true };
  const labels = {
    exportPreview: '导出预检属于进阶版及以上功能',
    secondaryWorkspace: '新建工作台属于进阶版及以上功能',
    proxySettings: '代理 IP 设置属于进阶版及以上功能'
  };
  return {
    ok: false,
    message: `${labels[feature] || '该功能'}，当前${plan.name || '套餐'}不可用。`
  };
}

function taskStartAccess() {
  const subscription = state.subscription || {};
  const plan = subscription.plan || {};
  if (plan.unitPriceCents > 0 && Number(subscription.balanceCredits || 0) <= 0) {
    return { ok: false, message: `当前${plan.name}账户余额为 0，不能开始新的成功添加任务。请联系开通或等待人工充值。` };
  }
  if (Number(subscription.availableNow || 0) <= 0 || Number(subscription.dailyRemaining || 0) <= 0) {
    return { ok: false, message: `当前${plan.name}今日可用上限已用完，请等服务器 00:00 重置后继续。` };
  }
  return { ok: true };
}

function updateActionLocks() {
  if (elements.exportButton) {
    const exportAccess = featureAccess('exportPreview');
    elements.exportButton.disabled = !state.imported || !exportAccess.ok;
    elements.exportButton.title = exportAccess.ok ? '' : exportAccess.message;
  }
  if (elements.runButton) {
    const validCount = state.imported && state.imported.stats ? Number(state.imported.stats.valid || 0) : 0;
    const taskAccess = taskStartAccess();
    elements.runButton.disabled = state.taskStartInFlight || !state.imported || validCount <= 0 || !taskAccess.ok;
    elements.runButton.title = taskAccess.ok ? '' : taskAccess.message;
  }
  const paymentAccess = featureAccess('onlinePayment');
  const canPay = Boolean(paymentAccess.ok && state.auth && state.auth.authenticated);
  const hasOpenPayment = Boolean(
    state.activePayment
    && state.activePayment.orderId
    && ['pending', 'closing'].includes(state.activePayment.status)
  );
  const paymentBusy = hasOpenPayment || state.paymentRequestInFlight;
  const quotaCreditsValid = Number(state.selectedQuotaCredits || 0) > 0;
  for (const button of [elements.quotaPayButton, elements.billingPayButton]) {
    if (!button) continue;
    const invalidQuota = button === elements.quotaPayButton && !quotaCreditsValid;
    button.disabled = !canPay || paymentBusy || invalidQuota;
    button.title = paymentAccess.ok
      ? (invalidQuota ? '请输入有效的充值额度。' : (paymentBusy ? '请先等待当前支付订单生成完成，或取消/完成当前订单。' : (canPay ? '' : '请先登录账号。')))
      : paymentAccess.message;
  }
  const activePlanId = state.subscription && state.subscription.plan && state.subscription.plan.id;
  const catalog = state.subscription && state.subscription.catalog ? state.subscription.catalog : [];
  const activeRank = planRank(catalog, activePlanId);
  for (const button of document.querySelectorAll('[data-plan-pay]')) {
    const plan = catalog.find(item => item.id === button.dataset.planPay);
    const isActivePlan = button.dataset.planPay === activePlanId;
    const isHigherPlan = Boolean(plan && planRank(catalog, plan.id) > activeRank);
    const isLowerPlan = Boolean(plan && !isActivePlan && !isHigherPlan);
    const planCanPay = Boolean(plan && isHigherPlan && plan.capabilities && plan.capabilities.onlinePayment && Number(plan.minimumTopUpCredits || 0) > 0);
    button.disabled = !planCanPay || !canPay || paymentBusy;
    button.title = isActivePlan
      ? ''
      : (isLowerPlan
        ? '当前已是更高套餐，如需增加额度请到额度页购买。'
        : (paymentBusy ? '请先等待当前支付订单生成完成，或取消/完成当前订单。' : (planCanPay ? (canPay ? '' : '请先登录账号。') : '该套餐无需线上充值。')));
    debugPayment('plan button lock state', {
      planId: button.dataset.planPay,
      activePlanId,
      isActivePlan,
      isHigherPlan,
      planCanPay,
      canPay,
      disabled: button.disabled,
      title: button.title
    });
  }
}

function updateWorkspaceButtonState() {
  if (!elements.openWorkspaceButton || !state.subscription) return;
  const plan = state.subscription.plan || {};
  const workspaceAccess = featureAccess('secondaryWorkspace');
  const isSecondaryWorkspace = Boolean(state.auth.workspace && state.auth.workspace.isSecondary);
  const totalOpen = 1 + Number(state.subscription.openSecondaryCount || 0);
  const blocked = !isSecondaryWorkspace && (!workspaceAccess.ok || (plan.workspaceLimit && totalOpen >= plan.workspaceLimit));
  elements.openWorkspaceButton.disabled = Boolean(blocked);
  if (!workspaceAccess.ok) {
    elements.openWorkspaceButton.textContent = '进阶版解锁新工作台';
    elements.openWorkspaceButton.title = workspaceAccess.message;
  } else if (blocked) {
    elements.openWorkspaceButton.textContent = `已达到${plan.name}工作台上限`;
    elements.openWorkspaceButton.title = `当前${plan.name}最多同时使用 ${plan.workspaceLimit} 个工作台。`;
  } else {
    elements.openWorkspaceButton.textContent = '新建工作台 / 打开另一个账号';
    elements.openWorkspaceButton.title = '';
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
  applyAuthState(response.auth || { authenticated: true, user: response.user, subscription: response.subscription, cloud: response.cloud });
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
  setAuthMessage('账号已注册并登录。', 'strong');
  applyAuthState(response.auth || { authenticated: true, user: response.user, subscription: response.subscription, cloud: response.cloud });
  await loadAuthenticatedWorkspace();
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

async function handleApiError(response) {
  if (response && !response.ok && (response.authRequired || response.error === 'UNAUTHORIZED')) {
    const logout = await window.addWhatsapp.logoutAccount();
    if (logout && logout.ok) {
      clearPaymentTimers();
      applyAuthState({ authenticated: false, user: null });
      switchAuthMode('login');
      setAuthMessage('云端登录已失效，请重新登录。', 'error');
      return true;
    }
    const runningTask = logout && (logout.currentTaskRunning || /任务正在运行/.test(logout.error || ''));
    if (runningTask) {
      elements.syncState.textContent = '云端登录已失效，当前任务会继续运行；任务结束后请重新登录同步额度。';
      addLog('云端登录已失效，当前任务会继续运行；任务结束后请重新登录同步额度。', 'error');
      return true;
    }
    applyAuthState({ authenticated: false, user: null });
    switchAuthMode('login');
    setAuthMessage((logout && logout.error) || '云端登录已失效，请重新登录。', 'error');
    return true;
  }
  return false;
}

async function refreshCloudEntitlements(options = {}) {
  if (typeof window.addWhatsapp.refreshCloudEntitlements !== 'function') {
    return { ok: true, skipped: true };
  }
  const quiet = Boolean(options.quiet);
  if (!quiet) {
    elements.refreshEntitlementsButton.disabled = true;
    elements.syncState.textContent = '正在刷新套餐...';
  }
  const response = await window.addWhatsapp.refreshCloudEntitlements();
  if (!quiet) elements.refreshEntitlementsButton.disabled = false;
  if (await handleApiError(response)) {
    return response;
  }
  if (response.ok && response.subscription) {
    renderSubscriptionState(response.subscription);
    await refreshBillingOrders({ quiet: true });
    if (!quiet) elements.syncState.textContent = '套餐余额已刷新。';
  } else if (!quiet) {
    elements.syncState.textContent = response.error || '刷新套餐失败。';
  }
  return response;
}

async function refreshCloudEntitlementsIfStale({ force = false } = {}) {
  if (!state.auth.authenticated) return { ok: true, skipped: true };
  const now = Date.now();
  if (!force && now - lastCloudEntitlementRefreshAt < CLOUD_ENTITLEMENT_REFRESH_MIN_INTERVAL_MS) {
    return { ok: true, skipped: true };
  }
  if (cloudEntitlementRefreshInFlight) return cloudEntitlementRefreshInFlight;
  lastCloudEntitlementRefreshAt = now;
  cloudEntitlementRefreshInFlight = refreshCloudEntitlements({ quiet: true })
    .finally(() => {
      cloudEntitlementRefreshInFlight = null;
    });
  return cloudEntitlementRefreshInFlight;
}

function clearPaymentTimers() {
  if (paymentCountdownTimer) {
    clearInterval(paymentCountdownTimer);
    paymentCountdownTimer = null;
  }
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer);
    paymentPollTimer = null;
  }
}

function paymentExpiryFor(order = {}) {
  return order.expiresAt || new Date(Date.now() + PAYMENT_ORDER_TTL_MS).toISOString();
}

function formatPaymentRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setPaymentControls({ canCancel = false, canRetry = false, cancelText = '取消支付' } = {}) {
  if (elements.paymentCancelButton) {
    elements.paymentCancelButton.hidden = !canCancel;
    elements.paymentCancelButton.textContent = cancelText;
  }
  if (elements.paymentRetryButton) elements.paymentRetryButton.hidden = !canRetry;
}

function placePaymentPanel(context = 'plan') {
  const slot = context === 'quota' ? elements.quotaPaymentSlot : elements.planPaymentSlot;
  if (slot && elements.manualPaymentPanel && elements.manualPaymentPanel.parentNode !== slot) {
    slot.appendChild(elements.manualPaymentPanel);
  }
}

function updatePaymentCountdown() {
  if (!state.activePayment || !elements.paymentCountdown) return;
  const remainingMs = new Date(state.activePayment.expiresAt).getTime() - Date.now();
  if (state.activePayment.status !== 'pending') {
    elements.paymentCountdown.textContent = state.activePayment.statusText || '';
    return;
  }
  if (remainingMs <= 0) {
    elements.paymentCountdown.textContent = '订单已超时，正在关闭支付链路...';
    closeActivePayment('expired');
    return;
  }
  elements.paymentCountdown.textContent = `${formatPaymentRemaining(remainingMs)} 后订单自动关闭`;
}

function startPaymentWatchers() {
  clearPaymentTimers();
  updatePaymentCountdown();
  paymentCountdownTimer = setInterval(updatePaymentCountdown, 1000);
  paymentPollTimer = setInterval(pollActivePayment, PAYMENT_POLL_INTERVAL_MS);
}

function renderClosedPayment(status, message) {
  state.activePayment = state.activePayment
    ? { ...state.activePayment, status, statusText: message }
    : null;
  clearPaymentTimers();
  if (elements.manualPaymentNote) elements.manualPaymentNote.textContent = message;
  if (elements.paymentCountdown) elements.paymentCountdown.textContent = message;
  if (elements.manualPaymentQr) {
    elements.manualPaymentQr.hidden = true;
    elements.manualPaymentQr.removeAttribute('src');
  }
  if (elements.manualPaymentQrFallback) {
    elements.manualPaymentQrFallback.hidden = false;
    elements.manualPaymentQrFallback.textContent = status === 'paid'
      ? '支付成功，额度已入账。'
      : '支付链路已关闭，可重新生成订单。';
  }
  setPaymentControls({ canCancel: false, canRetry: status !== 'paid' });
  updateActionLocks();
}

function renderPaymentClosingState(message) {
  clearPaymentTimers();
  if (state.activePayment) state.activePayment.statusText = message;
  if (elements.manualPaymentNote) elements.manualPaymentNote.textContent = message;
  if (elements.paymentCountdown) elements.paymentCountdown.textContent = message;
  if (elements.manualPaymentQr) {
    elements.manualPaymentQr.hidden = true;
    elements.manualPaymentQr.removeAttribute('src');
  }
  if (elements.manualPaymentQrFallback) {
    elements.manualPaymentQrFallback.hidden = false;
    elements.manualPaymentQrFallback.textContent = '支付链路正在关闭，二维码已停止显示。';
  }
  if (elements.paymentLinkBox) elements.paymentLinkBox.hidden = true;
  setPaymentControls({ canCancel: false, canRetry: false });
  updateActionLocks();
}

function renderPaymentUnavailable(message = '订单已失效，可重新生成。') {
  clearPaymentTimers();
  setPaymentState(message);
  if (state.activePayment) {
    state.activePayment.status = 'unavailable';
    state.activePayment.statusText = message;
  }
  if (elements.manualPaymentNote) elements.manualPaymentNote.textContent = message;
  if (elements.paymentCountdown) elements.paymentCountdown.textContent = message;
  if (elements.manualPaymentQr) {
    elements.manualPaymentQr.hidden = true;
    elements.manualPaymentQr.removeAttribute('src');
  }
  if (elements.manualPaymentQrFallback) {
    elements.manualPaymentQrFallback.hidden = false;
    elements.manualPaymentQrFallback.textContent = '当前支付订单已结束，请重新生成订单。';
  }
  if (elements.paymentLinkBox) elements.paymentLinkBox.hidden = true;
  setPaymentControls({ canCancel: false, canRetry: true });
  state.activePayment = null;
  updateActionLocks();
}

async function pollActivePayment() {
  if (!state.activePayment || state.activePayment.status !== 'pending') return;
  if (!window.addWhatsapp.getPaymentOrderStatus) return;
  try {
    const response = await window.addWhatsapp.getPaymentOrderStatus({ orderId: state.activePayment.orderId });
    if (await handleApiError(response)) return;
    if (!response.ok || !response.order) return;
    const order = response.order;
    if (order.status === 'paid') {
      const paymentContext = state.activePayment && state.activePayment.context === 'quota' ? 'quota' : 'plan';
      renderClosedPayment('paid', '支付成功，额度已自动入账。');
      const entitlements = await refreshCloudEntitlements();
      await refreshBillingOrders({ quiet: true });
      switchPage(paymentContext === 'quota' ? 'quotaPage' : 'planPage');
      const synced = entitlements && entitlements.ok && entitlements.subscription;
      showPaymentSuccessModal(synced
        ? '支付成功，套餐和额度已同步。'
        : '支付成功，额度已入账；套餐同步失败时可稍后手动刷新。');
      return;
    }
    if (order.status === 'canceled' || order.status === 'expired' || order.closedAt) {
      renderClosedPayment(order.status || 'canceled', order.status === 'expired' ? '订单已超时关闭。' : '订单已取消。');
      await refreshBillingOrders({ quiet: true });
    }
  } catch (error) {
    debugPayment('payment poll failed', { message: error && error.message });
  }
}

async function closeActivePayment(reason = 'canceled') {
  if (!state.activePayment || state.activePayment.status !== 'pending') return;
  const orderId = state.activePayment.orderId;
  const isExpired = reason === 'expired';
  state.activePayment.status = 'closing';
  renderPaymentClosingState(isExpired ? '订单已超时，正在关闭支付链路...' : '正在关闭支付链路...');
  try {
    const response = await window.addWhatsapp.closePaymentOrder({ orderId, reason });
    if (await handleApiError(response)) return;
    if (!response.ok) {
      renderPaymentUnavailable('订单已失效，可重新生成。');
      await refreshBillingOrders({ quiet: true });
      return;
    }
    renderClosedPayment(isExpired ? 'expired' : 'canceled', isExpired ? '订单已超时关闭。' : '订单已取消。');
    setPaymentState(isExpired ? '订单已超时，支付链路已关闭。' : '订单已取消，支付链路已关闭。');
    await refreshBillingOrders({ quiet: true });
  } catch (error) {
    renderPaymentUnavailable('订单已失效，可重新生成。');
    await refreshBillingOrders({ quiet: true });
  }
}

function renderManualPayment(paymentResult) {
  if (!elements.manualPaymentPanel || !paymentResult || !paymentResult.payment) return;
  clearPaymentTimers();
  state.activePayment = null;
  const { order, payment, plan } = paymentResult;
  elements.manualPaymentPanel.hidden = false;
  elements.manualPaymentTitle.textContent = `${plan.name} ${formatCredits(plan.credits)} 额度`;
  elements.manualPaymentDescription.textContent = '付款时备注下面这串内容，后台看到后会给这个账号入账。';
  elements.manualPaymentOrderNo.textContent = order.orderNo;
  elements.manualPaymentAmount.textContent = `¥${(Number(payment.amountCents || plan.amountCents || 0) / 100).toFixed(2)}`;
  elements.manualPaymentNote.textContent = payment.paymentNote || order.orderNo;
  const qrUrl = payment.alipayQrImageUrl || payment.wechatQrImageUrl || DEFAULT_MANUAL_ALIPAY_QR;
  if (qrUrl) {
    elements.manualPaymentQr.hidden = false;
    elements.manualPaymentQr.src = qrUrl;
    elements.manualPaymentQr.onerror = () => {
      elements.manualPaymentQr.hidden = true;
      elements.manualPaymentQrFallback.hidden = false;
      elements.manualPaymentQrFallback.textContent = '收款码图片未放入 assets/pay/alipay-qr.png';
    };
    elements.manualPaymentQrFallback.hidden = true;
  } else {
    elements.manualPaymentQr.hidden = true;
    elements.manualPaymentQr.removeAttribute('src');
    elements.manualPaymentQrFallback.hidden = false;
    elements.manualPaymentQrFallback.textContent = '服务器还没配置收款码图片 URL';
  }
  if (elements.paymentLinkBox) elements.paymentLinkBox.hidden = true;
  setPaymentControls({ canCancel: false, canRetry: false });
}

function renderZpayPayment(paymentResult) {
  if (!elements.manualPaymentPanel || !paymentResult || !paymentResult.payment) return;
  clearPaymentTimers();
  state.activePayment = null;
  const { order, payment, plan } = paymentResult;
  elements.manualPaymentPanel.hidden = false;
  elements.manualPaymentTitle.textContent = `${plan.name} ${formatCredits(plan.credits)} 额度`;
  elements.manualPaymentDescription.textContent = 'ZPAY 收银台已在浏览器打开。付款成功后系统会自动入账，稍后点击刷新套餐。';
  elements.manualPaymentOrderNo.textContent = order.orderNo;
  elements.manualPaymentAmount.textContent = `¥${(Number(payment.amountCents || plan.amountCents || 0) / 100).toFixed(2)}`;
  elements.manualPaymentNote.textContent = '等待 ZPAY 回调';
  elements.manualPaymentQr.hidden = true;
  elements.manualPaymentQr.removeAttribute('src');
  elements.manualPaymentQrFallback.hidden = false;
  elements.manualPaymentQrFallback.textContent = payment.paymentUrl ? '如果浏览器没有自动弹出，请用左侧链接打开或复制。' : '支付链接生成失败';
  if (elements.paymentLinkBox) elements.paymentLinkBox.hidden = !payment.paymentUrl;
  if (elements.paymentLink) elements.paymentLink.textContent = payment.paymentUrl || '-';
  if (elements.paymentOpenButton) elements.paymentOpenButton.dataset.paymentUrl = payment.paymentUrl || '';
  if (elements.paymentCopyButton) elements.paymentCopyButton.dataset.paymentUrl = payment.paymentUrl || '';
  setPaymentControls({ canCancel: false, canRetry: false });
}

function renderWechatPaymentLoading(plan = {}, creditsOverride = null, context = 'plan') {
  if (!elements.manualPaymentPanel) return;
  placePaymentPanel(context);
  clearPaymentTimers();
  state.activePayment = null;
  const credits = Number(creditsOverride || plan.minimumTopUpCredits || 0);
  const amountCents = Math.round(credits * Number(plan.unitPriceCents || 0));
  elements.manualPaymentPanel.hidden = false;
  elements.manualPaymentTitle.textContent = `${plan.name || '套餐'} ${credits ? formatCredits(credits) : ''} 额度`;
  elements.manualPaymentDescription.textContent = '正在向服务端生成订单，并连接微信支付获取专属二维码。';
  elements.manualPaymentOrderNo.textContent = '生成中';
  elements.manualPaymentAmount.textContent = amountCents ? `¥${(amountCents / 100).toFixed(2)}` : '计算中';
  elements.manualPaymentNote.textContent = '支付链路正在加载中';
  if (elements.paymentCountdown) elements.paymentCountdown.textContent = '支付链路正在加载中';
  if (elements.paymentRetryButton && plan.id) {
    elements.paymentRetryButton.dataset.planId = plan.id;
    elements.paymentRetryButton.dataset.paymentContext = context;
    if (context === 'quota' && credits) elements.paymentRetryButton.dataset.credits = String(credits);
    else delete elements.paymentRetryButton.dataset.credits;
  }
  if (elements.manualPaymentQr) {
    elements.manualPaymentQr.hidden = true;
    elements.manualPaymentQr.removeAttribute('src');
  }
  if (elements.manualPaymentQrFallback) {
    elements.manualPaymentQrFallback.hidden = false;
    elements.manualPaymentQrFallback.innerHTML = '<span class="payment-loading-spinner" aria-hidden="true"></span><strong>支付链路正在加载中</strong>';
  }
  if (elements.paymentLinkBox) elements.paymentLinkBox.hidden = true;
  setPaymentControls({ canCancel: false, canRetry: false });
  updateActionLocks();
}

function renderPaymentLoadFailed(message) {
  clearPaymentTimers();
  state.activePayment = null;
  if (elements.manualPaymentNote) elements.manualPaymentNote.textContent = message;
  if (elements.paymentCountdown) elements.paymentCountdown.textContent = message;
  if (elements.manualPaymentQr) {
    elements.manualPaymentQr.hidden = true;
    elements.manualPaymentQr.removeAttribute('src');
  }
  if (elements.manualPaymentQrFallback) {
    elements.manualPaymentQrFallback.hidden = false;
    elements.manualPaymentQrFallback.textContent = '支付链路加载失败，可重新生成订单。';
  }
  if (elements.paymentLinkBox) elements.paymentLinkBox.hidden = true;
  setPaymentControls({ canCancel: false, canRetry: true });
  updateActionLocks();
}

function renderWechatPayment(paymentResult) {
  if (!elements.manualPaymentPanel || !paymentResult || !paymentResult.payment) return;
  const { order, payment, plan } = paymentResult;
  const context = paymentResult.paymentContext || 'plan';
  const payUrl = payment.codeUrl || payment.paymentUrl || '';
  placePaymentPanel(context);
  elements.manualPaymentPanel.hidden = false;
  elements.manualPaymentTitle.textContent = `${plan.name} ${formatCredits(plan.credits)} 额度`;
  elements.manualPaymentDescription.textContent = '请用微信扫描右侧二维码付款。付款成功后系统会自动入账，稍后点击刷新套餐。';
  elements.manualPaymentOrderNo.textContent = order.orderNo;
  elements.manualPaymentAmount.textContent = `¥${(Number(payment.amountCents || plan.amountCents || 0) / 100).toFixed(2)}`;
  elements.manualPaymentNote.textContent = '等待微信支付回调';
  state.activePayment = {
    orderId: order.id || payment.orderId,
    orderNo: order.orderNo || payment.orderNo,
    planId: plan.id,
    context,
    credits: Number(plan.credits || paymentResult.requestedCredits || 0),
    status: 'pending',
    expiresAt: paymentExpiryFor(order)
  };
  if (elements.paymentRetryButton) {
    elements.paymentRetryButton.dataset.planId = plan.id;
    elements.paymentRetryButton.dataset.paymentContext = context;
    if (context === 'quota' && state.activePayment.credits) {
      elements.paymentRetryButton.dataset.credits = String(state.activePayment.credits);
    } else {
      delete elements.paymentRetryButton.dataset.credits;
    }
  }
  if (payment.qrImageDataUrl) {
    elements.manualPaymentQr.hidden = false;
    elements.manualPaymentQr.src = payment.qrImageDataUrl;
    elements.manualPaymentQrFallback.hidden = true;
  } else {
    elements.manualPaymentQr.hidden = true;
    elements.manualPaymentQr.removeAttribute('src');
    elements.manualPaymentQrFallback.hidden = false;
    elements.manualPaymentQrFallback.textContent = payUrl ? '二维码生成失败，请复制支付链接处理。' : '微信支付链接生成失败';
  }
  if (elements.paymentLinkBox) elements.paymentLinkBox.hidden = !payUrl;
  if (elements.paymentLink) elements.paymentLink.textContent = payUrl || '-';
  if (elements.paymentOpenButton) elements.paymentOpenButton.dataset.paymentUrl = payUrl;
  if (elements.paymentCopyButton) elements.paymentCopyButton.dataset.paymentUrl = payUrl;
  setPaymentControls({ canCancel: true, canRetry: false });
  startPaymentWatchers();
  updateActionLocks();
}

function setPaymentState(message) {
  elements.syncState.textContent = message;
  if (elements.planPaymentState) elements.planPaymentState.textContent = message;
}

async function startManualTopUp(planId = null, sourceButton = null) {
  const plan = planId
    ? (state.subscription && state.subscription.catalog || []).find(item => item.id === planId)
    : state.subscription && state.subscription.plan;
  const targetPlanId = plan && plan.id ? plan.id : (state.subscription && state.subscription.plan && state.subscription.plan.id);
  const buttons = [sourceButton, elements.quotaPayButton, elements.billingPayButton].filter(Boolean);
  for (const button of buttons) button.disabled = true;
  setPaymentState('正在生成付款订单...');

  try {
    const response = await window.addWhatsapp.startManualTopUp({ planId: targetPlanId });
    if (await handleApiError(response)) {
      return;
    }
    if (!response.ok) {
      setPaymentState(response.error || '付款订单创建失败。');
      return;
    }

    renderManualPayment(response);
    setPaymentState(`订单 ${response.order.orderNo} 已生成，付款后等管理员确认入账。`);
  } catch (error) {
    setPaymentState(error.message || '付款订单创建失败，请稍后重试。');
  } finally {
    updateActionLocks();
  }
}

async function startZpayTopUp(planId = null, sourceButton = null) {
  const plan = planId
    ? (state.subscription && state.subscription.catalog || []).find(item => item.id === planId)
    : state.subscription && state.subscription.plan;
  const targetPlanId = plan && plan.id ? plan.id : (state.subscription && state.subscription.plan && state.subscription.plan.id);
  const buttons = [sourceButton, elements.quotaPayButton, elements.billingPayButton].filter(Boolean);
  for (const button of buttons) button.disabled = true;
  setPaymentState('正在生成 ZPAY 付款订单...');

  try {
    const response = await window.addWhatsapp.startZpayTopUp({ planId: targetPlanId });
    if (await handleApiError(response)) {
      return;
    }
    if (!response.ok) {
      setPaymentState(response.error || 'ZPAY 付款订单创建失败。');
      return;
    }

    renderZpayPayment(response);
    setPaymentState(`订单 ${response.order.orderNo} 已生成，ZPAY 收银台已打开，付款后会自动入账。`);
  } catch (error) {
    setPaymentState(error.message || 'ZPAY 付款订单创建失败，请稍后重试。');
  } finally {
    updateActionLocks();
  }
}

async function startWechatTopUp(planId = null, sourceButton = null, options = {}) {
  if (state.paymentRequestInFlight) {
    setPaymentState('微信支付订单正在生成，请稍候。');
    return;
  }
  if (state.activePayment && state.activePayment.status === 'pending') {
    setPaymentState('请先完成或取消当前支付订单。');
    return;
  }
  const plan = planId
    ? (state.subscription && state.subscription.catalog || []).find(item => item.id === planId)
    : state.subscription && state.subscription.plan;
  const targetPlanId = plan && plan.id ? plan.id : (state.subscription && state.subscription.plan && state.subscription.plan.id);
  const hasCreditsOverride = Object.prototype.hasOwnProperty.call(options, 'credits');
  const requestedCredits = hasCreditsOverride && Number.isInteger(Number(options.credits)) && Number(options.credits) > 0
    ? Math.floor(Number(options.credits))
    : null;
  if (hasCreditsOverride && !requestedCredits) {
    setPaymentState('请输入有效的充值额度。');
    return;
  }
  const paymentContext = hasCreditsOverride ? 'quota' : 'plan';
  const buttons = [sourceButton, elements.quotaPayButton, elements.billingPayButton].filter(Boolean);
  debugPayment('startWechatTopUp entered', {
    requestedPlanId: planId,
    targetPlanId,
    requestedCredits,
    sourceButtonText: sourceButton ? sourceButton.textContent : null,
    sourceButtonDisabled: sourceButton ? sourceButton.disabled : null,
    authenticated: Boolean(state.auth && state.auth.authenticated),
    activePlanId: state.subscription && state.subscription.plan && state.subscription.plan.id
  });
  state.paymentRequestInFlight = true;
  for (const button of buttons) button.disabled = true;
  setPaymentState('正在生成微信支付订单...');
  if (paymentContext === 'quota') switchPage('quotaPage');
  if (paymentContext === 'plan') switchPage('planPage');
  renderWechatPaymentLoading(plan || { id: targetPlanId, name: '微信支付' }, requestedCredits, paymentContext);
  updateActionLocks();

  try {
    const response = await window.addWhatsapp.startWechatTopUp({
      planId: targetPlanId,
      ...(requestedCredits ? { credits: requestedCredits } : {})
    });
    debugPayment('startWechatTopUp ipc response', {
      targetPlanId,
      ok: response && response.ok,
      error: response && response.error,
      authRequired: response && response.authRequired,
      orderNo: response && response.order && response.order.orderNo,
      provider: response && response.payment && response.payment.provider,
      hasCodeUrl: Boolean(response && response.payment && response.payment.codeUrl),
      hasQrImage: Boolean(response && response.payment && response.payment.qrImageDataUrl)
    });
    if (await handleApiError(response)) {
      return;
    }
    if (!response.ok) {
      const message = response.error || '微信支付订单创建失败。';
      renderPaymentLoadFailed(message);
      setPaymentState(message);
      return;
    }

    renderWechatPayment({ ...response, paymentContext, requestedCredits });
    setPaymentState(`订单 ${response.order.orderNo} 已生成，请扫码付款，付款后会自动入账。`);
    await refreshBillingOrders({ quiet: true });
  } catch (error) {
    debugPayment('startWechatTopUp exception', {
      targetPlanId,
      message: error && error.message
    });
    const message = error.message || '微信支付订单创建失败，请稍后重试。';
    renderPaymentLoadFailed(message);
    setPaymentState(message);
  } finally {
    state.paymentRequestInFlight = false;
    debugPayment('startWechatTopUp finally update locks', { targetPlanId });
    updateActionLocks();
  }
}

function showWorkspaceRiskModal() {
  const access = featureAccess('secondaryWorkspace');
  if (!access.ok) {
    elements.syncState.textContent = access.message;
    return;
  }
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
  if (await handleApiError(response)) {
    hideWorkspaceRiskModal();
    return;
  }
  if (!response.ok) {
    elements.syncState.textContent = response.error || '打开新工作台失败。';
    return;
  }
  hideWorkspaceRiskModal();
  elements.syncState.textContent = response.ok
    ? '已打开独立工作台。请在新窗口登录另一个账号，任务不会自动开始。'
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
  const access = featureAccess('proxySettings');
  if (!access.ok) {
    elements.syncState.textContent = access.message;
    return;
  }
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

async function resetWhatsAppLoginFromTask() {
  elements.resetWhatsAppButton.disabled = true;
  try {
    addLog('正在强制重置 WhatsApp 登录（清除缓存、关闭浏览器）...', 'strong');
    const response = await window.addWhatsapp.forceRescanWhatsApp();
    if (!response.ok) {
      addLog(response.error || 'WhatsApp 登录重置失败。', 'error');
      return;
    }

    addLog('WhatsApp 登录已重置。', 'strong');
    elements.stopButton.disabled = true;

    if (!state.imported || elements.runButton.disabled) {
      elements.taskState.textContent = '待扫码';
      elements.taskStateMetric.textContent = '待扫码';
      addLog('请导入有效名单后点击开始任务，届时会重新打开扫码窗口。');
      return;
    }

    addLog('正在重新打开扫码窗口...');
    await startTask();
  } catch (error) {
    addLog(error && error.message ? error.message : '重新扫码流程失败。', 'error');
  } finally {
    elements.resetWhatsAppButton.disabled = false;
  }
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
  const isPlanPage = ['planPage', 'usagePage', 'quotaPage', 'billingPage'].includes(pageId);
  elements.plansToggle.classList.toggle('active', isPlanPage);
  if (isPlanPage) setPlansExpanded(true);
  if (isPlanPage) refreshCloudEntitlementsIfStale().catch(() => {});
  if (pageId === 'historyPage') loadHistory();
  if (pageId === 'statisticsPage') loadStatistics();
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
  elements.fileMeta.textContent = `当前文件：${data.fileName}；电话列：${data.columns.phoneColumn || '未识别'}；国家列：${data.columns.countryColumn || '未识别'}`;
  elements.tableState.textContent = `已解析 ${data.rows.length} 行`;
  updateActionLocks();
}

async function refreshCurrentProgress() {
  if (!state.imported) return;
  const progress = await window.addWhatsapp.getCurrentProgress();
  state.imported.progress = progress;
  renderProgressSummary(progress);
}

async function exportReport() {
  if (!state.imported) return;
  const access = featureAccess('exportPreview');
  if (!access.ok) {
    elements.tableState.textContent = access.message;
    return;
  }
  elements.exportButton.disabled = true;
  const response = await window.addWhatsapp.exportReport(state.imported.rows);
  updateActionLocks();

  if (!response.canceled && response.filePath) {
    elements.tableState.textContent = '报表已导出';
  } else if (response.error) {
    elements.tableState.textContent = response.error;
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
    'auth:reset': event.message,
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
    'task:waiting': `等待 ${Math.ceil(Number(event.delayMs || 0) / 1000)} 秒后继续。`,
    'cloud:usage-synced': event.message,
    'cloud:usage-sync-failed': event.message,
    'cloud:workspace-lease-renew-failed': event.message,
    'cloud:workspace-lease-release-failed': event.message,
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
  if (event.type === 'auth:stale-session' || event.type === 'auth:reset') {
    elements.taskState.textContent = '登录异常';
    elements.taskStateMetric.textContent = '登录异常';
    elements.resetWhatsAppButton.disabled = false;
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
    updateActionLocks();
    elements.stopButton.disabled = true;
    refreshCurrentProgress();
  }
}

async function startTask() {
  if (state.taskStartInFlight) {
    addLog('任务正在启动，请稍候。');
    return;
  }
  if (!state.imported) {
    addLog('请先导入表格。', 'error');
    return;
  }
  const access = taskStartAccess();
  if (!access.ok) {
    addLog(access.message, 'error');
    updateActionLocks();
    return;
  }
  enforceDelayInputs();
  const minDelay = Number(elements.delayMinInput.value || 44);
  const maxDelay = Number(elements.delayMaxInput.value || minDelay);
  elements.taskState.textContent = '准备中';
  elements.taskStateMetric.textContent = '准备中';
  state.taskStartInFlight = true;
  elements.runButton.disabled = true;
  addLog('准备连接 WhatsApp。如果是第一次使用，请在弹出的浏览器里扫码。', 'strong');

  let started = false;
  try {
    const response = await window.addWhatsapp.startTask({
      maxPerDay: Number(elements.dailyLimitInput.value || (state.subscription && state.subscription.plan && state.subscription.plan.dailyLimit) || 80),
      delayMinSeconds: Math.max(44, minDelay),
      delayMaxSeconds: Math.max(Math.max(44, minDelay), maxDelay)
    });

    if (!response.started) {
      elements.taskState.textContent = '未开始';
      elements.taskStateMetric.textContent = '待机';
      addLog(response.error || '任务启动失败。', 'error');
      return;
    }

    started = true;
    elements.runButton.disabled = true;
    elements.stopButton.disabled = false;
  } catch (error) {
    elements.taskState.textContent = '未开始';
    elements.taskStateMetric.textContent = '待机';
    addLog(error.message || '任务启动失败。', 'error');
  } finally {
    state.taskStartInFlight = false;
    if (!started) updateActionLocks();
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

function enforceDelayInputs() {
  if (!elements.delayMinInput || !elements.delayMaxInput) return;
  elements.delayMinInput.min = '44';
  elements.delayMaxInput.min = '44';
  const minDelay = Math.max(44, Number(elements.delayMinInput.value || 44));
  const maxDelay = Math.max(minDelay, Number(elements.delayMaxInput.value || minDelay));
  elements.delayMinInput.value = String(minDelay);
  elements.delayMaxInput.value = String(maxDelay);
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
  updateTemplateAddButtons();
}

function currentTemplateLimit() {
  const plan = state.subscription && state.subscription.plan ? state.subscription.plan : {};
  return plan.templateLimit === null || plan.templateLimit === undefined ? null : Number(plan.templateLimit);
}

function limitTemplatesForCurrentPlan(templates) {
  const limit = currentTemplateLimit();
  if (limit === null) return templates;
  const capped = {};
  for (const language of ['en', 'es', 'fr']) {
    capped[language] = (templates[language] || []).slice(0, limit);
  }
  return capped;
}

function updateTemplateAddButtons() {
  const limit = currentTemplateLimit();
  for (const button of elements.templateAddButtons) {
    if (limit === null) {
      button.disabled = false;
      button.title = '';
      continue;
    }
    const language = button.dataset.templateAdd;
    const reached = templateInputs(language).length >= limit;
    button.disabled = reached;
    button.title = reached ? `当前套餐每种语言最多 ${limit} 条文案模板。` : '';
  }
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
  const limited = limitTemplatesForCurrentPlan(templates);
  state.templates = limited;
  renderTemplateList('en', limited.en);
  renderTemplateList('es', limited.es);
  renderTemplateList('fr', limited.fr);
  elements.templatePoolSummary.textContent = `EN ${limited.en.length} / ES ${limited.es.length} / FR ${limited.fr.length}`;
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
  const response = await window.addWhatsapp.saveTemplates({
    en: templateLines('en'),
    es: templateLines('es'),
    fr: templateLines('fr')
  });
  if (!response.ok) {
    elements.templateSaveState.textContent = response.error || '模板保存失败';
    addLog(response.error || '模板保存失败。', 'error');
    return;
  }
  renderTemplates(response.templates);
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

function percent(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total)) * 1000) / 10;
}

function renderActivityHeatmap(analytics, metric = state.statisticsMetric) {
  const daily = Array.isArray(analytics.daily) ? analytics.daily : [];
  const activity = analytics.activity[metric];
  const panel = elements.activityHeatmap.closest('.statistics-activity-panel');
  const processedMode = metric === 'processed';
  panel.classList.toggle('processed-mode', processedMode);
  elements.statisticsActivityTitle.textContent = processedMode ? '号码处理活跃度' : '成功发送活跃度';
  elements.statisticsActivityDescription.textContent = processedMode
    ? '蓝色越深，代表当天处理的号码总量越多，包含成功、未注册、失败和无效。'
    : '绿色越深，代表当天成功发送数量越多。悬停可查看当天明细。';
  elements.statisticsPeak.textContent = formatCredits(activity.peak);
  elements.statisticsPeakLabel.textContent = processedMode ? '单日最高处理' : '单日最高发送';
  elements.statisticsCurrentStreak.textContent = `${activity.currentStreak || 0} 天`;
  elements.statisticsLongestStreak.textContent = `${activity.longestStreak || 0} 天`;
  elements.statisticsActiveDays.textContent = `${activity.activeDays || 0} 天`;
  elements.activityHeatmap.innerHTML = '';
  elements.activityMonthLabels.innerHTML = '';
  if (!daily.length) return;

  const firstDate = new Date(`${daily[0].date}T00:00:00.000Z`);
  const startOffset = (firstDate.getUTCDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daily.length) / 7) * 7;
  const columns = Math.max(1, totalCells / 7);
  const maxValue = Math.max(0, ...daily.map(item => Number(item[metric] || 0)));
  elements.activityHeatmap.style.setProperty('--heatmap-columns', columns);
  elements.activityMonthLabels.style.setProperty('--heatmap-columns', columns);

  for (let index = 0; index < startOffset; index += 1) {
    const blank = document.createElement('span');
    blank.className = 'activity-cell blank';
    elements.activityHeatmap.appendChild(blank);
  }

  let previousMonth = '';
  for (const [index, item] of daily.entries()) {
    const value = Number(item[metric] || 0);
    const level = value > 0 && maxValue > 0 ? Math.max(1, Math.min(4, Math.ceil((value / maxValue) * 4))) : 0;
    const cell = document.createElement('span');
    cell.className = `activity-cell level-${level}`;
    cell.title = `${item.date}：成功 ${item.sent}，处理 ${item.processed}，未注册 ${item.unregistered}，失败 ${item.failed}`;
    cell.setAttribute('aria-label', cell.title);
    elements.activityHeatmap.appendChild(cell);

    const month = item.date.slice(0, 7);
    if (month !== previousMonth) {
      const monthLabel = document.createElement('span');
      const week = Math.floor((startOffset + index) / 7) + 1;
      monthLabel.style.gridColumn = `${week} / span 4`;
      monthLabel.textContent = `${Number(item.date.slice(5, 7))}月`;
      elements.activityMonthLabels.appendChild(monthLabel);
      previousMonth = month;
    }
  }

  for (let index = startOffset + daily.length; index < totalCells; index += 1) {
    const blank = document.createElement('span');
    blank.className = 'activity-cell blank';
    elements.activityHeatmap.appendChild(blank);
  }
  elements.activityHeatmap.setAttribute(
    'aria-label',
    `${analytics.range.startDate} 至 ${analytics.range.endDate}，累计活跃 ${analytics.summary.activeDays} 天`
  );
}

function renderStatisticsTrend(daily) {
  const recent = (Array.isArray(daily) ? daily : []).slice(-30);
  elements.statisticsTrend.innerHTML = '';
  const peak = Math.max(1, ...recent.flatMap(item => [
    Number(item.sent || 0),
    Number(item.failed || 0) + Number(item.unregistered || 0) + Number(item.invalid || 0)
  ]));
  for (const item of recent) {
    const anomalies = Number(item.failed || 0) + Number(item.unregistered || 0) + Number(item.invalid || 0);
    const group = document.createElement('div');
    group.className = 'statistics-trend-day';
    group.title = `${item.date}：成功 ${item.sent}，异常 ${anomalies}`;
    group.innerHTML = `
      <i class="sent" style="--bar-height:${Math.max(2, percent(item.sent, peak))}%"></i>
      <i class="anomaly" style="--bar-height:${Math.max(2, percent(anomalies, peak))}%"></i>
    `;
    elements.statisticsTrend.appendChild(group);
  }
}

function renderProgressRows(container, rows, maxValue) {
  container.innerHTML = '';
  if (!rows.length) {
    container.innerHTML = '<p class="statistics-empty">还没有可统计的数据。</p>';
    return;
  }
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'statistics-progress-row';
    item.innerHTML = `
      <span>${escapeHtml(row.label)}</span>
      <div><i class="${row.tone || ''}" style="width:${percent(row.value, maxValue)}%"></i></div>
      <strong>${formatCredits(row.value)}</strong>
    `;
    container.appendChild(item);
  }
}

function renderStatistics(analytics) {
  state.analytics = analytics;
  const summary = analytics.summary || {};
  setText('statisticsSent', formatCredits(summary.sent));
  elements.statisticsProcessedNote.textContent = `共处理 ${formatCredits(summary.processed)} 个号码`;
  elements.statisticsSuccessRate.textContent = `${Number(summary.successRate || 0).toFixed(1)}%`;
  setText('statisticsUnregistered', formatCredits(summary.unregistered));
  elements.statisticsUnregisteredNote.textContent = `占处理总量 ${percent(summary.unregistered, summary.processed).toFixed(1)}%`;
  setText('statisticsTasks', formatCredits(summary.completedTasks));

  renderActivityHeatmap(analytics);
  renderStatisticsTrend(analytics.daily);
  renderProgressRows(elements.statisticsOutcomes, [
    { label: '成功发送', value: summary.sent || 0 },
    { label: '未注册', value: summary.unregistered || 0, tone: 'warning' },
    { label: '发送失败', value: summary.failed || 0, tone: 'danger' },
    { label: '无效/重复', value: summary.invalid || 0, tone: 'info' }
  ], Math.max(1, summary.processed || 0));
  const languages = (analytics.languages || []).map(item => ({
    label: languageLabel(item.language),
    value: item.count
  }));
  renderProgressRows(
    elements.statisticsLanguages,
    languages,
    Math.max(1, ...languages.map(item => item.value))
  );

  elements.statisticsSources.innerHTML = '';
  if (!(analytics.sources || []).length) {
    elements.statisticsSources.innerHTML = '<tr class="empty-row"><td colspan="4">还没有可统计的任务记录。</td></tr>';
  } else {
    for (const source of analytics.sources) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td title="${escapeHtml(source.sourceFile)}">${escapeHtml(source.sourceFile)}</td>
        <td>${formatCredits(source.sent)}</td>
        <td>${formatCredits(source.anomalies)}</td>
        <td><strong class="${source.successRate < 80 ? 'statistics-rate-warning' : 'statistics-rate-good'}">${Number(source.successRate || 0).toFixed(1)}%</strong></td>
      `;
      elements.statisticsSources.appendChild(tr);
    }
  }
}

async function loadStatistics() {
  if (!state.auth.authenticated) return;
  try {
    renderStatistics(await window.addWhatsapp.getAnalytics({ days: state.statisticsDays }));
  } catch (error) {
    addLog(error.message || '数据统计加载失败。', 'error');
  }
}

function selectStatisticsDays(days) {
  state.statisticsDays = Number(days) || 365;
  for (const button of elements.statisticsDayButtons) {
    button.classList.toggle('active', Number(button.dataset.statisticsDays) === state.statisticsDays);
  }
  loadStatistics();
}

function selectStatisticsMetric(metric) {
  state.statisticsMetric = metric === 'processed' ? 'processed' : 'sent';
  for (const button of elements.statisticsMetricButtons) {
    button.classList.toggle('active', button.dataset.statisticsMetric === state.statisticsMetric);
  }
  if (state.analytics) renderActivityHeatmap(state.analytics);
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
  await refreshCloudEntitlementsIfStale({ force: true });
  await refreshBillingOrders({ quiet: true });
}

function updateStatusLabel(update = {}) {
  const labels = {
    idle: '已是最新版',
    development: '开发环境',
    unavailable: '当前工作台不可用',
    checking: '正在检查',
    available: '发现新版本',
    'waiting-for-idle': '等待任务结束',
    downloading: '正在下载',
    downloaded: '等待安装',
    installing: '正在安装',
    disabled: '更新已暂停',
    revoked: '版本已撤销',
    error: '更新异常',
    suspended: '更新已熔断'
  };
  return labels[update.status] || '等待检查';
}

function updateErrorLabel(update = {}) {
  const labels = {
    UPDATE_CHECK_FAILED: '无法连接更新服务器，将按退避策略自动重试。',
    UPDATE_DOWNLOAD_FAILED: '更新下载中断，旧版本可以继续使用。',
    UPDATE_INTEGRITY_FAILED: '更新包校验失败，损坏缓存已清除，不会安装。',
    UPDATE_DISK_FULL: '磁盘空间不足，更新未下载，旧版本可以继续使用。',
    UPDATE_CACHE_UNWRITABLE: '更新缓存目录不可写，请检查磁盘权限。',
    UPDATE_RUNTIME_ERROR: '更新器发生异常，旧版本可以继续使用。',
    UPDATE_REVOKED: '该更新已被撤销，不会安装。',
    UPDATE_DISABLED: '服务器已暂停本次更新。',
    UPDATE_VERSION_MISMATCH: '更新元数据版本不一致，已阻止安装。',
    UPDATE_POLICY_UNAVAILABLE: '无法确认更新策略，已保留当前版本。',
    UPDATE_NOT_MANDATORY: '服务器已取消强制安装，可继续使用当前版本。',
    WORKSPACES_BUSY: '其他工作台未能在 120 秒内安全退出，本次安装已取消。',
    UPDATE_INSTALL_FAILED: '安装器未能启动，当前版本未被替换。',
    UPDATE_INSTALL_SUSPENDED: '连续安装失败 3 次，已停止自动安装，请联系支持。',
    SECONDARY_WORKSPACE: '独立工作台不单独检查更新，请在主工作台操作。'
  };
  if (update.errorCode && labels[update.errorCode]) {
    const retryText = update.retryAt
      ? ` 下次重试：${new Date(update.retryAt).toLocaleString()}`
      : '';
    return `${labels[update.errorCode]}${retryText}`;
  }
  if (update.retryAt) return `下次重试：${new Date(update.retryAt).toLocaleString()}`;
  return update.unsigned
    ? '当前安装包暂未签名，Windows 可能显示“未知发布者”。'
    : '更新包由已验证发布者签名。';
}

function renderUpdateState(update = {}) {
  state.update = update;
  elements.currentVersionValue.textContent = update.currentVersion || '-';
  elements.targetVersionValue.textContent = update.targetVersion || '-';
  elements.updateStatusText.textContent = updateStatusLabel(update);
  elements.updateProgress.value = Math.max(0, Math.min(100, Number(update.percent || 0)));
  elements.updateErrorText.textContent = updateErrorLabel(update);
  elements.installUpdateButton.hidden = update.status !== 'downloaded';
  elements.installUpdateButton.disabled = update.status === 'installing';
  elements.checkUpdateButton.disabled = ['checking', 'downloading', 'installing'].includes(update.status);
  elements.updateNotesButton.disabled = !update.releaseNotesUrl;
  elements.updateNotesButton.dataset.url = update.releaseNotesUrl || '';
}

async function refreshUpdateState() {
  if (typeof window.addWhatsapp.getUpdateState !== 'function') {
    renderUpdateState({
      status: 'unavailable',
      currentVersion: '-',
      targetVersion: null,
      percent: 0,
      unsigned: true
    });
    return;
  }
  renderUpdateState(await window.addWhatsapp.getUpdateState());
}

async function checkForUpdates() {
  if (typeof window.addWhatsapp.checkForUpdates !== 'function') return;
  elements.checkUpdateButton.disabled = true;
  const result = await window.addWhatsapp.checkForUpdates();
  if (result && result.errorCode === 'UPDATES_UNAVAILABLE') {
    elements.updateErrorText.textContent = '当前运行方式不支持自动更新，请使用主工作台安装版。';
  }
  await refreshUpdateState();
}

async function installPendingUpdate() {
  if (typeof window.addWhatsapp.installPendingUpdate !== 'function') return;
  elements.installUpdateButton.disabled = true;
  const result = await window.addWhatsapp.installPendingUpdate();
  if (!result || !result.ok) {
    await refreshUpdateState();
  }
}

async function bootstrapApp() {
  await refreshUpdateState();
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

function showPaymentSuccessModal(detail = '支付成功，套餐和额度已同步。') {
  if (!elements.paymentSuccessModal) return;
  elements.paymentSuccessModal.hidden = false;
  if (elements.paymentSuccessDetail) elements.paymentSuccessDetail.textContent = detail;
  if (elements.paymentSuccessConfirmButton) elements.paymentSuccessConfirmButton.focus();
}

function hidePaymentSuccessModal() {
  if (elements.paymentSuccessModal) elements.paymentSuccessModal.hidden = true;
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
elements.refreshEntitlementsButton.addEventListener('click', refreshCloudEntitlements);
elements.quotaPayButton.addEventListener('click', () => startWechatTopUp(null, elements.quotaPayButton, { credits: state.selectedQuotaCredits }));
elements.billingPayButton.addEventListener('click', () => startWechatTopUp());
for (const button of elements.quotaCreditButtons) {
  button.addEventListener('click', () => selectQuotaCredits(button));
}
if (elements.quotaCustomCreditsInput) {
  elements.quotaCustomCreditsInput.addEventListener('input', handleCustomQuotaInput);
}
if (elements.paymentCancelButton) {
  elements.paymentCancelButton.addEventListener('click', () => closeActivePayment('canceled'));
}
if (elements.paymentRetryButton) {
  elements.paymentRetryButton.addEventListener('click', () => {
    const activePayment = state.activePayment || {};
    const planId = elements.paymentRetryButton.dataset.planId || activePayment.planId;
    const paymentContext = activePayment.context || elements.paymentRetryButton.dataset.paymentContext;
    const credits = Number(activePayment.credits || elements.paymentRetryButton.dataset.credits || 0);
    const retryOptions = paymentContext === 'quota' && credits
      ? { credits }
      : {};
    clearPaymentTimers();
    state.activePayment = null;
    setPaymentControls({ canCancel: false, canRetry: false });
    startWechatTopUp(planId || null, elements.paymentRetryButton, retryOptions);
  });
}
if (elements.paymentSuccessConfirmButton) {
  elements.paymentSuccessConfirmButton.addEventListener('click', hidePaymentSuccessModal);
}
if (elements.paymentOpenButton) {
  elements.paymentOpenButton.addEventListener('click', async () => {
    const url = elements.paymentOpenButton.dataset.paymentUrl;
    if (!url) return;
    const result = await window.addWhatsapp.openExternalUrl(url);
    elements.syncState.textContent = result && result.ok ? '已再次请求打开微信支付链接。' : '打开失败，请复制链接处理。';
  });
}
if (elements.paymentCopyButton) {
  elements.paymentCopyButton.addEventListener('click', () => {
    const url = elements.paymentCopyButton.dataset.paymentUrl;
    if (!url) return;
    window.addWhatsapp.copyText(url);
    elements.syncState.textContent = '支付链接已复制。';
  });
}
elements.importButton.addEventListener('click', importContacts);
elements.dropImportButton.addEventListener('click', importContacts);
elements.exportButton.addEventListener('click', exportReport);
elements.runButton.addEventListener('click', startTask);
elements.resetWhatsAppButton.addEventListener('click', resetWhatsAppLoginFromTask);
elements.stopButton.addEventListener('click', stopTask);
elements.saveTemplatesButton.addEventListener('click', saveTemplates);
elements.refreshHistoryButton.addEventListener('click', loadHistory);
for (const button of elements.statisticsDayButtons) {
  button.addEventListener('click', () => selectStatisticsDays(button.dataset.statisticsDays));
}
for (const button of elements.statisticsMetricButtons) {
  button.addEventListener('click', () => selectStatisticsMetric(button.dataset.statisticsMetric));
}
elements.closeMinimizeButton.addEventListener('click', () => handleCloseChoice('minimize'));
elements.closeQuitButton.addEventListener('click', () => handleCloseChoice('quit'));
elements.closeCancelButton.addEventListener('click', () => handleCloseChoice('cancel'));
elements.openWorkspaceButton.addEventListener('click', showWorkspaceRiskModal);
elements.proxySettingsButton.addEventListener('click', showProxySettings);
elements.logoutButton.addEventListener('click', logoutAccount);
elements.clearWhatsAppButton.addEventListener('click', clearWhatsAppSession);
elements.checkUpdateButton.addEventListener('click', checkForUpdates);
elements.installUpdateButton.addEventListener('click', installPendingUpdate);
elements.updateNotesButton.addEventListener('click', async () => {
  const url = elements.updateNotesButton.dataset.url;
  if (url) await window.addWhatsapp.openExternalUrl(url);
});
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
if (elements.paymentSuccessModal) {
  elements.paymentSuccessModal.addEventListener('click', event => {
    if (event.target === elements.paymentSuccessModal) hidePaymentSuccessModal();
  });
}
elements.closeModal.addEventListener('click', event => {
  if (event.target === elements.closeModal) handleCloseChoice('cancel');
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && elements.paymentSuccessModal && !elements.paymentSuccessModal.hidden) hidePaymentSuccessModal();
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
    const limit = currentTemplateLimit();
    if (limit !== null && templateInputs(language).length >= limit) {
      elements.templateSaveState.textContent = `当前套餐每种语言最多 ${limit} 条文案模板`;
      updateTemplateAddButtons();
      return;
    }
    const list = templateListElement(language);
    list.appendChild(createTemplateItem(language, '', list.children.length));
    markTemplatesDirty();
  });
}

window.addWhatsapp.onTaskEvent(handleTaskEvent);
window.addWhatsapp.onHistoryUpdated(items => {
  renderHistory(items);
  const statisticsPage = document.getElementById('statisticsPage');
  if (statisticsPage && statisticsPage.classList.contains('active-page')) loadStatistics();
});
window.addWhatsapp.onShowCloseChoice(showCloseModal);
window.addWhatsapp.onAuthChanged(auth => {
  applyAuthState(auth);
  refreshCloudEntitlementsIfStale({ force: true }).catch(() => {});
});
if (typeof window.addWhatsapp.onUpdateStateChanged === 'function') {
  window.addWhatsapp.onUpdateStateChanged(renderUpdateState);
}
window.addEventListener('focus', () => {
  refreshCloudEntitlementsIfStale().catch(() => {});
});
loadImportOptions();
elements.skipChinaNumbersToggle.addEventListener('change', saveImportOptions);
bootstrapApp();
