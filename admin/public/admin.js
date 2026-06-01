import { actionQueue, adminModules, auditTrail, desktopAdminMappings } from "./admin-data.js";

const pageOutlet = document.querySelector("[data-page-outlet]");
const moduleButtons = document.querySelectorAll("[data-module-link]");
const routeButtons = document.querySelectorAll("[data-route-link]");
const adminLoginForm = document.querySelector("[data-admin-login]");
const adminUsernameInput = document.querySelector("[data-admin-username]");
const adminPasswordInput = document.querySelector("[data-admin-password]");
const adminLoginStatus = document.querySelector("[data-admin-login-status]");
const API_BASE_URL = resolveApiBaseUrl();
const ADMIN_TOKEN_STORAGE_KEY = "addWhatsappAdminAccessToken";
let adminAccessToken = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

let runtimeState = {
  adminModules,
  actionQueue,
  auditTrail,
  environmentStatus: "API 未连接"
};

let paymentEventsQuery = {
  provider: "",
  processed: "",
  q: "",
  limit: 20,
  offset: 0
};

let paymentEventsState = {
  source: "snapshot",
  loaded: false,
  loading: false,
  error: "",
  total: 0,
  items: []
};

function resolveApiBaseUrl() {
  if (window.ADD_WHATSAPP_API_URL) return window.ADD_WHATSAPP_API_URL;
  if (window.location.hostname === "admin.addwhatsapp.com") return "https://api.addwhatsapp.com";
  return "http://127.0.0.1:4110";
}

function connectedEnvironmentStatus() {
  return API_BASE_URL.includes("127.0.0.1") ? "本地 API 预览" : "API 已连接";
}

function statusTone(status) {
  if (/待接|后置/.test(status)) return "neutral";
  if (/人工/.test(status)) return "warn";
  return "good";
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th scope="col">${header}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${
            rows.length > 0
              ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")
              : `<tr><td colspan="${headers.length}">暂无记录</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function headerTemplate({ eyebrow, title, description, status }) {
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="lead">${description}</p>
      </div>
      <span class="environment-chip">${status}</span>
    </header>
  `;
}

function renderMappings() {
  return table(
    ["桌面端页面", "后台模块", "权威数据源", "后台核对项"],
    desktopAdminMappings.map((mapping) => [
      mapping.desktopPage,
      mapping.adminModule,
      `<code>${mapping.sourceOfTruth}</code>`,
      mapping.adminChecks.map((check) => `<span>${check}</span>`).join("")
    ])
  );
}

function renderActionQueue() {
  return `
    <ul class="queue-list">
      ${runtimeState.actionQueue
        .map(
          (item) => `
            <li class="queue-item queue-item--${item.severity}">
              <span>${item.label}</span>
              <strong>${item.target}</strong>
              <small>${item.detail}</small>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function renderAuditTrail() {
  return table(
    ["时间", "管理员", "动作", "对象", "之前", "之后"],
    runtimeState.auditTrail.map((row) => [row.at, row.actor, `<code>${row.action}</code>`, row.target, row.before, row.after])
  );
}

function renderCopyButton(value) {
  return `<button class="copy-button" type="button" data-copy-value="${String(value).replaceAll('"', "&quot;")}">复制</button>`;
}

function resetPaymentEventsState() {
  paymentEventsState = {
    source: "snapshot",
    loaded: false,
    loading: false,
    error: "",
    total: 0,
    items: []
  };
}

function paymentEventRowsFromApi(items) {
  return items.map((event) => [
    event.provider,
    event.eventType,
    event.providerEventId,
    event.orderId,
    event.processedAt || "pending"
  ]);
}

function paymentEventRows(module) {
  if (paymentEventsState.loaded) return paymentEventRowsFromApi(paymentEventsState.items);
  const normalizedFilter = paymentEventsQuery.q.trim().toLowerCase();
  return (module.paymentEvents || []).filter((row) => row.join(" ").toLowerCase().includes(normalizedFilter));
}

function paymentEventSummary(module, rows) {
  if (paymentEventsState.loading) return "正在读取支付事件分页 API...";
  if (paymentEventsState.error) return `分页 API 读取失败，显示快照：${paymentEventsState.error}`;
  if (!adminAccessToken) return "未登录管理员，显示当前快照。";
  if (!paymentEventsState.loaded) return `等待分页 API，当前显示快照 ${rows.length} 条。`;
  const pageIndex = Math.floor(paymentEventsQuery.offset / paymentEventsQuery.limit) + 1;
  const pageCount = Math.max(1, Math.ceil(paymentEventsState.total / paymentEventsQuery.limit));
  return `分页 API：第 ${pageIndex}/${pageCount} 页，共 ${paymentEventsState.total} 条。`;
}

function renderPaymentEvents(module) {
  const rows = paymentEventRows(module);
  const canPageBack = paymentEventsState.loaded && paymentEventsQuery.offset > 0;
  const canPageNext = paymentEventsState.loaded && paymentEventsQuery.offset + paymentEventsQuery.limit < paymentEventsState.total;
  return `
    <section class="section-block payment-events-panel">
      <div class="event-toolbar">
        <div>
          <h2>支付回调事件</h2>
          <p>核对渠道、事件号、订单和入账处理状态。重复通知应显示同一事件号，不应重复入账。</p>
        </div>
        <div class="event-filters">
          <label>
            <span>渠道</span>
            <select data-payment-event-provider>
              <option value="" ${paymentEventsQuery.provider === "" ? "selected" : ""}>全部</option>
              <option value="alipay" ${paymentEventsQuery.provider === "alipay" ? "selected" : ""}>alipay</option>
              <option value="mock_alipay" ${paymentEventsQuery.provider === "mock_alipay" ? "selected" : ""}>mock_alipay</option>
              <option value="manual" ${paymentEventsQuery.provider === "manual" ? "selected" : ""}>manual</option>
            </select>
          </label>
          <label>
            <span>状态</span>
            <select data-payment-event-processed>
              <option value="" ${paymentEventsQuery.processed === "" ? "selected" : ""}>全部</option>
              <option value="processed" ${paymentEventsQuery.processed === "processed" ? "selected" : ""}>已处理</option>
              <option value="pending" ${paymentEventsQuery.processed === "pending" ? "selected" : ""}>待处理</option>
            </select>
          </label>
          <label>
            <span>搜索</span>
            <input data-payment-event-filter value="${paymentEventsQuery.q}" placeholder="provider / event id / order id" />
          </label>
        </div>
      </div>
      <div class="event-summary">
        <span>${paymentEventSummary(module, rows)}</span>
        <div class="event-pagination">
          <button type="button" data-payment-events-page="prev" ${canPageBack ? "" : "disabled"}>上一页</button>
          <button type="button" data-payment-events-page="next" ${canPageNext ? "" : "disabled"}>下一页</button>
        </div>
      </div>
      ${table(
        ["渠道", "事件", "事件 ID", "订单 ID", "处理", "复制"],
        rows.map((row) => [
          row[0],
          row[1],
          `<code>${row[2]}</code>`,
          `<code>${row[3]}</code>`,
          row[4],
          `${renderCopyButton(row[2])}${renderCopyButton(row[3])}`
        ])
      )}
    </section>
  `;
}

async function loadPaymentEvents(nextQuery = {}) {
  if (!adminAccessToken) {
    resetPaymentEventsState();
    renderRoute();
    return;
  }
  paymentEventsQuery = {
    ...paymentEventsQuery,
    ...nextQuery
  };
  paymentEventsState = {
    ...paymentEventsState,
    loading: true,
    error: ""
  };
  renderRoute();
  try {
    const params = new URLSearchParams({
      limit: String(paymentEventsQuery.limit),
      offset: String(paymentEventsQuery.offset)
    });
    if (paymentEventsQuery.provider) params.set("provider", paymentEventsQuery.provider);
    if (paymentEventsQuery.processed) params.set("processed", paymentEventsQuery.processed);
    if (paymentEventsQuery.q) params.set("q", paymentEventsQuery.q);
    const response = await fetch(`${API_BASE_URL}/v1/admin/payment-events?${params.toString()}`, {
      headers: adminHeaders()
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `PAYMENT_EVENTS_${response.status}`);
    paymentEventsState = {
      source: "api",
      loaded: true,
      loading: false,
      error: "",
      total: payload.total,
      items: payload.items || []
    };
  } catch (error) {
    paymentEventsState = {
      source: "snapshot",
      loaded: false,
      loading: false,
      error: error.message,
      total: 0,
      items: []
    };
  }
  renderRoute();
}

function filterPaymentEvents(event) {
  const input = event.target.closest("[data-payment-event-filter]");
  if (!input) return;
  paymentEventsQuery.q = input.value;
  const module = getRuntimeModuleByKey("orders");
  const panel = pageOutlet.querySelector(".payment-events-panel");
  if (!panel || !module) return;
  if (adminAccessToken) {
    loadPaymentEvents({ q: input.value, offset: 0 });
    return;
  }
  panel.outerHTML = renderPaymentEvents(module);
  const nextInput = pageOutlet.querySelector("[data-payment-event-filter]");
  nextInput?.focus();
}

function handlePaymentEventControlChange(event) {
  const panel = event.target.closest(".payment-events-panel");
  if (!panel) return;
  const provider = event.target.closest("[data-payment-event-provider]");
  const processed = event.target.closest("[data-payment-event-processed]");
  if (!provider && !processed) return;
  paymentEventsQuery.provider = panel.querySelector("[data-payment-event-provider]")?.value || "";
  paymentEventsQuery.processed = panel.querySelector("[data-payment-event-processed]")?.value || "";
  if (adminAccessToken) {
    loadPaymentEvents({ offset: 0 });
    return;
  }
  const module = getRuntimeModuleByKey("orders");
  panel.outerHTML = renderPaymentEvents(module);
}

function paginatePaymentEvents(event) {
  const button = event.target.closest("[data-payment-events-page]");
  if (!button) return;
  const direction = button.dataset.paymentEventsPage;
  const delta = direction === "next" ? paymentEventsQuery.limit : -paymentEventsQuery.limit;
  const offset = Math.max(0, paymentEventsQuery.offset + delta);
  loadPaymentEvents({ offset });
}

async function copyPaymentToken(event) {
  const button = event.target.closest("[data-copy-value]");
  if (!button) return;
  const value = button.dataset.copyValue;
  try {
    await navigator.clipboard?.writeText(value);
    button.textContent = "已复制";
  } catch {
    button.textContent = value;
  }
}

function renderOperationPanel(moduleKey) {
  const panels = {
    users: `
      <section class="operation-panel" aria-label="用户状态操作">
        <div>
          <h2>冻结或恢复账号</h2>
          <p>输入云端用户 ID，切换账号状态。冻结后用户下一次云端请求会被拒绝。</p>
        </div>
        <form class="operation-form" data-operation-form="user-status">
          <label><span>账号 / 用户 ID</span><input name="account" required placeholder="用户名或 user_..." /></label>
          <label>
            <span>状态</span>
            <select name="status" required>
              <option value="frozen">冻结账号</option>
              <option value="active">恢复账号</option>
            </select>
          </label>
          <label><span>原因</span><input name="reason" required placeholder="风控复核 / 售后恢复" /></label>
          <button type="submit">提交状态变更</button>
          <small class="operation-status" data-operation-status="user-status"></small>
        </form>
      </section>
    `,
    credits: `
      <section class="operation-panel" aria-label="人工调账操作">
        <div>
          <h2>人工调账</h2>
          <p>只写账本流水，不直接改余额。正数补额度，负数扣回额度。</p>
        </div>
        <form class="operation-form" data-operation-form="credits-adjust">
          <label><span>用户 ID</span><input name="userId" required placeholder="user_..." /></label>
          <label><span>变动额度</span><input name="amount" required type="number" step="1" placeholder="500 或 -100" /></label>
          <label><span>原因</span><input name="reason" required placeholder="人工收款补录 / 误充扣回" /></label>
          <button type="submit">写入调账流水</button>
          <small class="operation-status" data-operation-status="credits-adjust"></small>
        </form>
      </section>
    `,
    orders: `
      <section class="operation-panel" aria-label="订单入账操作">
        <div>
          <h2>人工标记已支付</h2>
          <p>确认收款后把订单置为 paid，并写入 purchase 额度流水；重复提交不会重复入账。</p>
        </div>
        <form class="operation-form" data-operation-form="order-mark-paid">
          <label><span>订单号 / 订单 ID</span><input name="orderId" required placeholder="订单号或 order_..." /></label>
          <label><span>收款流水号</span><input name="providerTradeNo" placeholder="bank-transfer-..." /></label>
          <button type="submit">标记订单已支付</button>
          <small class="operation-status" data-operation-status="order-mark-paid"></small>
        </form>
      </section>
      <section class="operation-panel" aria-label="订单补偿队列">
        <div>
          <h2>重试待入账订单</h2>
          <p>处理 paid_pending_credit 订单，仍使用同一个 purchase 幂等键，避免补偿重复入账。</p>
        </div>
        <form class="operation-form operation-form--compact" data-operation-form="order-compensate">
          <label><span>批次上限</span><input name="limit" required type="number" min="1" max="100" value="20" /></label>
          <button type="submit">运行补偿队列</button>
          <small class="operation-status" data-operation-status="order-compensate"></small>
        </form>
      </section>
    `,
    workspaces: `
      <section class="operation-panel" aria-label="工作台租约操作">
        <div>
          <h2>释放异常租约</h2>
          <p>用于处理子工作台崩溃、进程已断开但租约仍显示 active 的情况。</p>
        </div>
        <form class="operation-form" data-operation-form="workspace-release">
          <label><span>租约 ID</span><input name="leaseId" required placeholder="lease_..." /></label>
          <label><span>原因</span><input name="reason" required placeholder="stale process cleanup" /></label>
          <button type="submit">释放租约</button>
          <small class="operation-status" data-operation-status="workspace-release"></small>
        </form>
      </section>
    `
  };

  return panels[moduleKey] || "";
}

function renderDashboard() {
  pageOutlet.innerHTML = `
    ${headerTemplate({
      eyebrow: "Admin console v0",
      title: "运营首页",
      description: "这里保留全局摘要和待处理事项。具体管理动作已经拆到左侧每一个模块页里，不再把 8 个模块详情堆在同一个长页面。",
      status: runtimeState.environmentStatus
    })}

    <section class="summary-grid" aria-label="运营摘要">
      <div class="summary-tile"><span>管理模块</span><strong>8</strong></div>
      <div class="summary-tile"><span>桌面端页面对应</span><strong>5</strong></div>
      <div class="summary-tile"><span>敏感动作留痕</span><strong>100%</strong></div>
      <div class="summary-tile"><span>公开官网耦合</span><strong>0</strong></div>
    </section>

    <div class="page-layout">
      <section class="section-block">
        <h2>模块入口</h2>
        <div class="module-directory">
          ${runtimeState.adminModules
            .map(
              (module) => `
                <a class="module-link-card" href="${module.route}">
                  <span>${module.owner}</span>
                  <strong>${module.title}</strong>
                  <small>${module.primaryAction}</small>
                </a>
              `
            )
            .join("")}
        </div>
      </section>

      <aside class="section-block">
        <h2>待处理运营队列</h2>
        ${renderActionQueue()}
      </aside>
    </div>

    <section class="section-block">
      <h2>桌面端页面对应关系</h2>
      ${renderMappings()}
    </section>
  `;
}

function renderModulePage(module) {
  pageOutlet.innerHTML = `
    ${headerTemplate({
      eyebrow: module.owner,
      title: module.pageTitle,
      description: module.pageDescription,
      status: module.status
    })}

    <section class="module-hero">
      <div>
        <span>${module.metricLabel}</span>
        <strong>${module.metric}</strong>
      </div>
      <div>
        <span>桌面端对应</span>
        <strong>${module.desktopSurface}</strong>
      </div>
      <div>
        <span>后台动作</span>
        <strong>${module.primaryAction}</strong>
      </div>
    </section>

    ${renderOperationPanel(module.key)}

    <div class="detail-grid">
      ${module.sections
        .map(
          (section) => `
            <section class="section-block">
              <h2>${section.title}</h2>
              <p>${section.body}</p>
            </section>
          `
        )
        .join("")}
    </div>

    <div class="page-layout">
      <section class="section-block">
        <h2>当前记录</h2>
        ${table(module.recordHeaders || ["对象", "状态", "规则", "备注"], module.records)}
      </section>

      <aside class="section-block">
        <h2>必须遵守</h2>
        <ul class="guard-list">
          ${module.guards.map((guard) => `<li>${guard}</li>`).join("")}
        </ul>
      </aside>
    </div>

    ${module.key === "orders" ? renderPaymentEvents(module) : ""}

    ${
      module.key === "audit"
        ? `<section class="section-block"><h2>最近审计日志</h2>${renderAuditTrail()}</section>`
        : ""
    }
  `;
}

function adminHeaders() {
  if (!adminAccessToken) throw new Error("ADMIN_LOGIN_REQUIRED");
  return {
    "content-type": "application/json",
    authorization: `Bearer ${adminAccessToken}`
  };
}

async function postAdminOperation(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `ADMIN_OPERATION_${response.status}`);
  return payload;
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setOperationStatus(formName, message, tone = "neutral") {
  const status = pageOutlet.querySelector(`[data-operation-status="${formName}"]`);
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

async function submitCreditAdjustment(form) {
  const body = formPayload(form);
  return postAdminOperation("/v1/admin/credits/adjust", {
    account: body.account,
    amount: Number(body.amount),
    reason: body.reason
  });
}

async function submitOrderMarkPaid(form) {
  const body = formPayload(form);
  return postAdminOperation(`/v1/admin/orders/${encodeURIComponent(body.orderId)}/mark-paid`, {
    providerTradeNo: body.providerTradeNo
  });
}

async function submitOrderCompensation(form) {
  const body = formPayload(form);
  return postAdminOperation("/v1/admin/orders/compensate", {
    limit: Number(body.limit || 20)
  });
}

async function submitWorkspaceRelease(form) {
  const body = formPayload(form);
  return postAdminOperation(`/v1/admin/workspaces/leases/${encodeURIComponent(body.leaseId)}/release`, {
    reason: body.reason
  });
}

async function submitUserStatusChange(form) {
  const body = formPayload(form);
  return postAdminOperation(`/v1/admin/users/${encodeURIComponent(body.userId)}/status`, {
    status: body.status,
    reason: body.reason
  });
}

async function handleOperationSubmit(event) {
  const form = event.target.closest("[data-operation-form]");
  if (!form) return;
  event.preventDefault();

  const formName = form.dataset.operationForm;
  const handlers = {
    "credits-adjust": submitCreditAdjustment,
    "order-mark-paid": submitOrderMarkPaid,
    "order-compensate": submitOrderCompensation,
    "workspace-release": submitWorkspaceRelease,
    "user-status": submitUserStatusChange
  };
  const handler = handlers[formName];
  if (!handler) return;

  setOperationStatus(formName, "正在提交...");
  try {
    await handler(form);
    form.reset();
    await loadConsoleSnapshot();
    setOperationStatus(formName, "已提交，快照已刷新。", "good");
  } catch (error) {
    const message = error.message === "ADMIN_LOGIN_REQUIRED" ? "请先登录管理员账号。" : `提交失败：${error.message}`;
    setOperationStatus(formName, message, "danger");
  }
}

function activeKeyFromHash() {
  const key = window.location.hash.replace(/^#\//, "");
  return runtimeState.adminModules.some((module) => module.key === key) ? key : "dashboard";
}

function getRuntimeModuleByKey(key) {
  return runtimeState.adminModules.find((module) => module.key === key);
}

function updateNavigation(activeKey) {
  routeButtons.forEach((button) => {
    button.classList.toggle("is-active", activeKey === button.dataset.routeLink);
  });
  moduleButtons.forEach((button) => {
    button.classList.toggle("is-active", activeKey === button.dataset.moduleLink);
  });
}

function renderRoute() {
  const activeKey = activeKeyFromHash();
  updateNavigation(activeKey);

  if (activeKey === "dashboard") {
    renderDashboard();
  } else {
    renderModulePage(getRuntimeModuleByKey(activeKey));
  }

  window.scrollTo({ top: 0, left: 0 });
  maybeLoadPaymentEvents(activeKey);
}

function maybeLoadPaymentEvents(activeKey) {
  if (activeKey !== "orders") return;
  if (!adminAccessToken) return;
  if (paymentEventsState.loaded || paymentEventsState.loading) return;
  loadPaymentEvents();
}

routeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    window.location.hash = "/";
  });
});

moduleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    window.location.hash = `/${button.dataset.moduleLink}`;
  });
});

window.addEventListener("hashchange", renderRoute);
renderRoute();

function applyConsoleSnapshot(snapshot) {
  resetPaymentEventsState();
  runtimeState = {
    adminModules: adminModules.map((module) => ({
      ...module,
      ...(snapshot.modules?.[module.key] || {})
    })),
    actionQueue: snapshot.actionQueue || actionQueue,
    auditTrail: snapshot.auditTrail || auditTrail,
    environmentStatus: connectedEnvironmentStatus()
  };
  renderRoute();
}

async function loadConsoleSnapshot() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/admin/console`, {
      headers: adminAccessToken ? { authorization: `Bearer ${adminAccessToken}` } : {}
    });
    if (!response.ok) throw new Error(`ADMIN_CONSOLE_API_${response.status}`);
    applyConsoleSnapshot(await response.json());
  } catch {
    runtimeState = { ...runtimeState, environmentStatus: "API 未连接" };
    renderRoute();
  }
}

loadConsoleSnapshot();

async function loginAdmin(event) {
  event.preventDefault();
  adminLoginStatus.textContent = "正在登录...";
  try {
    const response = await fetch(`${API_BASE_URL}/v1/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: adminUsernameInput.value,
        password: adminPasswordInput.value
      })
    });
    if (!response.ok) throw new Error(`ADMIN_LOGIN_${response.status}`);
    const payload = await response.json();
    adminAccessToken = payload.adminAccessToken;
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminAccessToken);
    adminPasswordInput.value = "";
    adminLoginStatus.textContent = `已登录：${payload.admin.username}`;
    await loadConsoleSnapshot();
  } catch {
    adminAccessToken = "";
    window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    adminLoginStatus.textContent = "登录失败，请确认 API 和管理员密码。";
  }
}

adminLoginForm.addEventListener("submit", loginAdmin);
pageOutlet.addEventListener("submit", handleOperationSubmit);
pageOutlet.addEventListener("input", filterPaymentEvents);
pageOutlet.addEventListener("change", handlePaymentEventControlChange);
pageOutlet.addEventListener("click", paginatePaymentEvents);
pageOutlet.addEventListener("click", copyPaymentToken);

Object.assign(window, {
  applyConsoleSnapshot,
  handlePaymentEventControlChange,
  handleOperationSubmit,
  loginAdmin,
  loadConsoleSnapshot,
  loadPaymentEvents,
  renderDashboard,
  renderMappings,
  renderModulePage,
  renderOperationPanel,
  renderPaymentEvents,
  filterPaymentEvents,
  paginatePaymentEvents,
  copyPaymentToken,
  submitCreditAdjustment,
  submitOrderMarkPaid,
  submitOrderCompensation,
  submitWorkspaceRelease,
  submitUserStatusChange,
  renderRoute
});
