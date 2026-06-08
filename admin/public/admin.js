import { actionQueue, adminModules, auditTrail, desktopAdminMappings } from "./admin-data.js";

const pageOutlet = document.querySelector("[data-page-outlet]");
const moduleButtons = document.querySelectorAll("[data-module-link]");
const routeButtons = document.querySelectorAll("[data-route-link]");
const loginScreen = document.querySelector("[data-login-screen]");
const adminShell = document.querySelector("[data-admin-shell]");
const adminLoginForm = document.querySelector("[data-admin-login]");
const adminUsernameInput = document.querySelector("[data-admin-username]");
const adminPasswordInput = document.querySelector("[data-admin-password]");
const adminLoginStatus = document.querySelector("[data-admin-login-status]");
const API_BASE_URL = resolveApiBaseUrl();
const ADMIN_TOKEN_STORAGE_KEY = "addWhatsappAdminAccessToken";
const ADMIN_PROFILE_STORAGE_KEY = "addWhatsappAdminProfile";
const adminAccountName = document.querySelector("[data-admin-account-name]");
const adminTokenExpiry = document.querySelector("[data-admin-token-expiry]");
const adminLogoutButton = document.querySelector("[data-admin-logout]");
const RECORD_PAGE_SIZE = 8;
const NAV_PAGES = [
  { key: "users", title: "用户管理" },
  { key: "orders", title: "财务管理" },
  { key: "plans", title: "套餐与限额" },
  { key: "audit", title: "审计日志" }
];
let adminAccessToken = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
let currentAdmin = JSON.parse(window.sessionStorage.getItem(ADMIN_PROFILE_STORAGE_KEY) || "null");
let userPageOffset = 0;
let moduleRecordOffsets = {};

let runtimeState = {
  adminModules,
  actionQueue,
  auditTrail,
  environmentStatus: "API 未连接",
  billingPolicy: null,
  pendingUnpaidOrderCount: 0
};

let paymentEventsQuery = {
  provider: "",
  processed: "",
  q: "",
  limit: RECORD_PAGE_SIZE,
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

let contactImportsQuery = {
  q: "",
  limit: RECORD_PAGE_SIZE,
  offset: 0
};

let contactImportsState = {
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

function setAdminAuthenticated(authenticated) {
  document.body.classList.toggle("admin-auth-locked", !authenticated);
  document.body.classList.toggle("admin-authenticated", authenticated);
  if (loginScreen) {
    loginScreen.hidden = authenticated;
    loginScreen.style.display = authenticated ? "none" : "grid";
  }
  if (adminShell) {
    adminShell.hidden = !authenticated;
    adminShell.style.display = authenticated ? "grid" : "none";
  }
  renderAdminAccountPanel();
}

function clearAdminSession(message = "") {
  adminAccessToken = "";
  currentAdmin = null;
  window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
  resetPaymentEventsState();
  resetContactImportsState();
  if (pageOutlet) pageOutlet.innerHTML = "";
  if (adminLoginStatus) adminLoginStatus.textContent = message;
  setAdminAuthenticated(false);
}

function tokenExpiryLabel(expiresAt) {
  if (!expiresAt) return "有效期 24 小时";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "有效期 24 小时";
  return `有效至 ${date.toLocaleString("zh-CN", { hour12: false })}`;
}

function renderAdminAccountPanel() {
  if (adminAccountName) adminAccountName.textContent = currentAdmin?.username || "-";
  if (adminTokenExpiry) adminTokenExpiry.textContent = tokenExpiryLabel(currentAdmin?.expiresAt);
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
              ? rows
                  .map(
                    (row) =>
                      `<tr>${row
                        .map((cell, index) => `<td data-label="${escapeHtml(headers[index] || "")}">${cell}</td>`)
                        .join("")}</tr>`
                  )
                  .join("")
              : `<tr><td data-label="" colspan="${headers.length}">暂无记录</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function pageCount(total, pageSize = RECORD_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function pageRows(rows, offset, pageSize = RECORD_PAGE_SIZE) {
  return rows.slice(offset, offset + pageSize);
}

function clampOffset(offset, total, pageSize = RECORD_PAGE_SIZE) {
  if (total <= pageSize) return 0;
  const maxOffset = (pageCount(total, pageSize) - 1) * pageSize;
  return Math.min(Math.max(0, offset), maxOffset);
}

function recordPageSummary(offset, total, pageSize = RECORD_PAGE_SIZE) {
  return `第 ${Math.floor(offset / pageSize) + 1}/${pageCount(total, pageSize)} 页，共 ${total} 条`;
}

function renderRecordPagination({ name, offset, total, pageSize = RECORD_PAGE_SIZE }) {
  const canPageBack = offset > 0;
  const canPageNext = offset + pageSize < total;
  return `
    <div class="record-pagination" data-record-pagination="${name}">
      <span>${recordPageSummary(offset, total, pageSize)}</span>
      <div>
        <button type="button" data-record-page="${name}" data-record-direction="prev" data-${name}-page="prev" ${canPageBack ? "" : "disabled"}>上一页</button>
        <button type="button" data-record-page="${name}" data-record-direction="next" data-${name}-page="next" ${canPageNext ? "" : "disabled"}>下一页</button>
      </div>
    </div>
  `;
}

function headerTemplate({ eyebrow, title, description, status }) {
  return `
    <header class="topbar">
      <div>
        ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}
        <h1>${title}</h1>
        ${description ? `<p class="lead">${description}</p>` : ""}
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

function resetContactImportsState() {
  contactImportsState = {
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
  const rows = (module.paymentEvents || []).filter((row) => row.join(" ").toLowerCase().includes(normalizedFilter));
  return pageRows(rows, clampOffset(paymentEventsQuery.offset, rows.length, paymentEventsQuery.limit), paymentEventsQuery.limit);
}

function paymentEventSummary(module, rows) {
  if (paymentEventsState.loading) return "正在读取支付事件分页 API...";
  if (paymentEventsState.error) return `分页 API 读取失败：${paymentEventsState.error}`;
  if (!adminAccessToken) return "";
  if (!paymentEventsState.loaded) return `当前记录 ${rows.length} 条`;
  const pageIndex = Math.floor(paymentEventsQuery.offset / paymentEventsQuery.limit) + 1;
  const totalPages = pageCount(paymentEventsState.total, paymentEventsQuery.limit);
  return `第 ${pageIndex}/${totalPages} 页，共 ${paymentEventsState.total} 条`;
}

function renderPaymentEvents(module) {
  const rows = paymentEventRows(module);
  const total = paymentEventsState.loaded ? paymentEventsState.total : (module.paymentEvents || []).length;
  const offset = clampOffset(paymentEventsQuery.offset, total, paymentEventsQuery.limit);
  const canPageBack = offset > 0;
  const canPageNext = offset + paymentEventsQuery.limit < total;
  return `
    <section class="section-block payment-events-panel">
      <div class="event-toolbar">
        <div>
          <h2>支付回调事件</h2>
        </div>
        <div class="event-filters">
          <label>
            <span>渠道</span>
            <select data-payment-event-provider>
              <option value="" ${paymentEventsQuery.provider === "" ? "selected" : ""}>全部</option>
              <option value="alipay" ${paymentEventsQuery.provider === "alipay" ? "selected" : ""}>alipay</option>
              <option value="wechat" ${paymentEventsQuery.provider === "wechat" ? "selected" : ""}>wechat</option>
              <option value="zpay" ${paymentEventsQuery.provider === "zpay" ? "selected" : ""}>zpay</option>
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatUserUid(value) {
  const text = String(value || "").trim();
  if (/^\d{8}$/.test(text)) return text;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return String(hash % 100000000).padStart(8, "0");
}

function userRows(module) {
  return (module.records || []).filter((row) => row[0] !== "暂无记录");
}

function orderRows(module) {
  return module.records || [];
}

function orderStats(module) {
  const rows = orderRows(module);
  const pending = rows.filter((row) => row[1] !== "paid").length;
  const paid = rows.filter((row) => row[1] === "paid").length;
  const pendingCredit = rows.filter((row) => row[1] === "paid_pending_credit").length;
  return [
    { label: "待处理订单", value: pending },
    { label: "已支付订单", value: paid },
    { label: "待补偿订单", value: pendingCredit },
    { label: "回调事件", value: paymentEventRows(module).length }
  ];
}

function billingModeLabel(mode) {
  return mode === "paid" ? "套餐与额度计费" : "全站免费";
}

function formatPolicyTime(value) {
  if (!value) return "立即生效";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function datetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function billingPolicyConfirmationItems(targetMode) {
  if (targetMode === "paid") {
    return [
      `当前未支付订单数量：${runtimeState.pendingUnpaidOrderCount || 0}`,
      "正在运行的免费任务不会被中途收费。",
      "新任务将在生效后按套餐、余额和每日上限处理。",
      "旧客户端可能需要升级。"
    ];
  }
  return [
    "已产生的合法扣费不退还。",
    "用户套餐、余额和订单不会清空。",
    "新任务将免费执行，支付入口将关闭。"
  ];
}

function renderBillingPolicyPanel() {
  const policy = runtimeState.billingPolicy || { mode: "free_access", version: 1, updatedAt: "", updatedBy: "", effectiveAt: null };
  const isPaid = policy.mode === "paid";
  const pendingMode = policy.pendingMode || null;
  const switchMode = pendingMode || policy.mode;
  const switchIsPaid = switchMode === "paid";
  const targetMode = switchMode;
  const statusText = pendingMode
    ? `${billingModeLabel(policy.mode)} → ${billingModeLabel(pendingMode)}`
    : billingModeLabel(policy.mode);
  const switchHint = pendingMode
    ? `当前${billingModeLabel(policy.mode)}，计划切换到${billingModeLabel(pendingMode)}`
    : (switchIsPaid ? "ON：套餐与额度计费中" : "OFF：全站免费运行中");
  const effectiveAtValue = policy.effectiveAt
    ? datetimeLocalValue(policy.effectiveAt)
    : "";
  return `
    <section class="section-block billing-policy-panel">
      <div class="billing-policy-head">
        <div>
          <p class="eyebrow">BILLING POLICY</p>
          <h2>收费模式</h2>
        </div>
        <span class="status-pill status-pill--${isPaid ? "warn" : "good"}">${escapeHtml(statusText)}</span>
      </div>
      <dl class="billing-policy-meta">
        <div><dt>策略版本</dt><dd>v${escapeHtml(policy.version || 1)}</dd></div>
        <div><dt>更新时间</dt><dd>${escapeHtml(formatPolicyTime(policy.updatedAt))}</dd></div>
        <div><dt>操作者</dt><dd>${escapeHtml(policy.updatedBy || "-")}</dd></div>
        <div><dt>计划生效</dt><dd>${escapeHtml(formatPolicyTime(policy.effectiveAt))}</dd></div>
      </dl>
      <form class="billing-policy-form" data-operation-form="billing-policy">
        <label class="billing-policy-switch">
          <input data-billing-policy-toggle name="paid" type="checkbox" ${switchIsPaid ? "checked" : ""} />
          <span class="billing-policy-toggle" aria-hidden="true">
            <span class="billing-policy-toggle-track-text billing-policy-toggle-track-text--off">OFF</span>
            <span class="billing-policy-toggle-track-text billing-policy-toggle-track-text--on">ON</span>
            <span class="billing-policy-toggle-knob"></span>
          </span>
          <span class="billing-policy-switch-copy">
            <strong>收费模式开关</strong>
            <small>${escapeHtml(switchHint)}</small>
          </span>
        </label>
        <label>
          <span>生效时间（可选，留空立即生效）</span>
          <input data-billing-policy-effective-at name="effectiveAt" type="datetime-local" value="${escapeHtml(effectiveAtValue)}" />
        </label>
        <label>
          <span>切换原因</span>
          <input name="reason" placeholder="${isPaid ? "例如：开启免费推广期" : "例如：结束免费推广期"}" />
        </label>
        <input name="expectedVersion" type="hidden" value="${escapeHtml(policy.version || 1)}" />
        <div class="billing-confirmation" data-billing-policy-confirm>
          <strong>确认事项</strong>
          <ul>
            ${billingPolicyConfirmationItems(targetMode).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
        <small class="operation-status" data-operation-status="billing-policy"></small>
        <button type="submit">保存收费模式</button>
      </form>
    </section>
  `;
}

function userStatusOptions(selected) {
  return ["active", "frozen"]
    .map((status) => `<option value="${status}" ${selected === status ? "selected" : ""}>${status === "active" ? "正常" : "封禁"}</option>`)
    .join("");
}

function userPlanOptions(selected) {
  return ["free", "advanced", "professional", "business"]
    .map((plan) => `<option value="${plan}" ${selected === plan ? "selected" : ""}>${plan}</option>`)
    .join("");
}

function sessionCount(value) {
  const match = /^(\d+)/.exec(String(value || ""));
  return match ? Number(match[1]) : 0;
}

function loginSessionLabel(value) {
  return `${sessionCount(value)} 个登录会话`;
}

function renderUserEditModal() {
  return `
    <div class="user-edit-modal" data-user-modal hidden>
      <div class="modal-backdrop" data-user-modal-cancel></div>
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="user-edit-title">
        <div class="modal-head">
          <div>
            <p class="eyebrow">ACCOUNT EDIT</p>
            <h2 id="user-edit-title">修改账户</h2>
          </div>
          <button class="modal-close" type="button" data-user-modal-cancel aria-label="取消">×</button>
        </div>
        <dl class="modal-user-summary">
          <div><dt>UID</dt><dd data-user-modal-uid></dd></div>
          <div><dt>账号</dt><dd data-user-modal-account></dd></div>
          <div><dt>当前余额</dt><dd data-user-modal-balance></dd></div>
          <div><dt>登录会话</dt><dd data-user-modal-sessions></dd></div>
        </dl>
        <form class="modal-form" data-user-modal-form>
          <label>
            <span>状态</span>
            <select data-user-modal-status>${userStatusOptions("active")}</select>
          </label>
          <label>
            <span>套餐</span>
            <select data-user-modal-plan>${userPlanOptions("free")}</select>
          </label>
          <label>
            <span>余额调整</span>
            <input data-user-modal-credit-amount type="number" step="1" placeholder="例如 500 或 -100" />
          </label>
          <label class="modal-check">
            <input data-user-modal-revoke-sessions type="checkbox" />
            <span>清空登录会话，让用户重新登录</span>
          </label>
          <small class="modal-status" data-user-modal-status-text></small>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-user-modal-cancel>取消</button>
            <button class="primary-button" type="submit" data-user-modal-save>保存修改</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderUsersModulePage(module) {
  const importsModule = getRuntimeModuleByKey("imports");
  const workspacesModule = getRuntimeModuleByKey("workspaces");
  const rows = userRows(module);
  userPageOffset = clampOffset(userPageOffset, rows.length);
  const visibleRows = pageRows(rows, userPageOffset);
  const activeCount = rows.filter((row) => row[3] === "active").length;
  const frozenCount = rows.filter((row) => row[3] === "frozen").length;
  const totalBalance = rows.reduce((sum, row) => sum + (Number(row[5]) || 0), 0);

  pageOutlet.innerHTML = `
    ${headerTemplate({
      eyebrow: "",
      title: "用户管理",
      description: "",
      status: module.status
    })}

    <section class="summary-grid users-summary" aria-label="注册用户统计">
      <div class="summary-tile"><span>注册用户</span><strong>${module.metric || rows.length}</strong></div>
      <div class="summary-tile"><span>正常账号</span><strong>${activeCount}</strong></div>
      <div class="summary-tile"><span>封禁账号</span><strong>${frozenCount}</strong></div>
      <div class="summary-tile"><span>总余额</span><strong>${totalBalance}</strong></div>
    </section>

    <section class="section-block users-management-panel">
      <div class="users-panel-head">
        <h2>账户列表</h2>
        ${renderRecordPagination({ name: "users", offset: userPageOffset, total: rows.length })}
      </div>
      <div class="table-wrap users-management-table">
        <table>
          <thead>
            <tr>
              <th scope="col">UID</th>
              <th scope="col">账号</th>
              <th scope="col">注册时间</th>
              <th scope="col">状态</th>
              <th scope="col">套餐</th>
              <th scope="col">余额</th>
              <th scope="col">登录会话</th>
              <th scope="col">修改</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length > 0
                ? visibleRows.map((row) => {
                    const uid = formatUserUid(row[1]);
                    const account = escapeHtml(row[2]);
                    const status = String(row[3] || "active");
                    const plan = String(row[4] || "free");
                    const balance = String(row[5] || "0");
                    const sessions = String(row[6] || "0 sessions");
                    return `
                      <tr data-user-row data-user-id="${escapeHtml(row[1])}" data-user-uid="${uid}" data-user-account="${account}" data-user-created="${escapeHtml(row[0])}" data-user-current-status="${escapeHtml(status)}" data-user-current-plan="${escapeHtml(plan)}" data-user-balance="${escapeHtml(balance)}" data-user-sessions="${escapeHtml(sessions)}">
                        <td data-label="UID"><code>${uid}</code></td>
                        <td data-label="账号"><strong>${account}</strong></td>
                        <td data-label="注册时间">${escapeHtml(row[0])}</td>
                        <td data-label="状态"><span class="status-pill status-pill--${status === "active" ? "good" : "warn"}">${status === "active" ? "正常" : "封禁"}</span></td>
                        <td data-label="套餐">${escapeHtml(plan)}</td>
                        <td data-label="余额"><strong>${escapeHtml(balance)}</strong></td>
                        <td data-label="登录会话">${loginSessionLabel(sessions)}</td>
                        <td data-label="修改">
                          <div class="user-actions">
                            <button type="button" data-user-edit>修改</button>
                            <small data-user-action-status></small>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join("")
                : `<tr><td colspan="8">暂无注册用户</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
    <div class="management-grid">
      ${importsModule ? renderContactImports(importsModule) : ""}
      ${workspacesModule ? `
        <div class="stacked-section">
          ${renderOperationPanel("workspaces")}
          ${renderModuleRecordSection(workspacesModule, "设备与工作台")}
        </div>
      ` : ""}
    </div>
    ${renderUserEditModal()}
  `;
}

function contactImportSummary(module, rows) {
  const total = contactImportTotal(module);
  const offset = clampOffset(contactImportsQuery.offset, total, contactImportsQuery.limit);
  if (contactImportsState.loading) return "正在读取名单审计 API...";
  if (contactImportsState.error) return `名单审计 API 读取失败：${contactImportsState.error}`;
  if (!adminAccessToken) return "";
  if (!contactImportsState.loaded) return recordPageSummary(offset, total, contactImportsQuery.limit);
  const pageIndex = Math.floor(contactImportsQuery.offset / contactImportsQuery.limit) + 1;
  const totalPages = pageCount(contactImportsState.total, contactImportsQuery.limit);
  return `第 ${pageIndex}/${totalPages} 页，共 ${contactImportsState.total} 条`;
}

function contactImportTotal(module) {
  return contactImportsState.loaded ? contactImportsState.total : (module.records || []).length;
}

function contactImportRows(module) {
  if (contactImportsState.loaded) {
    return contactImportsState.items.map((item) => [
      item.createdAt,
      item.account,
      item.originalFileName,
      item.originalFormat,
      String(item.parsedRowCount),
      `<code>${String(item.originalSha256 || "").slice(0, 16)}</code>`,
      `<button type="button" data-contact-import-download="${item.id}" data-contact-import-kind="original">原始</button><button type="button" data-contact-import-download="${item.id}" data-contact-import-kind="parsed">解析</button>`
    ]);
  }
  const rows = (module.records || []).map((row) => [...row, ""]);
  return pageRows(rows, clampOffset(contactImportsQuery.offset, rows.length, contactImportsQuery.limit), contactImportsQuery.limit);
}

function renderContactImports(module) {
  const rows = contactImportRows(module);
  const total = contactImportTotal(module);
  const offset = clampOffset(contactImportsQuery.offset, total, contactImportsQuery.limit);
  const canPageBack = offset > 0;
  const canPageNext = offset + contactImportsQuery.limit < total;
  return `
    <section class="section-block contact-imports-panel">
      <div class="event-toolbar">
        <div>
          <h2>上传名单审计</h2>
        </div>
        <div class="event-filters">
          <label>
            <span>搜索</span>
            <input data-contact-import-filter value="${contactImportsQuery.q}" placeholder="账号 / 文件名 / SHA256" />
          </label>
        </div>
      </div>
      <div class="event-summary">
        <span>${contactImportSummary(module, rows)}</span>
        <div class="event-pagination">
          <button type="button" data-contact-imports-page="prev" ${canPageBack ? "" : "disabled"}>上一页</button>
          <button type="button" data-contact-imports-page="next" ${canPageNext ? "" : "disabled"}>下一页</button>
        </div>
      </div>
      ${table(["上传时间", "账号", "原始文件", "格式", "行数", "SHA256", "下载"], rows)}
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

async function loadContactImports(nextQuery = {}) {
  if (!adminAccessToken) {
    resetContactImportsState();
    renderRoute();
    return;
  }
  contactImportsQuery = {
    ...contactImportsQuery,
    ...nextQuery
  };
  contactImportsState = {
    ...contactImportsState,
    loading: true,
    error: ""
  };
  renderRoute();
  try {
    const params = new URLSearchParams({
      limit: String(contactImportsQuery.limit),
      offset: String(contactImportsQuery.offset)
    });
    if (contactImportsQuery.q) params.set("q", contactImportsQuery.q);
    const response = await fetch(`${API_BASE_URL}/v1/admin/contact-imports?${params.toString()}`, {
      headers: adminHeaders()
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `CONTACT_IMPORTS_${response.status}`);
    contactImportsState = {
      source: "api",
      loaded: true,
      loading: false,
      error: "",
      total: payload.total,
      items: payload.items || []
    };
  } catch (error) {
    contactImportsState = {
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

function filterContactImports(event) {
  const input = event.target.closest("[data-contact-import-filter]");
  if (!input) return;
  contactImportsQuery.q = input.value;
  const module = getRuntimeModuleByKey("imports");
  const panel = pageOutlet.querySelector(".contact-imports-panel");
  if (!panel || !module) return;
  if (adminAccessToken) {
    loadContactImports({ q: input.value, offset: 0 });
    return;
  }
  panel.outerHTML = renderContactImports(module);
  const nextInput = pageOutlet.querySelector("[data-contact-import-filter]");
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

function paginateContactImports(event) {
  const button = event.target.closest("[data-contact-imports-page]");
  if (!button) return;
  const direction = button.dataset.contactImportsPage;
  const delta = direction === "next" ? contactImportsQuery.limit : -contactImportsQuery.limit;
  const offset = Math.max(0, contactImportsQuery.offset + delta);
  loadContactImports({ offset });
}

function paginateUsers(event) {
  const button = event.target.closest("[data-users-page]");
  if (!button) return;
  const module = getRuntimeModuleByKey("users");
  const total = userRows(module).length;
  const delta = button.dataset.usersPage === "next" ? RECORD_PAGE_SIZE : -RECORD_PAGE_SIZE;
  userPageOffset = clampOffset(userPageOffset + delta, total);
  renderUsersModulePage(module);
}

function paginateModuleRecords(event) {
  const button = event.target.closest("[data-record-page]");
  if (!button) return;
  const pageName = button.dataset.recordPage;
  if (!pageName || pageName === "users") return;
  if (!pageName.startsWith("module-")) return;
  const moduleKey = pageName.replace(/^module-/, "");
  const module = getRuntimeModuleByKey(moduleKey);
  if (!module) return;
  const total = moduleRecordRows(module).length;
  const delta = button.dataset.recordDirection === "next" ? RECORD_PAGE_SIZE : -RECORD_PAGE_SIZE;
  moduleRecordOffsets[moduleKey] = clampOffset((moduleRecordOffsets[moduleKey] || 0) + delta, total);
  renderModulePage(module);
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

function downloadFileNameFromDisposition(disposition, fallback) {
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition || "");
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return fallback;
    }
  }
  const quotedMatch = /filename="([^"]+)"/.exec(disposition || "");
  return quotedMatch ? quotedMatch[1] : fallback;
}

async function downloadContactImportArtifact(event) {
  const button = event.target.closest("[data-contact-import-download]");
  if (!button) return;
  const importId = button.dataset.contactImportDownload;
  const kind = button.dataset.contactImportKind || "original";
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "下载中";
  try {
    const response = await fetch(`${API_BASE_URL}/v1/admin/contact-imports/${encodeURIComponent(importId)}/download?kind=${encodeURIComponent(kind)}`, {
      headers: adminHeaders()
    });
    if (!response.ok) throw new Error(`CONTACT_IMPORT_DOWNLOAD_${response.status}`);
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const fileName = downloadFileNameFromDisposition(disposition, `contact-import-${kind}.csv`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    button.textContent = "已下载";
  } catch (error) {
    button.textContent = error.message === "ADMIN_LOGIN_REQUIRED" ? "请登录" : "失败";
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = originalText;
    }, 1600);
  }
}

function renderOperationPanel(moduleKey) {
  const panels = {
    users: `
      <section class="operation-panel" aria-label="用户状态操作">
        <div>
          <h2>冻结或恢复账号</h2>
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
      <section class="operation-panel" aria-label="微信订单同步">
        <div>
          <h2>微信主动同步</h2>
        </div>
        <form class="operation-form" data-operation-form="order-sync-wechat">
          <label><span>订单号 / 订单 ID</span><input name="orderId" required placeholder="订单号或 order_..." /></label>
          <button type="submit">同步微信订单</button>
          <small class="operation-status" data-operation-status="order-sync-wechat"></small>
        </form>
      </section>
      <section class="operation-panel" aria-label="订单入账操作">
        <div>
          <h2>人工标记已支付</h2>
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
      eyebrow: "",
      title: "运营首页",
      description: "",
      status: runtimeState.environmentStatus
    })}

    <section class="summary-grid" aria-label="运营摘要">
      <div class="summary-tile"><span>管理入口</span><strong>${NAV_PAGES.length}</strong></div>
      <div class="summary-tile"><span>合并模块</span><strong>4</strong></div>
      <div class="summary-tile"><span>敏感动作留痕</span><strong>100%</strong></div>
      <div class="summary-tile"><span>公开官网耦合</span><strong>0</strong></div>
    </section>

    <div class="page-layout">
      <section class="section-block">
        <h2>模块入口</h2>
        <div class="module-directory">
          ${NAV_PAGES
            .map(
              (page) => `
                <a class="module-link-card" href="#/${page.key}">
                  <strong>${page.title}</strong>
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

  `;
}

function moduleRecordRows(module) {
  return module.key === "audit"
    ? runtimeState.auditTrail.map((row) => [row.at, row.actor, `<code>${row.action}</code>`, row.target, row.before, row.after])
    : module.records || [];
}

function moduleRecordHeaders(module) {
  return module.key === "audit" ? ["时间", "管理员", "动作", "对象", "之前", "之后"] : module.recordHeaders || ["对象", "状态", "规则", "备注"];
}

function renderModuleRecordSection(module, title = "记录") {
  const rows = moduleRecordRows(module);
  const paginationName = `module-${module.key}`;
  const offset = clampOffset(moduleRecordOffsets[module.key] || 0, rows.length);
  moduleRecordOffsets[module.key] = offset;
  return `
    <section class="section-block module-records-panel">
      <div class="section-head">
        <h2>${module.key === "audit" ? "审计日志" : title}</h2>
        ${renderRecordPagination({ name: paginationName, offset, total: rows.length })}
      </div>
      ${table(moduleRecordHeaders(module), pageRows(rows, offset))}
    </section>
  `;
}

function renderOrdersModulePage(module) {
  const creditsModule = getRuntimeModuleByKey("credits");
  const stats = orderStats(module);
  const rows = orderRows(module);
  const paginationName = "module-orders";
  const offset = clampOffset(moduleRecordOffsets.orders || 0, rows.length);
  moduleRecordOffsets.orders = offset;
  pageOutlet.innerHTML = `
    ${headerTemplate({
      eyebrow: "",
      title: "财务管理",
      description: "",
      status: module.status
    })}

    <section class="summary-grid orders-summary" aria-label="订单入账统计">
      ${stats
        .map(
          (item) => `
            <div class="summary-tile">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </div>
          `
        )
        .join("")}
    </section>

    <div class="orders-workspace">
      <div class="orders-actions-grid">
        ${renderOperationPanel(module.key)}
        ${renderOperationPanel("credits")}
      </div>

      <section class="section-block orders-records-panel">
        <div class="section-head">
          <h2>订单记录</h2>
          ${renderRecordPagination({ name: paginationName, offset, total: rows.length })}
        </div>
        ${table(module.recordHeaders || ["订单号", "状态", "额度", "入账"], pageRows(rows, offset))}
      </section>

      ${creditsModule ? renderModuleRecordSection(creditsModule, "额度流水") : ""}
      ${renderPaymentEvents(module)}
    </div>
  `;
}

function renderImportsModulePage(module) {
  pageOutlet.innerHTML = `
    ${headerTemplate({
      eyebrow: "",
      title: module.pageTitle,
      description: "",
      status: module.status
    })}

    <div class="imports-workspace">
      ${renderContactImports(module)}
    </div>
  `;
}

function renderPlansModulePage(module) {
  const usageModule = getRuntimeModuleByKey("usage");
  pageOutlet.innerHTML = `
    ${headerTemplate({
      eyebrow: "",
      title: "套餐与限额",
      description: "",
      status: module.status
    })}

    ${renderBillingPolicyPanel()}

    <section class="summary-grid module-summary" aria-label="套餐限额统计">
      <div class="summary-tile"><span>${module.metricLabel}</span><strong>${module.metric}</strong></div>
      <div class="summary-tile"><span>${usageModule?.metricLabel || "用量"}</span><strong>${usageModule?.metric || "0"}</strong></div>
      <div class="summary-tile"><span>状态</span><strong>${module.status}</strong></div>
    </section>

    <div class="management-grid">
      ${renderModuleRecordSection(module, "套餐列表")}
      ${usageModule ? renderModuleRecordSection(usageModule, "用量记录") : ""}
    </div>
  `;
}

function renderModulePage(module) {
  if (module.key === "users") {
    renderUsersModulePage(module);
    return;
  }
  if (module.key === "plans") {
    renderPlansModulePage(module);
    return;
  }
  if (module.key === "orders") {
    renderOrdersModulePage(module);
    return;
  }
  if (module.key === "imports") {
    renderImportsModulePage(module);
    return;
  }

  pageOutlet.innerHTML = `
    ${headerTemplate({
      eyebrow: "",
      title: module.pageTitle,
      description: "",
      status: module.status
    })}

    <section class="summary-grid module-summary" aria-label="${module.pageTitle}统计">
      <div class="summary-tile"><span>${module.metricLabel}</span><strong>${module.metric}</strong></div>
      <div class="summary-tile"><span>状态</span><strong>${module.status}</strong></div>
    </section>

    ${renderOperationPanel(module.key)}

    ${renderModuleRecordSection(module)}
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

async function putAdminOperation(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
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

async function submitWechatOrderSync(form) {
  const body = formPayload(form);
  return postAdminOperation(`/v1/admin/orders/${encodeURIComponent(body.orderId)}/sync-wechat`, {});
}

async function submitWorkspaceRelease(form) {
  const body = formPayload(form);
  return postAdminOperation(`/v1/admin/workspaces/leases/${encodeURIComponent(body.leaseId)}/release`, {
    reason: body.reason
  });
}

async function submitUserStatusChange(form) {
  const body = formPayload(form);
  const identifier = body.userId || body.account;
  return postAdminOperation(`/v1/admin/users/${encodeURIComponent(identifier)}/status`, {
    status: body.status,
    reason: body.reason
  });
}

async function submitBillingPolicyUpdate(form) {
  const body = formPayload(form);
  const paid = Boolean(form.querySelector("[data-billing-policy-toggle]")?.checked);
  const effectiveAt = String(body.effectiveAt || "").trim();
  return putAdminOperation("/v1/admin/billing-policy", {
    mode: paid ? "paid" : "free_access",
    expectedVersion: Number(body.expectedVersion),
    effectiveAt: effectiveAt || null,
    reason: body.reason || (paid ? "启用收费模式" : "关闭收费模式")
  });
}

async function updateUserPlan(identifier, planId, reason) {
  return postAdminOperation(`/v1/admin/users/${encodeURIComponent(identifier)}/plan`, {
    planId,
    reason
  });
}

async function revokeUserSessions(identifier, reason) {
  return postAdminOperation(`/v1/admin/users/${encodeURIComponent(identifier)}/sessions/revoke`, {
    reason
  });
}

function setUserModalStatus(modal, message, tone = "neutral") {
  const status = modal.querySelector("[data-user-modal-status-text]");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function closeUserEditModal(event) {
  const cancel = event?.target?.closest?.("[data-user-modal-cancel]");
  if (event && !cancel) return;
  const modal = pageOutlet.querySelector("[data-user-modal]");
  if (!modal) return;
  modal.hidden = true;
  modal.removeAttribute("data-user-id");
  setUserModalStatus(modal, "");
}

function openUserEditModal(event) {
  const button = event.target.closest("[data-user-edit]");
  if (!button) return;
  const row = button.closest("[data-user-row]");
  if (!row) return;
  const modal = pageOutlet.querySelector("[data-user-modal]");
  if (!modal) return;

  modal.dataset.userId = row.dataset.userId;
  modal.dataset.userAccount = row.dataset.userAccount;
  modal.dataset.userCurrentStatus = row.dataset.userCurrentStatus;
  modal.dataset.userCurrentPlan = row.dataset.userCurrentPlan;

  modal.querySelector("[data-user-modal-uid]").textContent = row.dataset.userUid || "";
  modal.querySelector("[data-user-modal-account]").textContent = row.dataset.userAccount || "";
  modal.querySelector("[data-user-modal-balance]").textContent = row.dataset.userBalance || "0";
  modal.querySelector("[data-user-modal-sessions]").textContent = loginSessionLabel(row.dataset.userSessions);
  modal.querySelector("[data-user-modal-status]").value = row.dataset.userCurrentStatus || "active";
  modal.querySelector("[data-user-modal-plan]").value = row.dataset.userCurrentPlan || "free";
  modal.querySelector("[data-user-modal-credit-amount]").value = "";
  modal.querySelector("[data-user-modal-revoke-sessions]").checked = false;
  setUserModalStatus(modal, "");
  modal.hidden = false;
  modal.querySelector("[data-user-modal-status]")?.focus();
}

async function saveUserEditModal(event) {
  const form = event.target.closest("[data-user-modal-form]");
  if (!form) return;
  event.preventDefault();
  const modal = form.closest("[data-user-modal]");
  if (!modal) return;

  const identifier = modal.dataset.userId;
  const account = modal.dataset.userAccount;
  const status = modal.querySelector("[data-user-modal-status]")?.value || "active";
  const planId = modal.querySelector("[data-user-modal-plan]")?.value || "free";
  const currentStatus = modal.dataset.userCurrentStatus;
  const currentPlan = modal.dataset.userCurrentPlan;
  const amount = Number(modal.querySelector("[data-user-modal-credit-amount]")?.value || 0);
  const revokeSessions = Boolean(modal.querySelector("[data-user-modal-revoke-sessions]")?.checked);
  const saveButton = modal.querySelector("[data-user-modal-save]");
  const reason = `admin account update: ${account}`;

  saveButton.disabled = true;
  setUserModalStatus(modal, "正在保存...");
  try {
    if (status !== currentStatus) {
      await postAdminOperation(`/v1/admin/users/${encodeURIComponent(identifier)}/status`, { status, reason });
    }
    if (planId !== currentPlan) {
      await updateUserPlan(identifier, planId, reason);
    }
    if (Number.isInteger(amount) && amount !== 0) {
      await postAdminOperation("/v1/admin/credits/adjust", { userId: identifier, amount, reason });
    }
    if (revokeSessions) {
      await revokeUserSessions(identifier, reason);
    }
    await loadConsoleSnapshot();
    closeUserEditModal();
  } catch (error) {
    const message = error.message === "ADMIN_LOGIN_REQUIRED" ? "请先登录管理员账号。" : `保存失败：${error.message}`;
    setUserModalStatus(modal, message, "danger");
  } finally {
    saveButton.disabled = false;
  }
}

async function handleOperationSubmit(event) {
  const form = event.target.closest("[data-operation-form]");
  if (!form) return;
  event.preventDefault();

  const formName = form.dataset.operationForm;
  const handlers = {
    "credits-adjust": submitCreditAdjustment,
    "order-sync-wechat": submitWechatOrderSync,
    "order-mark-paid": submitOrderMarkPaid,
    "order-compensate": submitOrderCompensation,
    "workspace-release": submitWorkspaceRelease,
    "user-status": submitUserStatusChange,
    "billing-policy": submitBillingPolicyUpdate
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
    if (error.message === "BILLING_POLICY_VERSION_CONFLICT") {
      await loadConsoleSnapshot();
    }
    const message = error.message === "ADMIN_LOGIN_REQUIRED"
      ? "请先登录管理员账号。"
      : (error.message === "BILLING_POLICY_VERSION_CONFLICT" ? "策略版本冲突，已重新加载真实状态。" : `提交失败：${error.message}`);
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
  if (!adminAccessToken) {
    setAdminAuthenticated(false);
    return;
  }
  setAdminAuthenticated(true);
  const activeKey = activeKeyFromHash();
  updateNavigation(activeKey);

  if (activeKey === "dashboard") {
    renderDashboard();
  } else {
    renderModulePage(getRuntimeModuleByKey(activeKey));
  }

  window.scrollTo({ top: 0, left: 0 });
  maybeLoadPaymentEvents(activeKey);
  maybeLoadContactImports(activeKey);
}

function maybeLoadPaymentEvents(activeKey) {
  if (activeKey !== "orders") return;
  if (!adminAccessToken) return;
  if (paymentEventsState.loaded || paymentEventsState.loading) return;
  loadPaymentEvents();
}

function maybeLoadContactImports(activeKey) {
  if (activeKey !== "imports" && activeKey !== "users") return;
  if (!adminAccessToken) return;
  if (contactImportsState.loaded || contactImportsState.loading) return;
  loadContactImports();
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
  resetContactImportsState();
  runtimeState = {
    adminModules: adminModules.map((module) => ({
      ...module,
      ...(snapshot.modules?.[module.key] || {})
    })),
    actionQueue: snapshot.actionQueue || actionQueue,
    auditTrail: snapshot.auditTrail || auditTrail,
    environmentStatus: connectedEnvironmentStatus(),
    billingPolicy: snapshot.billingPolicy || null,
    pendingUnpaidOrderCount: Number(snapshot.pendingUnpaidOrderCount || 0)
  };
  renderRoute();
}

async function loadConsoleSnapshot() {
  if (!adminAccessToken) {
    setAdminAuthenticated(false);
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/v1/admin/console`, {
      headers: adminHeaders()
    });
    if (response.status === 401 || response.status === 403) {
      clearAdminSession("请先登录管理员账号。");
      return;
    }
    if (!response.ok) throw new Error(`ADMIN_CONSOLE_API_${response.status}`);
    applyConsoleSnapshot(await response.json());
  } catch {
    clearAdminSession("API 未连接，请确认服务器启动后再登录。");
  }
}

async function logoutAdmin() {
  const token = adminAccessToken;
  try {
    if (token) {
      await fetch(`${API_BASE_URL}/v1/admin/auth/logout`, {
        method: "POST",
        headers: adminHeaders()
      });
    }
  } catch {
    // Local logout still clears the browser session if the API is unavailable.
  }
  clearAdminSession("已退出管理员账号。");
}

function initializeAdminApp() {
  if (!adminAccessToken) {
    setAdminAuthenticated(false);
    return;
  }
  setAdminAuthenticated(true);
  loadConsoleSnapshot();
}

initializeAdminApp();

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
    currentAdmin = { ...payload.admin, expiresAt: payload.expiresAt };
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminAccessToken);
    window.sessionStorage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(currentAdmin));
    adminPasswordInput.value = "";
    adminLoginStatus.textContent = `已登录：${payload.admin.username}`;
    setAdminAuthenticated(true);
    await loadConsoleSnapshot();
  } catch {
    clearAdminSession("登录失败，请确认 API 和管理员密码。");
  }
}

adminLoginForm.addEventListener("submit", loginAdmin);
pageOutlet.addEventListener("submit", handleOperationSubmit);
pageOutlet.addEventListener("submit", saveUserEditModal);
pageOutlet.addEventListener("input", filterPaymentEvents);
pageOutlet.addEventListener("input", filterContactImports);
pageOutlet.addEventListener("change", handlePaymentEventControlChange);
pageOutlet.addEventListener("click", paginatePaymentEvents);
pageOutlet.addEventListener("click", paginateContactImports);
pageOutlet.addEventListener("click", paginateUsers);
pageOutlet.addEventListener("click", paginateModuleRecords);
pageOutlet.addEventListener("click", copyPaymentToken);
pageOutlet.addEventListener("click", downloadContactImportArtifact);
pageOutlet.addEventListener("click", openUserEditModal);
pageOutlet.addEventListener("click", closeUserEditModal);
adminLogoutButton?.addEventListener("click", logoutAdmin);

Object.assign(window, {
  applyConsoleSnapshot,
  handlePaymentEventControlChange,
  handleOperationSubmit,
  loginAdmin,
  loadConsoleSnapshot,
  loadPaymentEvents,
  loadContactImports,
  logoutAdmin,
  renderAdminAccountPanel,
  renderDashboard,
  renderMappings,
  renderModulePage,
  renderOperationPanel,
  renderPaymentEvents,
  renderContactImports,
  filterPaymentEvents,
  filterContactImports,
  paginatePaymentEvents,
  paginateContactImports,
  paginateModuleRecords,
  moduleRecordRows,
  copyPaymentToken,
  downloadContactImportArtifact,
  submitCreditAdjustment,
  submitWechatOrderSync,
  submitOrderMarkPaid,
  submitOrderCompensation,
  submitWorkspaceRelease,
  submitUserStatusChange,
  submitBillingPolicyUpdate,
  updateUserPlan,
  revokeUserSessions,
  openUserEditModal,
  closeUserEditModal,
  saveUserEditModal,
  renderUserEditModal,
  renderUsersModulePage,
  renderBillingPolicyPanel,
  formatUserUid,
  renderRoute
});
