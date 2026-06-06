const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createEntitlementState, planCatalog } = require('../src/core/billingPlans');

test('only upgrade paid plan cards start WeChat top-up with the selected package', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const calls = [];
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 0, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert() {},
    console,
    document,
    localStorage: createFakeStorage(),
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        startWechatTopUp: async (payload) => {
          calls.push(payload);
          return {
            ok: false,
            error: 'TEST_STOP'
          };
        },
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  const freeButton = document.querySelector('[data-plan-pay="free"]');
  const currentButton = document.querySelector('[data-plan-pay="advanced"]');
  const professionalButton = document.querySelector('[data-plan-pay="professional"]');
  const businessButton = document.querySelector('[data-plan-pay="business"]');
  assert.ok(freeButton, 'free plan payment button should render');
  assert.ok(currentButton, 'current plan payment button should render');
  assert.ok(professionalButton, 'professional plan payment button should render');
  assert.ok(businessButton, 'business plan payment button should render');
  assert.match(
    document.getElementById('planCards').children.map(card => card.innerHTML).join('\n'),
    /专业版[\s\S]*¥0\.30/
  );
  assert.equal(freeButton.disabled, true);
  assert.equal(currentButton.disabled, true);
  assert.equal(professionalButton.disabled, false);
  assert.equal(businessButton.disabled, false);

  professionalButton.click();
  await flushAsync();
  businessButton.click();
  await flushAsync();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].planId, 'professional');
  assert.equal(calls[1].planId, 'business');
});

test('prevents duplicate WeChat top-up requests while an order is still generating', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  let resolveTopUp;
  const calls = [];
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 0, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert() {},
    console,
    document,
    localStorage: createFakeStorage(),
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        startWechatTopUp: async (payload) => {
          calls.push(payload);
          return new Promise(resolve => {
            resolveTopUp = resolve;
          });
        },
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  const professionalButton = document.querySelector('[data-plan-pay="professional"]');
  const businessButton = document.querySelector('[data-plan-pay="business"]');
  professionalButton.click();
  businessButton.click();
  await flushAsync();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].planId, 'professional');
  assert.equal(businessButton.disabled, true);

  resolveTopUp({ ok: false, error: 'TEST_STOP' });
  await flushAsync();
});

test('blocks lower package purchases and sends quota top-ups with the current plan price', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const calls = [];
  const subscription = {
    ...createEntitlementState('business', { balanceCredits: 5000, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert() {},
    console,
    document,
    localStorage: createFakeStorage(),
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        startWechatTopUp: async (payload) => {
          calls.push(payload);
          return { ok: false, error: 'TEST_STOP' };
        },
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  const advancedButton = document.querySelector('[data-plan-pay="advanced"]');
  const professionalButton = document.querySelector('[data-plan-pay="professional"]');
  const businessButton = document.querySelector('[data-plan-pay="business"]');
  assert.equal(advancedButton.disabled, true);
  assert.equal(professionalButton.disabled, true);
  assert.equal(businessButton.disabled, true);
  assert.match(advancedButton.textContent, /低于当前套餐/);
  assert.match(professionalButton.title, /额度页购买/);

  document.querySelector('[data-quota-credits="2000"]').click();
  document.getElementById('quotaPayButton').click();
  await flushAsync();

  assert.equal(JSON.stringify(calls), JSON.stringify([{ planId: 'business', credits: 2000 }]));
  assert.equal(document.getElementById('quotaEstimate').textContent, '¥400.00');
});

test('allows custom quota credits and recalculates the payment amount while typing', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const calls = [];
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 5900, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert() {},
    console,
    document,
    localStorage: createFakeStorage(),
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        startWechatTopUp: async (payload) => {
          calls.push(payload);
          return { ok: false, error: 'TEST_STOP' };
        },
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  document.querySelector('[data-quota-credits="custom"]').click();
  const customInput = document.getElementById('quotaCustomCreditsInput');
  customInput.value = '3333';
  customInput.dispatchEvent({ type: 'input', target: customInput });
  await flushAsync();

  assert.equal(document.getElementById('quotaCustomCreditsField').hidden, false);
  assert.equal(document.getElementById('quotaEstimate').textContent, '¥1333.20');

  document.getElementById('quotaPayButton').click();
  await flushAsync();

  assert.equal(JSON.stringify(calls), JSON.stringify([{ planId: 'advanced', credits: 3333 }]));
});

test('renders quota payment orders on the quota page instead of the plan page', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 5900, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert() {},
    clearInterval() {},
    console,
    document,
    localStorage: createFakeStorage(),
    setInterval() {
      return 1;
    },
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        startWechatTopUp: async () => ({
          ok: true,
          order: {
            id: 'order-quota-1',
            orderNo: '1780516804050',
            status: 'created',
            expiresAt: new Date(Date.now() + 300000).toISOString()
          },
          payment: {
            provider: 'wechat',
            codeUrl: 'weixin://wxpay/bizpayurl?pr=quota',
            amountCents: 172960
          },
          plan: { id: 'advanced', name: '进阶版', credits: 4324, amountCents: 172960 }
        }),
        listPaymentOrders: async () => ({ ok: true, items: [], total: 0 }),
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  document.querySelector('[data-page-target="quotaPage"]').click();
  document.getElementById('quotaCustomCreditsInput').value = '4324';
  document.getElementById('quotaCustomCreditsInput').dispatchEvent({
    type: 'input',
    target: document.getElementById('quotaCustomCreditsInput')
  });
  document.getElementById('quotaPayButton').click();
  await flushAsync();

  assert.equal(document.getElementById('quotaPage').classList.contains('active-page'), true);
  assert.equal(document.getElementById('quotaPaymentSlot').children.includes(document.getElementById('manualPaymentPanel')), true);
  assert.equal(document.getElementById('planPaymentSlot').children.includes(document.getElementById('manualPaymentPanel')), false);
});

test('retries failed quota payment generation with the same custom credits', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const calls = [];
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 5900, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert() {},
    clearInterval() {},
    console,
    document,
    localStorage: createFakeStorage(),
    setInterval() {
      return 1;
    },
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        startWechatTopUp: async (payload) => {
          calls.push(payload);
          return { ok: false, error: 'TEST_STOP' };
        },
        listPaymentOrders: async () => ({ ok: true, items: [], total: 0 }),
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  document.querySelector('[data-quota-credits="custom"]').click();
  const customInput = document.getElementById('quotaCustomCreditsInput');
  customInput.value = '4324';
  customInput.dispatchEvent({ type: 'input', target: customInput });
  document.getElementById('quotaPayButton').click();
  await flushAsync();

  document.getElementById('paymentRetryButton').click();
  await flushAsync();

  assert.equal(JSON.stringify(calls), JSON.stringify([
    { planId: 'advanced', credits: 4324 },
    { planId: 'advanced', credits: 4324 }
  ]));
});

test('refreshes stale cached balance from cloud after authenticated bootstrap', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const cachedSubscription = {
    ...createEntitlementState('advanced', { balanceCredits: 5000, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const refreshedSubscription = {
    ...createEntitlementState('advanced', { balanceCredits: 5500, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const refreshCalls = [];
  const context = vm.createContext({
    alert() {},
    console,
    document,
    localStorage: createFakeStorage(),
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription: cachedSubscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        refreshCloudEntitlements: async () => {
          refreshCalls.push('refresh');
          return {
            ok: true,
            subscription: refreshedSubscription
          };
        },
        listPaymentOrders: async () => ({ ok: true, items: [], total: 0 }),
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();
  await flushAsync();

  assert.equal(refreshCalls.length, 1);
  assert.equal(document.getElementById('balanceCreditsMetric').textContent, '5,500');
});

test('keeps plan cards visible when refreshed cloud entitlements omit the catalog', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 5000, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const refreshedSubscription = createEntitlementState('advanced', {
    balanceCredits: 5500,
    usedToday: 0,
    usedThisMonth: 0
  });
  const context = vm.createContext({
    alert() {},
    console,
    document,
    localStorage: createFakeStorage(),
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        refreshCloudEntitlements: async () => ({
          ok: true,
          subscription: refreshedSubscription
        }),
        listPaymentOrders: async () => ({ ok: true, items: [], total: 0 }),
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  assert.ok(document.getElementById('planCards').children.length >= 4);

  document.getElementById('refreshEntitlementsButton').click();
  await flushAsync();
  await flushAsync();

  assert.ok(document.getElementById('planCards').children.length >= 4);
  assert.match(
    document.getElementById('planCards').children.map(card => card.innerHTML).join('\n'),
    /进阶版[\s\S]*当前套餐/
  );
  assert.equal(document.getElementById('balanceCreditsMetric').textContent, '5,500');
});

test('shows payment success, refreshes the current plan, and keeps plan payments on the plan page', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const intervals = [];
  let refreshCount = 0;
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 0, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const upgradedSubscription = {
    ...createEntitlementState('professional', { balanceCredits: 5000, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert() {},
    clearInterval() {},
    console,
    document,
    localStorage: createFakeStorage(),
    setInterval(callback) {
      intervals.push(callback);
      return intervals.length;
    },
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        startWechatTopUp: async () => ({
          ok: true,
          order: {
            id: 'order-wechat-1',
            orderNo: '1780000000001',
            status: 'created',
            expiresAt: new Date(Date.now() + 300000).toISOString()
          },
          payment: {
            provider: 'wechat',
            codeUrl: 'weixin://wxpay/bizpayurl?pr=test',
            amountCents: 150000
          },
          plan: planCatalog().find(plan => plan.id === 'professional')
        }),
        getPaymentOrderStatus: async () => ({
          ok: true,
          order: {
            id: 'order-wechat-1',
            orderNo: '1780000000001',
            status: 'paid'
          }
        }),
        refreshCloudEntitlements: async () => {
          refreshCount += 1;
          return {
            ok: true,
            subscription: refreshCount === 1 ? subscription : upgradedSubscription
          };
        },
        listPaymentOrders: async () => ({ ok: true, items: [], total: 0 }),
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();

  const professionalButton = document.querySelector('[data-plan-pay="professional"]');
  professionalButton.click();
  await flushAsync();
  await intervals[1]();
  await flushAsync();

  assert.equal(document.getElementById('paymentSuccessModal').hidden, false);
  assert.match(document.getElementById('paymentSuccessDetail').textContent, /支付成功/);
  assert.equal(document.getElementById('pageTitle').textContent, '选择适合你添加节奏的套餐');
  assert.equal(document.getElementById('planPage').classList.contains('active-page'), true);
  assert.match(
    document.getElementById('planCards').children.map(card => card.innerHTML).join('\n'),
    /专业版[\s\S]*当前套餐/
  );
});

test('keeps the workspace usable when cloud auth expires during a running task', async () => {
  const root = path.join(__dirname, '..');
  const rendererCode = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const document = createFakeDocument();
  const alerts = [];
  const subscription = {
    ...createEntitlementState('advanced', { balanceCredits: 0, usedToday: 0, usedThisMonth: 0 }),
    catalog: planCatalog(),
    openSecondaryCount: 0
  };
  const context = vm.createContext({
    alert(message) {
      alerts.push(message);
    },
    console,
    document,
    localStorage: createFakeStorage(),
    window: {
      addEventListener() {},
      addWhatsapp: {
        getBootstrapState: async () => ({
          auth: {
            authenticated: true,
            user: { username: 'cloud-user' },
            subscription,
            workspace: { isSecondary: false }
          }
        }),
        getTemplates: async () => ({ en: [], es: [], fr: [] }),
        listPaymentOrders: async () => ({ ok: false, authRequired: true, error: 'UNAUTHORIZED' }),
        logoutAccount: async () => ({
          ok: false,
          error: '当前任务正在运行，请先暂停或等待结束后再退出账号。',
          currentTaskRunning: true
        }),
        onTaskEvent() {},
        onHistoryUpdated() {},
        onShowCloseChoice() {},
        onAuthChanged() {}
      }
    }
  });

  vm.runInContext(rendererCode, context, { filename: 'renderer.js' });
  await flushAsync();
  await flushAsync();

  assert.deepEqual(alerts, []);
  assert.equal(document.getElementById('appShell').hidden, false);
  assert.equal(document.getElementById('authGate').hidden, true);
  assert.match(document.getElementById('syncState').textContent, /云端登录已失效|任务/);
});

function flushAsync() {
  return new Promise(resolve => setImmediate(resolve));
}

function createFakeStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function createFakeDocument() {
  const byId = new Map();
  const pageIds = ['importPage', 'taskPage', 'templatePage', 'historyPage', 'statisticsPage', 'planPage', 'usagePage', 'quotaPage', 'billingPage', 'accountPage'];
  const pageMeta = {
    quotaPage: { title: '额度余额和充值规则', eyebrow: '探索方案' },
    planPage: { title: '选择适合你添加节奏的套餐', eyebrow: '探索方案' }
  };
  const document = {
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
    getElementById(id) {
      if (!byId.has(id)) {
        const element = new FakeElement('div', document, id);
        if (pageIds.includes(id)) {
          element.classList.add('page');
          element.dataset.title = pageMeta[id]?.title || id;
          element.dataset.eyebrow = pageMeta[id]?.eyebrow || '';
        }
        byId.set(id, element);
      }
      return byId.get(id);
    },
    querySelector(selector) {
      if (selector === '.topbar-actions') return this.getElementById('topbarActions');
      if (selector.startsWith('[data-plan-pay="')) {
        const planId = selector.match(/\[data-plan-pay="([^"]+)"\]/)[1];
        return this.querySelectorAll('[data-plan-pay]').find(item => item.dataset.planPay === planId) || null;
      }
      if (selector.startsWith('[data-quota-credits="')) {
        const credits = selector.match(/\[data-quota-credits="([^"]+)"\]/)[1];
        return this.querySelectorAll('[data-quota-credits]').find(item => item.dataset.quotaCredits === credits) || null;
      }
      if (selector.startsWith('[data-page-target="')) {
        const pageId = selector.match(/\[data-page-target="([^"]+)"\]/)[1];
        return this.querySelectorAll('[data-page-target]').find(item => item.dataset.pageTarget === pageId) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.page') return pageIds.map(id => this.getElementById(id));
      if (selector === '[data-page-target]') {
        return pageIds.map(id => {
          const element = new FakeElement('button', document);
          element.dataset.pageTarget = id;
          return element;
        });
      }
      if (selector === '[data-plan-pay]') {
        return this.getElementById('planCards').children
          .flatMap(card => card.children)
          .filter(child => child.dataset.planPay);
      }
      if (selector === '[data-quota-credits]') {
        return ['2000', '5000', '20000', 'custom'].map(value => {
          const element = this.getElementById(`quotaCredits${value}`);
          element.dataset.quotaCredits = value;
          return element;
        });
      }
      if (selector === '[data-proxy-lookup]') return [];
      return [];
    }
  };
  return document;
}

class FakeElement {
  constructor(tagName, document, id = '') {
    this.tagName = tagName;
    this.ownerDocument = document;
    this.id = id;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.title = '';
    this.value = '';
    this.textContent = '';
    this.listeners = new Map();
    const classes = new Set();
    this.classList = {
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
      },
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    };
  }

  set innerHTML(value) {
    for (const child of this.children) {
      child.parentNode = null;
    }
    this.children = [];
    this._innerHTML = String(value || '');
    const buttonMatch = this._innerHTML.match(/<button[^>]*data-plan-pay="([^"]+)"([^>]*)>(.*?)<\/button>/s);
    if (buttonMatch) {
      const button = new FakeElement('button', this.ownerDocument);
      button.dataset.planPay = buttonMatch[1];
      button.disabled = /\sdisabled(?:\s|>|$)/.test(buttonMatch[2]);
      button.textContent = buttonMatch[3].replace(/<[^>]+>/g, '');
      this.appendChild(button);
    }
    if (this._innerHTML.includes('<textarea')) {
      const textarea = new FakeElement('textarea', this.ownerDocument);
      textarea.className = 'template-editor';
      this.appendChild(textarea);
    }
    if (this._innerHTML.includes('data-template-remove=')) {
      const removeButton = new FakeElement('button', this.ownerDocument);
      removeButton.dataset.templateRemove = 'en';
      this.appendChild(removeButton);
    }
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  appendChild(child) {
    if (child.parentNode && child.parentNode !== this) {
      child.parentNode.children = child.parentNode.children.filter(item => item !== child);
    }
    child.parentNode = this;
    if (!this.children.includes(child)) this.children.push(child);
    return child;
  }

  querySelector(selector) {
    if (selector === '[data-plan-pay]') {
      return this.children.find(child => child.dataset.planPay) || null;
    }
    if (selector === 'textarea') {
      return this.children.find(child => child.tagName === 'textarea') || null;
    }
    if (selector === 'button') {
      return this.children.find(child => child.tagName === 'button') || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '.template-editor') {
      return this.children.filter(child => child.className === 'template-editor');
    }
    if (selector === '.template-item-head span') return [];
    return [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  click() {
    if (this.disabled) return;
    for (const listener of this.listeners.get('click') || []) listener({ target: this });
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener(event);
  }

  focus() {}
  remove() {}
  removeAttribute() {}
  setAttribute(name, value) {
    this[name] = value;
  }
  getAttribute(name) {
    return this[name];
  }
}
