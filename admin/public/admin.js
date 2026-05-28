import { actionQueue, adminModules, auditTrail, desktopAdminMappings } from "./admin-data.mjs";

const pageOutlet = document.querySelector("[data-page-outlet]");
const moduleButtons = document.querySelectorAll("[data-module-link]");
const routeButtons = document.querySelectorAll("[data-route-link]");
const adminLoginForm = document.querySelector("[data-admin-login]");
const adminUsernameInput = document.querySelector("[data-admin-username]");
const adminPasswordInput = document.querySelector("[data-admin-password]");
const adminLoginStatus = document.querySelector("[data-admin-login-status]");
const API_BASE_URL = window.ADD_WHATSAPP_API_URL || "http://127.0.0.1:4110";
const ADMIN_TOKEN_STORAGE_KEY = "addWhatsappAdminAccessToken";
let adminAccessToken = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

let runtimeState = {
  adminModules,
  actionQueue,
  auditTrail,
  environmentStatus: "API 未连接"
};

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
          ${rows
            .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
            .join("")}
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

function renderOperationPanel(moduleKey) {
  const panels = {
    users: `
      <section class="operation-panel" aria-label="用户状态操作">
        <div>
          <h2>冻结或恢复账号</h2>
          <p>输入云端用户 ID，切换账号状态。冻结后用户下一次云端请求会被拒绝。</p>
        </div>
        <form class="operation-form" data-operation-form="user-status">
          <label><span>用户 ID</span><input name="userId" required placeholder="user_..." /></label>
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
          <label><span>订单 ID</span><input name="orderId" required placeholder="order_..." /></label>
          <label><span>收款流水号</span><input name="providerTradeNo" placeholder="bank-transfer-..." /></label>
          <button type="submit">标记订单已支付</button>
          <small class="operation-status" data-operation-status="order-mark-paid"></small>
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
        ${table(["对象", "状态", "规则", "备注"], module.records)}
      </section>

      <aside class="section-block">
        <h2>必须遵守</h2>
        <ul class="guard-list">
          ${module.guards.map((guard) => `<li>${guard}</li>`).join("")}
        </ul>
      </aside>
    </div>

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
    userId: body.userId,
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
  runtimeState = {
    adminModules: adminModules.map((module) => ({
      ...module,
      ...(snapshot.modules?.[module.key] || {})
    })),
    actionQueue: snapshot.actionQueue || actionQueue,
    auditTrail: snapshot.auditTrail || auditTrail,
    environmentStatus: "本地 API 预览"
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

Object.assign(window, {
  applyConsoleSnapshot,
  handleOperationSubmit,
  loginAdmin,
  loadConsoleSnapshot,
  renderDashboard,
  renderMappings,
  renderModulePage,
  renderOperationPanel,
  submitCreditAdjustment,
  submitOrderMarkPaid,
  submitWorkspaceRelease,
  submitUserStatusChange,
  renderRoute
});
