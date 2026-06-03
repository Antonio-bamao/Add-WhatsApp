import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(adminRoot, relativePath), "utf8");
}

describe("admin console structure", () => {
  it("keeps the admin console isolated from the public website and desktop app", () => {
    const packageJson = JSON.parse(readText("package.json"));
    const html = readText("public/index.html");

    assert.equal(packageJson.private, true);
    assert.equal(packageJson.scripts.dev, "python -m http.server 3220 -d public");
    assert.equal(packageJson.scripts.test, "node --test tests/*.test.mjs");
    assert.match(html, /admin\.addwhatsapp\.com/);
    assert.match(html, /src="\.\/logo\.png"/);
    assert.match(html, /href="\.\/favicon\.ico"/);
    assert.ok(fs.existsSync(path.join(adminRoot, "public/logo.png")));
    assert.ok(fs.existsSync(path.join(adminRoot, "public/favicon.ico")));
    assert.ok(fs.existsSync(path.join(adminRoot, "public/favicon.png")));
    assert.doesNotMatch(html, /DATABASE_URL|ADMIN_KEY|SERVICE_ROLE|WhatsApp session/i);
  });

  it("maps admin navigation one-to-one to the documented cloud modules", async () => {
    const { adminModules } = await import(pathToFileURL(path.join(adminRoot, "public/admin-data.js")));
    const moduleKeys = adminModules.map((module) => module.key);

    assert.deepEqual(moduleKeys, [
      "users",
      "plans",
      "credits",
      "usage",
      "orders",
      "imports",
      "referrals",
      "workspaces",
      "audit"
    ]);

    for (const module of adminModules) {
      assert.ok(module.title);
      assert.ok(module.owner);
      assert.ok(module.desktopSurface);
      assert.ok(module.primaryAction);
      assert.ok(module.guards.length > 0);
      assert.ok(module.route);
      assert.ok(module.pageTitle);
      assert.ok(module.pageDescription);
      if (module.key === "users" || module.key === "orders" || module.key === "imports") {
        assert.equal(module.sections.length, 0);
      } else {
        assert.ok(module.sections.length >= 3);
      }
    }
  });

  it("maps the desktop commercial pages to matching admin review surfaces", async () => {
    const { desktopAdminMappings } = await import(pathToFileURL(path.join(adminRoot, "public/admin-data.js")));

    assert.deepEqual(
      desktopAdminMappings.map((mapping) => mapping.desktopPage),
      ["套餐页", "用量页", "额度页", "账单页", "导入名单", "推荐奖励页"]
    );

    for (const mapping of desktopAdminMappings) {
      assert.ok(mapping.adminModule);
      assert.ok(mapping.sourceOfTruth);
      assert.ok(mapping.adminChecks.length >= 2);
    }
  });

  it("renders one module page at a time instead of stacking every module in one long page", () => {
    const html = readText("public/index.html");
    const css = readText("public/admin.css");
    const js = readText("public/admin.js");

    for (const expectedText of [
      "注册用户",
      "套餐与订阅",
      "额度账本",
      "用量限额",
      "订单与入账",
      "名单审计",
      "推荐审核",
      "设备与工作台",
      "审计日志"
    ]) {
      assert.match(html + js, new RegExp(expectedText));
    }

    assert.match(html, /data-page-outlet/);
    assert.doesNotMatch(html, /data-module-grid/);
    assert.match(js, /renderDashboard/);
    assert.match(js, /renderModulePage/);
    assert.match(js, /renderRoute/);
    assert.doesNotMatch(js, /renderModules/);
    assert.match(js, /renderMappings/);
    assert.match(css, /\.page-layout/);
    assert.match(css, /\.detail-grid/);
    assert.match(css, /@media \(max-width: 860px\)/);
  });

  it("requires a full-screen admin login before loading runtime data", () => {
    const html = readText("public/index.html");
    const js = readText("public/admin.js");

    assert.match(js, /ADD_WHATSAPP_API_URL/);
    assert.match(js, /api\.addwhatsapp\.com/);
    assert.match(js, /adminAccessToken/);
    assert.match(js, /\/v1\/admin\/auth\/login/);
    assert.match(js, /\/v1\/admin\/console/);
    assert.match(js, /fetch/);
    assert.match(js, /applyConsoleSnapshot/);
    assert.match(html, /data-login-screen/);
    assert.match(html, /data-admin-shell/);
    assert.match(html, /data-admin-login/);
    assert.match(html, /data-admin-username/);
    assert.match(html, /data-admin-password/);
    assert.match(html, /value="yojiro"/);
    assert.match(js, /setAdminAuthenticated/);
    assert.match(js, /initializeAdminApp/);
    assert.match(js, /adminHeaders\(\)/);
    assert.match(js, /本地 API 预览/);
    assert.match(js, /API 未连接/);
    assert.doesNotMatch(html + js, /未登录，仅显示预览数据|登录后可下载|未登录管理员，显示当前快照/);
    assert.doesNotMatch(html + js, /admin-preview|AdminPass123/);
    assert.doesNotMatch(js, /\nloadConsoleSnapshot\(\);\s*\n\s*async function loginAdmin/);
  });

  it("exposes real admin operation forms for the first运营闭环", () => {
    const js = readText("public/admin.js");
    const css = readText("public/admin.css");

    for (const endpoint of [
      "/v1/admin/credits/adjust",
      "/v1/admin/orders/",
      "/v1/admin/workspaces/leases/",
      "/v1/admin/users/"
    ]) {
      assert.match(js, new RegExp(endpoint.replaceAll("/", "\\/")));
    }

    for (const expectedFunction of [
      "renderOperationPanel",
      "renderPaymentEvents",
      "filterPaymentEvents",
      "copyPaymentToken",
      "submitCreditAdjustment",
      "submitOrderMarkPaid",
      "submitOrderCompensation",
      "submitWorkspaceRelease",
      "submitUserStatusChange"
    ]) {
      assert.match(js, new RegExp(expectedFunction));
    }

    assert.match(js, /data-operation-form="credits-adjust"/);
    assert.match(js, /data-operation-form="order-mark-paid"/);
    assert.match(js, /账号 \/ 用户 ID/);
    assert.match(js, /订单号 \/ 订单 ID/);
    assert.match(js, /data-operation-form="order-compensate"/);
    assert.match(js, /data-operation-form="workspace-release"/);
    assert.match(js, /data-operation-form="user-status"/);
    assert.match(js, /data-payment-event-filter/);
    assert.match(js, /data-copy-value/);
    assert.match(js, /loadConsoleSnapshot\(\)/);
    assert.match(css, /\.operation-panel/);
    assert.match(css, /\.operation-form/);
    assert.match(css, /\.operation-status/);
    assert.match(css, /\.event-toolbar/);
    assert.match(css, /\.copy-button/);
  });

  it("adds a customer import audit module backed by the admin contact-imports API", async () => {
    const { adminModules, desktopAdminMappings } = await import(pathToFileURL(path.join(adminRoot, "public/admin-data.js")));
    const js = readText("public/admin.js");
    const css = readText("public/admin.css");
    const imports = adminModules.find((module) => module.key === "imports");

    assert.equal(imports.title, "名单审计");
    assert.match(imports.pageDescription, /原始文件/);
    assert.equal(imports.sections.length, 0);
    assert.ok(desktopAdminMappings.some((mapping) => mapping.desktopPage === "导入名单"));
    assert.match(js, /\/v1\/admin\/contact-imports/);
    assert.match(js, /renderImportsModulePage/);
    assert.match(js, /imports-workspace/);
    const importsRenderer = js.match(/function renderImportsModulePage\(module\) \{[\s\S]*?\n\}/)?.[0] || "";
    assert.match(importsRenderer, /eyebrow: ""/);
    assert.doesNotMatch(importsRenderer, /module\.sections|必须遵守|section\.body|module-hero|当前记录/);
    assert.match(js, /downloadContactImportArtifact/);
    assert.match(js, /downloadFileNameFromDisposition/);
    assert.match(js, /filename\\\*/);
    assert.match(js, /data-contact-import-download/);
    assert.match(css, /\.contact-imports-panel/);
    assert.match(css, /\.imports-workspace/);
  });

  it("uses the admin payment-events API for the orders event table", () => {
    const js = readText("public/admin.js");
    const css = readText("public/admin.css");

    assert.match(js, /\/v1\/admin\/payment-events/);
    assert.match(js, /loadPaymentEvents/);
    assert.match(js, /paymentEventsQuery/);
    assert.match(js, /renderOrdersModulePage/);
    assert.match(js, /orders-workspace/);
    assert.match(js, /orders-actions-grid/);
    assert.match(js, /订单记录/);
    const ordersRenderer = js.match(/function renderOrdersModulePage\(module\) \{[\s\S]*?\n\}/)?.[0] || "";
    assert.match(ordersRenderer, /订单记录/);
    assert.match(ordersRenderer, /eyebrow: ""/);
    assert.doesNotMatch(ordersRenderer, /module\.sections|必须遵守|section\.body|module-hero/);
    assert.match(js, /data-payment-event-provider/);
    assert.match(js, /data-payment-event-processed/);
    assert.match(js, /data-payment-events-page/);
    assert.match(js, /paginatePaymentEvents/);
    assert.match(js, /handlePaymentEventControlChange/);
    assert.match(css, /\.orders-workspace/);
    assert.match(css, /\.orders-actions-grid/);
    assert.match(css, /\.event-pagination/);
    assert.match(css, /\.event-summary/);
  });

  it("renders the users module as a dense account management table without password fields", () => {
    const data = readText("public/admin-data.js");
    const js = readText("public/admin.js");
    const css = readText("public/admin.css");

    assert.match(data, /pageTitle: "注册用户"/);
    assert.match(data, /注册时间/);
    assert.match(data, /UID/);
    assert.match(data, /账号/);
    assert.match(data, /套餐/);
    assert.match(data, /余额/);
    assert.match(data, /登录会话/);
    assert.match(js, /renderUsersModulePage/);
    assert.match(js, /formatUserUid/);
    assert.match(js, /renderUserEditModal/);
    assert.match(js, /openUserEditModal/);
    assert.match(js, /closeUserEditModal/);
    assert.match(js, /saveUserEditModal/);
    assert.match(js, /data-user-edit/);
    assert.match(js, /data-user-modal/);
    assert.match(js, /data-user-modal-save/);
    assert.match(js, /data-user-modal-cancel/);
    assert.match(js, /RECORD_PAGE_SIZE = 8/);
    assert.match(js, /userPageOffset/);
    assert.match(js, /paginateUsers/);
    assert.match(js, /data-users-page/);
    assert.match(js, /保存修改/);
    assert.match(js, /取消/);
    assert.match(js, /data-user-id/);
    assert.doesNotMatch(js, /<td><select data-user-status/);
    assert.doesNotMatch(js, /<td><select data-user-plan/);
    assert.doesNotMatch(js, /<span class="credit-balance">.*data-user-credit-amount/s);
    assert.match(css, /\.users-management-table/);
    assert.match(css, /\.record-pagination/);
    assert.match(css, /\.user-edit-modal/);
    assert.match(css, /\.modal-actions/);
    assert.match(css, /\.modal-card\s*{[^}]*font-size:\s*16px/s);
    assert.match(css, /\.modal-user-summary dd\s*{[^}]*font-size:\s*17px/s);
    assert.match(css, /\.modal-form label\s*{[^}]*font-size:\s*14px/s);
    assert.match(css, /\.modal-form input,\s*\.modal-form select\s*{[^}]*min-height:\s*46px/s);
    assert.match(css, /\.primary-button,\s*\.secondary-button\s*{[^}]*min-height:\s*46px/s);
    assert.doesNotMatch(data + js, /注册情况|密码边界|支付归属/);
    assert.doesNotMatch(data, /password_hash|passwordHash|明文密码|密码哈希/i);
    assert.doesNotMatch(js, /password_hash|passwordHash|明文密码|密码哈希/i);
  });
});
