const DAY_MS = 24 * 60 * 60 * 1000;

const PLANS = [
  {
    id: 'free',
    name: '免费版',
    audience: '适合测试/适用阶段',
    unitPriceCents: 0,
    minimumTopUpCredits: 0,
    dailyLimit: 10,
    workspaceLimit: 1,
    templateLimit: 3,
    features: ['表格预检详情', '默认文案模板', '历史报表实时监控添加进度', '跨设备同步']
  },
  {
    id: 'advanced',
    name: '进阶版',
    audience: '适合频繁业务沟通的用户',
    unitPriceCents: 30,
    minimumTopUpCredits: 2000,
    dailyLimit: 200,
    workspaceLimit: 2,
    templateLimit: 2,
    features: ['包含免费版的全部功能', '导出预检', '新建工作台多账号添加 X2', '代理 IP 设置', '自定义文案模板 X2']
  },
  {
    id: 'professional',
    name: '专业版',
    audience: '适合复杂且重度场景应用',
    unitPriceCents: 20,
    minimumTopUpCredits: 5000,
    dailyLimit: 500,
    workspaceLimit: 3,
    templateLimit: 4,
    recommended: true,
    features: ['包含进阶版的全部功能', '新建工作台多账号添加 X3', '自定义文案模板 X4']
  },
  {
    id: 'business',
    name: '商业版',
    audience: '适合最屌最顶级的外贸高手',
    unitPriceCents: 10,
    minimumTopUpCredits: 20000,
    dailyLimit: 1000,
    workspaceLimit: 5,
    templateLimit: null,
    features: ['包含专业版的全部功能', '默认支持 5 个工作台，可申请扩容', '自定义文案模板不限']
  }
];

const DEFAULT_PLAN_ID = 'advanced';

function planCatalog() {
  return PLANS.map(plan => ({ ...plan, features: [...plan.features] }));
}

function getPlan(planId = DEFAULT_PLAN_ID) {
  const plan = PLANS.find(item => item.id === planId) || PLANS.find(item => item.id === DEFAULT_PLAN_ID);
  return { ...plan, features: [...plan.features] };
}

function nextLocalMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.toISOString();
}

function createEntitlementState(planId = DEFAULT_PLAN_ID, usage = {}) {
  const plan = getPlan(planId);
  const usedToday = Math.max(0, Number(usage.usedToday || 0));
  const balanceCredits = Math.max(0, Number(usage.balanceCredits || 0));
  const dailyRemaining = Math.max(0, plan.dailyLimit - usedToday);
  const availableNow = plan.unitPriceCents > 0 ? Math.min(balanceCredits, dailyRemaining) : dailyRemaining;
  return {
    plan,
    balanceCredits,
    usedToday,
    dailyRemaining,
    availableNow,
    nextResetAt: usage.nextResetAt || nextLocalMidnight(usage.now || new Date()),
    resetPolicy: '每日上限按本机账号时区 00:00 重置，未使用账户余额长期保留。'
  };
}

function resolveTaskDailyLimit(entitlement, requestedLimit) {
  const plan = entitlement && entitlement.plan ? entitlement.plan : getPlan();
  const requested = Number(requestedLimit || 0);
  if (!Number.isFinite(requested) || requested <= 0) return plan.dailyLimit;
  return Math.min(Math.max(1, Math.floor(requested)), plan.dailyLimit);
}

function canOpenSecondaryWorkspace(entitlement, openSecondaryCount = 0) {
  const plan = entitlement && entitlement.plan ? entitlement.plan : getPlan();
  const allowedSecondary = Math.max(0, plan.workspaceLimit - 1);
  const remaining = Math.max(0, allowedSecondary - openSecondaryCount);
  if (remaining <= 0) {
    return {
      ok: false,
      remaining: 0,
      error: `当前${plan.name}最多同时使用 ${plan.workspaceLimit} 个工作台，请关闭已有独立工作台或升级套餐。`
    };
  }
  return { ok: true, remaining };
}

module.exports = {
  DEFAULT_PLAN_ID,
  DAY_MS,
  canOpenSecondaryWorkspace,
  createEntitlementState,
  getPlan,
  planCatalog,
  resolveTaskDailyLimit
};
