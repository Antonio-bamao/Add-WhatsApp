const DAY_MS = 24 * 60 * 60 * 1000;
const PLANS = [
  {
    id: 'free',
    name: '免费版',
    audience: '适合测试/适用阶段',
    unitPriceCents: 0,
    cardTier: 'FREE',
    cardTone: 'silver',
    minimumTopUpCredits: 0,
    dailyLimit: 10,
    workspaceLimit: 1,
    templateLimit: 1,
    capabilities: {
      importPreview: true,
      exportPreview: false,
      sendTask: true,
      historyReports: true,
      crossDeviceSync: true,
      secondaryWorkspace: false,
      proxySettings: false,
      customTemplates: true,
      onlinePayment: false,
      workspaceExpansionReview: false
    },
    features: ['表格预检详情', '默认文案模板', '历史报表实时监控添加进度', '跨设备同步']
  },
  {
    id: 'advanced',
    name: '进阶版',
    audience: '适合频繁业务沟通的用户',
    unitPriceCents: 40,
    cardTier: 'PLUS',
    cardTone: 'gold',
    minimumTopUpCredits: 2000,
    dailyLimit: 200,
    workspaceLimit: 2,
    templateLimit: 2,
    capabilities: {
      importPreview: true,
      exportPreview: true,
      sendTask: true,
      historyReports: true,
      crossDeviceSync: true,
      secondaryWorkspace: true,
      proxySettings: true,
      customTemplates: true,
      onlinePayment: true,
      workspaceExpansionReview: false
    },
    features: ['包含免费版的全部功能', '导出预检', '新建工作台多账号添加 X2', '代理 IP 设置', '自定义文案模板 X2']
  },
  {
    id: 'professional',
    name: '专业版',
    audience: '适合复杂且重度场景应用',
    unitPriceCents: 30,
    cardTier: 'PRO',
    cardTone: 'gold',
    minimumTopUpCredits: 5000,
    dailyLimit: 500,
    workspaceLimit: 3,
    templateLimit: 4,
    recommended: true,
    capabilities: {
      importPreview: true,
      exportPreview: true,
      sendTask: true,
      historyReports: true,
      crossDeviceSync: true,
      secondaryWorkspace: true,
      proxySettings: true,
      customTemplates: true,
      onlinePayment: true,
      workspaceExpansionReview: false
    },
    features: ['包含进阶版的全部功能', '新建工作台多账号添加 X3', '自定义文案模板 X4']
  },
  {
    id: 'business',
    name: '商业版',
    audience: '适合最屌最顶级的外贸高手',
    unitPriceCents: 20,
    cardTier: 'ULTRA',
    cardTone: 'gold',
    minimumTopUpCredits: 20000,
    dailyLimit: 1000,
    workspaceLimit: 5,
    templateLimit: null,
    capabilities: {
      importPreview: true,
      exportPreview: true,
      sendTask: true,
      historyReports: true,
      crossDeviceSync: true,
      secondaryWorkspace: true,
      proxySettings: true,
      customTemplates: true,
      onlinePayment: true,
      workspaceExpansionReview: true
    },
    features: ['包含专业版的全部功能', '默认支持 5 个工作台，可申请扩容', '自定义文案模板不限']
  }
];

const DEFAULT_PLAN_ID = 'advanced';

function clonePlan(plan) {
  return {
    ...plan,
    capabilities: { ...(plan.capabilities || {}) },
    features: [...plan.features]
  };
}

function planCatalog() {
  return PLANS.map(clonePlan);
}

function getPlan(planId = DEFAULT_PLAN_ID) {
  const plan = PLANS.find(item => item.id === planId) || PLANS.find(item => item.id === DEFAULT_PLAN_ID);
  return clonePlan(plan);
}

function nextLocalMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.toISOString();
}

function createEntitlementState(planId = DEFAULT_PLAN_ID, usage = {}) {
  const plan = getPlan(planId);
  const usedToday = Math.max(0, Number(usage.usedToday || 0));
  const usedThisMonth = Math.max(0, Number(usage.usedThisMonth || 0));
  const balanceCredits = Math.max(0, Number(usage.balanceCredits || 0));
  const dailyRemaining = Math.max(0, plan.dailyLimit - usedToday);
  const availableNow = plan.unitPriceCents > 0 ? Math.min(balanceCredits, dailyRemaining) : dailyRemaining;
  const monthlyLimit = Math.max(plan.dailyLimit, Number(usage.monthlyLimit || plan.dailyLimit * 30));
  return {
    plan,
    capabilities: { ...plan.capabilities },
    balanceCredits,
    usedToday,
    usedThisMonth,
    monthlyLimit,
    dailyRemaining,
    availableNow,
    nextResetAt: usage.nextResetAt || nextLocalMidnight(usage.now || new Date()),
    resetPolicy: '每日上限按本机账号时区 00:00 重置，未使用账户余额长期保留。'
  };
}

function planFrom(value) {
  if (value && value.plan) return value.plan;
  if (value && value.id) return value;
  return getPlan();
}

function effectiveCapabilitiesFor(entitlementOrPlan) {
  const plan = planFrom(entitlementOrPlan);
  if (entitlementOrPlan && entitlementOrPlan.effectiveCapabilities) {
    return { ...entitlementOrPlan.effectiveCapabilities };
  }
  return { ...(plan.capabilities || {}) };
}

function effectiveTemplateLimitFor(entitlementOrPlan) {
  const plan = planFrom(entitlementOrPlan);
  if (entitlementOrPlan && Object.prototype.hasOwnProperty.call(entitlementOrPlan, 'effectiveTemplateLimit')) {
    return entitlementOrPlan.effectiveTemplateLimit;
  }
  return plan.templateLimit;
}

function effectiveWorkspaceLimitFor(entitlementOrPlan) {
  const plan = planFrom(entitlementOrPlan);
  if (entitlementOrPlan && Object.prototype.hasOwnProperty.call(entitlementOrPlan, 'effectiveWorkspaceLimit')) {
    return Number(entitlementOrPlan.effectiveWorkspaceLimit);
  }
  return Number(plan.workspaceLimit);
}

function isFreeAccessEntitlement(entitlement) {
  return Boolean(
    entitlement
    && (
      entitlement.unlimitedDailyUsage
      || entitlement.billingMode === 'free_access'
      || (entitlement.billingPolicy && entitlement.billingPolicy.mode === 'free_access')
    )
  );
}

function resolveFeatureAccess(entitlementOrPlan, feature) {
  const plan = planFrom(entitlementOrPlan);
  const capabilities = effectiveCapabilitiesFor(entitlementOrPlan);
  if (capabilities && capabilities[feature]) return { ok: true };
  const labels = {
    exportPreview: '导出预检属于进阶版及以上功能',
    secondaryWorkspace: '新建工作台属于进阶版及以上功能',
    proxySettings: '代理 IP 设置属于进阶版及以上功能',
    customTemplates: '自定义文案模板属于当前套餐可用功能'
  };
  return {
    ok: false,
    reason: 'PLAN_LOCKED',
    message: `${labels[feature] || '该功能'}，当前${plan.name}不可用。`
  };
}

function resolveTaskStartAccess(entitlement) {
  const state = entitlement && entitlement.plan ? entitlement : createEntitlementState();
  if (isFreeAccessEntitlement(state)) return { ok: true };
  const plan = state.plan;
  const dailyRemaining = Math.max(0, Number(state.dailyRemaining || 0));
  const availableNow = Math.max(0, Number(state.availableNow || 0));
  const balanceCredits = Math.max(0, Number(state.balanceCredits || 0));
  if (plan.unitPriceCents > 0 && balanceCredits <= 0) {
    return {
      ok: false,
      reason: 'NO_BALANCE',
      message: `当前${plan.name}账户余额为 0，不能开始新的成功添加任务。请联系开通或等待人工充值。`
    };
  }
  if (dailyRemaining <= 0 || availableNow <= 0) {
    return {
      ok: false,
      reason: 'DAILY_LIMIT_REACHED',
      message: `当前${plan.name}今日可用上限已用完，请等服务器 00:00 重置后继续。`
    };
  }
  return { ok: true };
}

function resolveTemplateAccess(entitlementOrPlan, { languageCounts = null, customCount = 0 } = {}) {
  const plan = planFrom(entitlementOrPlan);
  const limit = effectiveTemplateLimitFor(entitlementOrPlan);
  if (limit === null || limit === undefined) return { ok: true, remaining: null };
  const counts = languageCounts && typeof languageCounts === 'object'
    ? Object.values(languageCounts).map(value => Math.max(0, Number(value) || 0))
    : [Math.max(0, Number(customCount) || 0)];
  const count = Math.max(...counts);
  const remaining = Math.max(0, limit - count);
  if (count <= limit) return { ok: true, remaining };
  return {
    ok: false,
    remaining: 0,
    reason: 'TEMPLATE_LIMIT_REACHED',
    message: `当前${plan.name}每种语言最多保存 ${limit} 条文案模板，请删除多余文案或升级套餐。`
  };
}

function resolveTaskDailyLimit(entitlement, requestedLimit) {
  const plan = entitlement && entitlement.plan ? entitlement.plan : getPlan();
  const requested = Number(requestedLimit || 0);
  if (isFreeAccessEntitlement(entitlement) && Number.isFinite(requested) && requested > 0) {
    return Math.max(1, Math.floor(requested));
  }
  if (!Number.isFinite(requested) || requested <= 0) return plan.dailyLimit;
  return Math.min(Math.max(1, Math.floor(requested)), plan.dailyLimit);
}

function canOpenSecondaryWorkspace(entitlement, openSecondaryCount = 0) {
  const plan = entitlement && entitlement.plan ? entitlement.plan : getPlan();
  const access = resolveFeatureAccess(entitlement || plan, 'secondaryWorkspace');
  if (!access.ok) return { ok: false, remaining: 0, error: access.message };
  const workspaceLimit = Math.max(1, effectiveWorkspaceLimitFor(entitlement || plan) || 1);
  const allowedSecondary = Math.max(0, workspaceLimit - 1);
  const remaining = Math.max(0, allowedSecondary - openSecondaryCount);
  if (remaining <= 0) {
    return {
      ok: false,
      remaining: 0,
      error: `当前${plan.name}最多同时使用 ${workspaceLimit} 个工作台，请关闭已有独立工作台或升级套餐。`
    };
  }
  return { ok: true, remaining };
}

function usagePercent(used, limit) {
  if (!limit) return 0;
  return Math.min(100, Math.round((Math.max(0, used) / limit) * 100));
}

function usageSummary(entitlement) {
  const plan = entitlement && entitlement.plan ? entitlement.plan : getPlan();
  const usedToday = Math.max(0, Number(entitlement && entitlement.usedToday || 0));
  const usedThisMonth = Math.max(0, Number(entitlement && entitlement.usedThisMonth || 0));
  const monthLimit = Math.max(plan.dailyLimit, Number(entitlement && entitlement.monthlyLimit || plan.dailyLimit * 30));
  return {
    today: {
      used: usedToday,
      limit: plan.dailyLimit,
      remaining: Math.max(0, plan.dailyLimit - usedToday),
      percent: usagePercent(usedToday, plan.dailyLimit)
    },
    month: {
      used: usedThisMonth,
      limit: monthLimit,
      remaining: Math.max(0, monthLimit - usedThisMonth),
      percent: usagePercent(usedThisMonth, monthLimit)
    }
  };
}

module.exports = {
  DEFAULT_PLAN_ID,
  DAY_MS,
  canOpenSecondaryWorkspace,
  createEntitlementState,
  effectiveCapabilitiesFor,
  effectiveTemplateLimitFor,
  effectiveWorkspaceLimitFor,
  getPlan,
  planCatalog,
  resolveFeatureAccess,
  resolveTaskDailyLimit,
  resolveTaskStartAccess,
  resolveTemplateAccess,
  usageSummary
};
