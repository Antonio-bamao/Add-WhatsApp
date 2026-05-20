const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canOpenSecondaryWorkspace,
  createEntitlementState,
  getPlan,
  planCatalog,
  resolveTaskDailyLimit
} = require('../src/core/billingPlans');

test('defines the public pricing catalog from the approved package design', () => {
  const plans = planCatalog();

  assert.deepEqual(plans.map(plan => plan.id), ['free', 'advanced', 'professional', 'business']);
  assert.equal(getPlan('free').dailyLimit, 10);
  assert.equal(getPlan('advanced').unitPriceCents, 30);
  assert.equal(getPlan('advanced').minimumTopUpCredits, 2000);
  assert.equal(getPlan('advanced').dailyLimit, 200);
  assert.equal(getPlan('advanced').workspaceLimit, 2);
  assert.equal(getPlan('professional').unitPriceCents, 20);
  assert.equal(getPlan('professional').minimumTopUpCredits, 5000);
  assert.equal(getPlan('professional').dailyLimit, 500);
  assert.equal(getPlan('professional').workspaceLimit, 3);
  assert.equal(getPlan('business').unitPriceCents, 10);
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
