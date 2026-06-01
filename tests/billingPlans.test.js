const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canOpenSecondaryWorkspace,
  createEntitlementState,
  getPlan,
  planCatalog,
  resolveFeatureAccess,
  resolveTaskStartAccess,
  resolveTaskDailyLimit,
  resolveTemplateAccess,
  usageSummary
} = require('../src/core/billingPlans');

test('defines the public pricing catalog from the approved package design', () => {
  const plans = planCatalog();

  assert.deepEqual(plans.map(plan => plan.id), ['free', 'advanced', 'professional', 'business']);
  assert.equal(getPlan('free').dailyLimit, 10);
  assert.equal(getPlan('free').cardTier, 'FREE');
  assert.equal(getPlan('free').cardTone, 'silver');
  assert.equal(getPlan('free').templateLimit, 1);
  assert.equal(getPlan('advanced').unitPriceCents, 40);
  assert.equal(getPlan('advanced').cardTier, 'PLUS');
  assert.equal(getPlan('advanced').cardTone, 'gold');
  assert.equal(getPlan('advanced').minimumTopUpCredits, 2000);
  assert.equal(getPlan('advanced').dailyLimit, 200);
  assert.equal(getPlan('advanced').workspaceLimit, 2);
  assert.equal(getPlan('professional').unitPriceCents, 30);
  assert.equal(getPlan('professional').cardTier, 'PRO');
  assert.equal(getPlan('professional').cardTone, 'gold');
  assert.equal(getPlan('professional').minimumTopUpCredits, 5000);
  assert.equal(getPlan('professional').dailyLimit, 500);
  assert.equal(getPlan('professional').workspaceLimit, 3);
  assert.equal(getPlan('business').unitPriceCents, 20);
  assert.equal(getPlan('business').cardTier, 'ULTRA');
  assert.equal(getPlan('business').cardTone, 'gold');
  assert.equal(getPlan('business').minimumTopUpCredits, 20000);
  assert.equal(getPlan('business').dailyLimit, 1000);
  assert.equal(getPlan('business').workspaceLimit, 5);
  assert.equal(getPlan('business').templateLimit, null);
});

test('exposes package capability boundaries for lockable desktop features', () => {
  const free = getPlan('free');
  const advanced = getPlan('advanced');
  const business = getPlan('business');

  assert.equal(free.capabilities.exportPreview, false);
  assert.equal(free.capabilities.secondaryWorkspace, false);
  assert.equal(free.capabilities.proxySettings, false);
  assert.equal(free.capabilities.onlinePayment, false);
  assert.equal(advanced.capabilities.exportPreview, true);
  assert.equal(advanced.capabilities.secondaryWorkspace, true);
  assert.equal(advanced.capabilities.proxySettings, true);
  assert.equal(advanced.capabilities.onlinePayment, true);
  assert.equal(business.capabilities.workspaceExpansionReview, true);
});

test('keeps account balance separate from daily throttling limits', () => {
  const entitlement = createEntitlementState('professional', {
    balanceCredits: 420,
    usedToday: 120
  });

  assert.equal(entitlement.balanceCredits, 420);
  assert.equal(entitlement.usedToday, 120);
  assert.equal(entitlement.dailyRemaining, 380);
  assert.equal(entitlement.availableNow, 380);
});

test('caps requested task limits by the active package daily limit', () => {
  const advanced = createEntitlementState('advanced');

  assert.equal(resolveTaskDailyLimit(advanced, 80), 80);
  assert.equal(resolveTaskDailyLimit(advanced, 500), 200);
  assert.equal(resolveTaskDailyLimit(advanced, 0), 200);
});

test('blocks paid tasks when there is no balance or daily allowance', () => {
  const noBalance = createEntitlementState('advanced', {
    balanceCredits: 0,
    usedToday: 0
  });
  const dailyUsed = createEntitlementState('professional', {
    balanceCredits: 100,
    usedToday: 500
  });
  const free = createEntitlementState('free', {
    balanceCredits: 0,
    usedToday: 9
  });

  assert.deepEqual(resolveTaskStartAccess(noBalance), {
    ok: false,
    reason: 'NO_BALANCE',
    message: '当前进阶版账户余额为 0，不能开始新的成功添加任务。请联系开通或等待人工充值。'
  });
  assert.deepEqual(resolveTaskStartAccess(dailyUsed), {
    ok: false,
    reason: 'DAILY_LIMIT_REACHED',
    message: '当前专业版今日可用上限已用完，请等服务器 00:00 重置后继续。'
  });
  assert.deepEqual(resolveTaskStartAccess(free), { ok: true });
});

test('returns clear locked messages for features outside the active package', () => {
  const free = createEntitlementState('free');
  const advanced = createEntitlementState('advanced');

  assert.deepEqual(resolveFeatureAccess(free, 'exportPreview'), {
    ok: false,
    reason: 'PLAN_LOCKED',
    message: '导出预检属于进阶版及以上功能，当前免费版不可用。'
  });
  assert.deepEqual(resolveFeatureAccess(advanced, 'exportPreview'), { ok: true });
  assert.deepEqual(resolveFeatureAccess(advanced, 'onlinePayment'), { ok: true });
});

test('limits each language template pool by package', () => {
  const advanced = createEntitlementState('advanced');
  const business = createEntitlementState('business');

  assert.deepEqual(resolveTemplateAccess(advanced, { languageCounts: { en: 2, es: 1, fr: 2 } }), { ok: true, remaining: 0 });
  assert.deepEqual(resolveTemplateAccess(advanced, { languageCounts: { en: 3, es: 1, fr: 2 } }), {
    ok: false,
    remaining: 0,
    reason: 'TEMPLATE_LIMIT_REACHED',
    message: '当前进阶版每种语言最多保存 2 条文案模板，请删除多余文案或升级套餐。'
  });
  assert.deepEqual(resolveTemplateAccess(business, { languageCounts: { en: 100, es: 100, fr: 100 } }), { ok: true, remaining: null });
});

test('limits secondary workspace launches by the active package', () => {
  const advanced = createEntitlementState('advanced');

  assert.deepEqual(canOpenSecondaryWorkspace(advanced, 0), { ok: true, remaining: 1 });
  assert.deepEqual(canOpenSecondaryWorkspace(advanced, 1), {
    ok: false,
    remaining: 0,
    error: '当前进阶版最多同时使用 2 个工作台，请关闭已有独立工作台或升级套餐。'
  });
});

test('summarizes daily and monthly usage for the usage dashboard', () => {
  const entitlement = createEntitlementState('advanced', {
    balanceCredits: 1880,
    usedToday: 45,
    usedThisMonth: 730,
    monthlyLimit: 6000,
    now: new Date('2026-05-21T08:30:00+08:00')
  });

  assert.deepEqual(usageSummary(entitlement), {
    today: {
      used: 45,
      limit: 200,
      remaining: 155,
      percent: 23
    },
    month: {
      used: 730,
      limit: 6000,
      remaining: 5270,
      percent: 12
    }
  });
});
