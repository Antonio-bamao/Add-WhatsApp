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
  assert.equal(freeButton.disabled, true);
  assert.equal(currentButton.disabled, true);
  assert.equal(professionalButton.disabled, false);
  assert.equal(businessButton.disabled, false);

  professionalButton.click();
  businessButton.click();
  await flushAsync();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].planId, 'professional');
  assert.equal(calls[1].planId, 'business');
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
  const document = {
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, new FakeElement('div', document, id));
      return byId.get(id);
    },
    querySelector(selector) {
      if (selector === '.topbar-actions') return this.getElementById('topbarActions');
      if (selector.startsWith('[data-plan-pay="')) {
        const planId = selector.match(/\[data-plan-pay="([^"]+)"\]/)[1];
        return this.querySelectorAll('[data-plan-pay]').find(item => item.dataset.planPay === planId) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-plan-pay]') {
        return this.getElementById('planCards').children
          .flatMap(card => card.children)
          .filter(child => child.dataset.planPay);
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
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.title = '';
    this.value = '';
    this.textContent = '';
    this.listeners = new Map();
    this.classList = {
      toggle() {},
      add() {},
      remove() {}
    };
  }

  set innerHTML(value) {
    this.children = [];
    this._innerHTML = String(value || '');
    const buttonMatch = this._innerHTML.match(/<button[^>]*data-plan-pay="([^"]+)"([^>]*)>(.*?)<\/button>/s);
    if (buttonMatch) {
      const button = new FakeElement('button', this.ownerDocument);
      button.dataset.planPay = buttonMatch[1];
      button.disabled = /\sdisabled(?:\s|>|$)/.test(buttonMatch[2]);
      button.textContent = buttonMatch[3].replace(/<[^>]+>/g, '');
      this.children.push(button);
    }
    if (this._innerHTML.includes('<textarea')) {
      const textarea = new FakeElement('textarea', this.ownerDocument);
      textarea.className = 'template-editor';
      this.children.push(textarea);
    }
    if (this._innerHTML.includes('data-template-remove=')) {
      const removeButton = new FakeElement('button', this.ownerDocument);
      removeButton.dataset.templateRemove = 'en';
      this.children.push(removeButton);
    }
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  appendChild(child) {
    this.children.push(child);
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
