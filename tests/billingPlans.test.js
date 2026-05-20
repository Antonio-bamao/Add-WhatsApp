const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canOpenSecondaryWorkspace,
  createEntitlementState,
  getPlan,
  planCatalog,
  resolveTaskDailyLimit,
  usageSummary
} = require('../src/core/billingPlans');

test('defines the public pricing catalog from the approved package design', () => {
  const plans = planCatalog();

  assert.deepEqual(plans.map(plan => plan.id), ['free', 'advanced', 'professional', 'business']);
  assert.equal(getPlan('free').dailyLimit, 10);
  assert.equal(getPlan('free').cardTier, 'FREE');
  assert.equal(getPlan('free').cardTone, 'silver');
  assert.equal(getPlan('advanced').unitPriceCents, 30);
  assert.equal(getPlan('advanced').cardTier, 'PLUS');
  assert.equal(getPlan('advanced').cardTone, 'gold');
  assert.equal(getPlan('advanced').minimumTopUpCredits, 2000);
  assert.equal(getPlan('advanced').dailyLimit, 200);
  assert.equal(getPlan('advanced').workspaceLimit, 2);
  assert.equal(getPlan('professional').unitPriceCents, 20);
  assert.equal(getPlan('professional').cardTier, 'PRO');
  assert.equal(getPlan('professional').cardTone, 'gold');
  assert.equal(getPlan('professional').minimumTopUpCredits, 5000);
  assert.equal(getPlan('professional').dailyLimit, 500);
  assert.equal(getPlan('professional').workspaceLimit, 3);
  assert.equal(getPlan('business').unitPriceCents, 10);
  assert.equal(getPlan('business').cardTier, 'ULTRA');
  assert.equal(getPlan('business').cardTone, 'gold');
  assert.equal(getPlan('business').minimumTopUpCredits, 20000);
  assert.equal(getPlan('business').dailyLimit, 1000);
  assert.equal(getPlan('business').workspaceLimit, 5);
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
