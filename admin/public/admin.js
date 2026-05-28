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

Object.assign(window, {
  applyConsoleSnapshot,
  loginAdmin,
  loadConsoleSnapshot,
  renderDashboard,
  renderMappings,
  renderModulePage,
  renderRoute
});
