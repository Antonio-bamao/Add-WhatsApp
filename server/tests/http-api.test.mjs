import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import zlib from "node:zlib";

import { createAppServer, createRuntimeFromEnv } from "../src/app.js";
import { createCloudStore, createMemoryRuntime } from "../src/services/billingService.js";
import { signMockAlipayPayload, signZpayPayload } from "../src/services/paymentProviders.js";

function encryptWechatResource(payload, apiV3Key, { nonce = "notify-nonce", associatedData = "transaction" } = {}) {
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(apiV3Key), Buffer.from(nonce));
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    algorithm: "AEAD_AES_256_GCM",
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
    associated_data: associatedData,
    nonce
  };
}

async function withServer(testFn, options = {}) {
  const server = createAppServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await testFn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json();
  return { response, payload };
}

async function requestText(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {})
    },
    body: options.body
  });
  return { response, text: await response.text() };
}

async function requestBuffer(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {})
    },
    body: options.body
  });
  return { response, buffer: Buffer.from(await response.arrayBuffer()) };
}

describe("cloud API skeleton", () => {
  it("serves health, auth, entitlements, admin adjustment, credit consume, leases, and audit logs", async () => {
    await withServer(async (baseUrl) => {
      const health = await request(baseUrl, "/v1/health");
      assert.equal(health.response.status, 200);
      assert.equal(health.payload.ok, true);

      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "api-user", password: "StrongPass123", planId: "advanced" }
      });
      assert.equal(registered.response.status, 201);
      assert.ok(registered.payload.accessToken);
      assert.ok(registered.payload.refreshToken);

      const refreshed = await request(baseUrl, "/v1/auth/refresh", {
        method: "POST",
        body: { refreshToken: registered.payload.refreshToken, deviceId: "desktop-refresh" }
      });
      assert.equal(refreshed.response.status, 200);
      assert.equal(refreshed.payload.user.id, registered.payload.user.id);
      assert.notEqual(refreshed.payload.accessToken, registered.payload.accessToken);
      assert.notEqual(refreshed.payload.refreshToken, registered.payload.refreshToken);

      const rejectedReusedRefresh = await request(baseUrl, "/v1/auth/refresh", {
        method: "POST",
        body: { refreshToken: registered.payload.refreshToken, deviceId: "desktop-refresh" }
      });
      assert.equal(rejectedReusedRefresh.response.status, 401);

      const token = refreshed.payload.accessToken;
      const auth = { authorization: `Bearer ${token}` };

      const rejectedAdjustment = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: auth,
        body: { userId: registered.payload.user.id, amount: 300, reason: "manual transfer" }
      });
      assert.equal(rejectedAdjustment.response.status, 403);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "yojiro", password: "yojiro123" }
      });
      assert.equal(adminLogin.response.status, 200);
      assert.ok(adminLogin.payload.adminAccessToken);
      assert.match(adminLogin.payload.expiresAt, /^20/);
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };

      const adjusted = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: adminAuth,
        body: { userId: registered.payload.user.id, amount: 300, reason: "manual transfer" }
      });
      assert.equal(adjusted.response.status, 200);
      assert.equal(adjusted.payload.balanceCredits, 300);

      const adjustedByAccount = await request(baseUrl, "/v1/admin/credits/adjust", {
        method: "POST",
        headers: adminAuth,
        body: { account: "api-user", amount: 100, reason: "manual qr payment" }
      });
      assert.equal(adjustedByAccount.response.status, 200);
      assert.equal(adjustedByAccount.payload.userId, registered.payload.user.id);
      assert.equal(adjustedByAccount.payload.balanceCredits, 400);

      const entitlements = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(entitlements.response.status, 200);
      assert.equal(entitlements.payload.availableToday, 200);

      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 1 }
      });
      assert.equal(order.response.status, 201);
      assert.equal(order.payload.status, "created");
      assert.equal(order.payload.amountCents, 80000);

      const manualPayment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/manual`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(manualPayment.response.status, 200);
      assert.equal(manualPayment.payload.provider, "manual");
      assert.equal(manualPayment.payload.orderId, order.payload.id);
      assert.equal(manualPayment.payload.orderNo, order.payload.orderNo);
      assert.equal(manualPayment.payload.amountCents, 80000);
      assert.equal(manualPayment.payload.paymentNote, `ADWA-${order.payload.orderNo}`);
      assert.equal(manualPayment.payload.alipayQrImageUrl, "https://addwhatsapp.com/pay/alipay.png");

      const rejectedPaymentEvent = await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        body: {
          provider: "manual",
          providerEventId: "evt-api-paid-1",
          orderId: order.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-api-1"
        }
      });
      assert.equal(rejectedPaymentEvent.response.status, 401);

      const paymentEvent = await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        headers: adminAuth,
        body: {
          provider: "manual",
          providerEventId: "evt-api-paid-1",
          orderId: order.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-api-1"
        }
      });
      assert.equal(paymentEvent.response.status, 200);
      assert.equal(paymentEvent.payload.order.status, "paid");

      const secondOrder = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });
      assert.equal(secondOrder.response.status, 201);

      const markedByOrderNo = await request(baseUrl, `/v1/admin/orders/${secondOrder.payload.orderNo}/mark-paid`, {
        method: "POST",
        headers: adminAuth,
        body: { providerTradeNo: "manual-order-no-1" }
      });
      assert.equal(markedByOrderNo.response.status, 200);
      assert.equal(markedByOrderNo.payload.status, "paid");

      const duplicatePaymentEvent = await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        headers: adminAuth,
        body: {
          provider: "manual",
          providerEventId: "evt-api-paid-1",
          orderId: order.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-api-1"
        }
      });
      assert.equal(duplicatePaymentEvent.response.status, 200);
      assert.equal(duplicatePaymentEvent.payload.idempotentReplay, true);

      const compensation = await request(baseUrl, "/v1/admin/orders/compensate", {
        method: "POST",
        headers: adminAuth,
        body: { limit: 10 }
      });
      assert.equal(compensation.response.status, 200);
      assert.equal(compensation.payload.processedCount, 0);

      const consumed = await request(baseUrl, "/v1/credits/consume", {
        method: "POST",
        headers: auth,
        body: {
          idempotencyKey: "api-consume-1",
          taskId: "task-api",
          contactHash: "hash-api",
          workspaceId: "workspace-api",
          sentAt: "2026-05-26T14:00:00+08:00"
        }
      });
      assert.equal(consumed.response.status, 200);
      assert.equal(consumed.payload.balanceCredits, 4399);

      const lease = await request(baseUrl, "/v1/workspaces/leases", {
        method: "POST",
        headers: auth,
        body: { deviceId: "device-api", workspaceKind: "primary", processNonce: "nonce-api" }
      });
      assert.equal(lease.response.status, 201);
      assert.ok(lease.payload.leaseId);

      const renewedLease = await request(baseUrl, `/v1/workspaces/leases/${lease.payload.leaseId}/renew`, {
        method: "POST",
        headers: auth
      });
      assert.equal(renewedLease.response.status, 200);
      assert.equal(renewedLease.payload.status, "active");

      const releasedLease = await request(baseUrl, `/v1/workspaces/leases/${lease.payload.leaseId}/release`, {
        method: "POST",
        headers: auth
      });
      assert.equal(releasedLease.response.status, 200);
      assert.equal(releasedLease.payload.status, "released");

      const audit = await request(baseUrl, "/v1/admin/audit-logs", { headers: adminAuth });
      assert.equal(audit.response.status, 200);
      assert.ok(audit.payload.items.some((entry) => entry.action === "credit.adjustment"));

      const rejectedConsoleSnapshot = await request(baseUrl, "/v1/admin/console");
      assert.equal(rejectedConsoleSnapshot.response.status, 401);

      const consoleSnapshot = await request(baseUrl, "/v1/admin/console", { headers: adminAuth });
      assert.equal(consoleSnapshot.response.status, 200);
      assert.equal(consoleSnapshot.payload.source, "server-local-preview");
      assert.equal(consoleSnapshot.payload.summary.users, 1);
      assert.equal(consoleSnapshot.payload.summary.paymentEvents, 1);
      assert.deepEqual(consoleSnapshot.payload.modules.users.recordHeaders, [
        "注册时间",
        "UID",
        "账号",
        "状态",
        "套餐",
        "余额",
        "登录会话"
      ]);
      assert.equal(consoleSnapshot.payload.modules.users.records.length, 1);
      const userRow = consoleSnapshot.payload.modules.users.records[0];
      assert.match(userRow[1], /^\d{8}$/);
      assert.equal(userRow[2], "api-user");
      assert.equal(userRow[3], "active");
      assert.equal(userRow[4], "advanced");
      assert.equal(userRow[5], "4399");
      assert.match(userRow[6], /sessions/);
      assert.doesNotMatch(JSON.stringify(consoleSnapshot.payload.modules.users), /password/i);
      assert.doesNotMatch(JSON.stringify(consoleSnapshot.payload.modules), /等待 API 写入|empty|本地预览|PostgreSQL/);
      assert.equal(consoleSnapshot.payload.modules.plans.records.length, 4);
      assert.ok(consoleSnapshot.payload.modules.orders.paymentEvents.some((row) => row.includes("evt-api-paid-1")));
      assert.ok(consoleSnapshot.payload.auditTrail.some((entry) => entry.action === "credit.adjustment"));

      const loggedOut = await request(baseUrl, "/v1/admin/auth/logout", {
        method: "POST",
        headers: adminAuth
      });
      assert.equal(loggedOut.response.status, 200);
      assert.equal(loggedOut.payload.loggedOut, true);
      const rejectedAfterLogout = await request(baseUrl, "/v1/admin/console", { headers: adminAuth });
      assert.equal(rejectedAfterLogout.response.status, 401);
    }, { env: { MANUAL_PAYMENT_ALIPAY_QR_URL: "https://addwhatsapp.com/pay/alipay.png" } });
  });

  it("allows lower package purchases for higher-tier users without downgrading their subscription", async () => {
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "api-business-user", password: "StrongPass123", planId: "business" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "professional", credits: 5000, amountCents: 1 }
      });

      assert.equal(order.response.status, 201);
      assert.equal(order.payload.amountCents, 150000);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "yojiro", password: "yojiro123" }
      });
      assert.equal(adminLogin.response.status, 200);
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };

      const paymentEvent = await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        headers: adminAuth,
        body: {
          provider: "manual",
          providerEventId: "evt-business-lower-package-paid",
          orderId: order.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-business-lower-package"
        }
      });
      assert.equal(paymentEvent.response.status, 200);

      const entitlements = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(entitlements.response.status, 200);
      assert.equal(entitlements.payload.planId, "business");
      assert.equal(entitlements.payload.balanceCredits, 5000);
    });
  });

  it("accepts signed mock_alipay notifications and rejects tampered callbacks", async () => {
    const secret = "http_mock_alipay_secret";
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "pay-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });
      assert.equal(order.response.status, 201);

      const payload = {
        app_id: "mock-app",
        notify_id: "notify-http-001",
        out_trade_no: order.payload.orderNo,
        trade_no: "mock-trade-http-001",
        trade_status: "TRADE_SUCCESS",
        total_amount: "600.00"
      };
      const signed = { ...payload, sign: signMockAlipayPayload(payload, secret) };

      const paid = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: signed
      });
      assert.equal(paid.response.status, 200);
      assert.equal(paid.payload.order.status, "paid");

      const duplicate = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: signed
      });
      assert.equal(duplicate.response.status, 200);
      assert.equal(duplicate.payload.idempotentReplay, true);

      const balance = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(balance.payload.balanceCredits, 2000);

      const tampered = await request(baseUrl, "/v1/payments/mock-alipay/notify", {
        method: "POST",
        body: { ...signed, notify_id: "notify-http-002", total_amount: "1.00" }
      });
      assert.equal(tampered.response.status, 401);
    }, { env: { MOCK_ALIPAY_WEBHOOK_SECRET: secret } });
  });

  it("accepts signed Alipay form notifications and responds with plain success", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "alipay-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });
      const payload = {
        app_id: "2026000000000000",
        notify_id: "notify-http-alipay-001",
        notify_type: "trade_status_sync",
        out_trade_no: order.payload.orderNo,
        trade_no: "2026052922000000000003",
        trade_status: "TRADE_SUCCESS",
        total_amount: "600.00",
        sign_type: "RSA2"
      };
      const signingText = Object.keys(payload)
        .filter((key) => key !== "sign" && key !== "sign_type")
        .sort()
        .map((key) => `${key}=${payload[key]}`)
        .join("&");
      const form = new URLSearchParams({
        ...payload,
        sign: crypto.sign("RSA-SHA256", Buffer.from(signingText), privateKey).toString("base64")
      });

      const paid = await requestText(baseUrl, "/v1/payments/alipay/notify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      assert.equal(paid.response.status, 200);
      assert.equal(paid.text, "success");

      const duplicate = await requestText(baseUrl, "/v1/payments/alipay/notify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      assert.equal(duplicate.response.status, 200);
      assert.equal(duplicate.text, "success");

      const balance = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(balance.payload.balanceCredits, 2000);
    }, { env: { ALIPAY_PUBLIC_KEY: publicKey, ALIPAY_APP_ID: "2026000000000000" } });
  });

  it("creates a signed Alipay page-pay request for the authenticated user's order", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });

    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "alipay-link-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });

      const payment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/alipay/page-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(payment.response.status, 200);
      assert.equal(payment.payload.provider, "alipay");
      assert.equal(payment.payload.orderId, order.payload.id);
      assert.equal(payment.payload.orderNo, order.payload.orderNo);
      assert.ok(payment.payload.paymentUrl.startsWith("https://openapi-sandbox.dl.alipaydev.com/gateway.do?"));
      assert.equal(payment.payload.params.biz_content.includes(privateKey), false);

      const signingText = Object.keys(payment.payload.params)
        .filter((key) => key !== "sign")
        .sort()
        .map((key) => `${key}=${payment.payload.params[key]}`)
        .join("&");
      assert.equal(
        crypto.verify("RSA-SHA256", Buffer.from(signingText), publicKey, Buffer.from(payment.payload.params.sign, "base64")),
        true
      );

      const otherUser = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "alipay-link-other", password: "StrongPass123", planId: "advanced" }
      });
      const rejected = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/alipay/page-pay`, {
        method: "POST",
        headers: { authorization: `Bearer ${otherUser.payload.accessToken}` },
        body: {}
      });
      assert.equal(rejected.response.status, 404);
    }, {
      env: {
        ALIPAY_APP_ID: "2026000000000000",
        ALIPAY_APP_PRIVATE_KEY: privateKey,
        ALIPAY_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/alipay/notify",
        ALIPAY_RETURN_URL: "https://addwhatsapp.com/billing/success",
        ALIPAY_GATEWAY_URL: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
        ALIPAY_FIXED_TIMESTAMP: "2026-05-29 10:20:30"
      }
    }, { env: { MANUAL_PAYMENT_ALIPAY_QR_URL: "https://addwhatsapp.com/pay/alipay.png" } });
  });

  it("creates signed ZPAY page-pay requests and accepts signed callbacks", async () => {
    const key = "zpay_http_secret";
    const pid = "2026060213344566";
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "zpay-link-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 80000 }
      });

      const payment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/zpay/page-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(payment.response.status, 200);
      assert.equal(payment.payload.provider, "zpay");
      assert.equal(payment.payload.orderId, order.payload.id);
      assert.equal(payment.payload.orderNo, order.payload.orderNo);
      assert.ok(payment.payload.paymentUrl.startsWith("https://zpayz.cn/submit.php?"));
      assert.equal(payment.payload.params.pid, pid);
      assert.equal(payment.payload.params.type, "wxpay");
      assert.equal(payment.payload.params.notify_url, "https://api.addwhatsapp.com/v1/payments/zpay/notify");

      const notifyPayload = {
        pid,
        out_trade_no: order.payload.orderNo,
        trade_no: "zpay-http-trade-001",
        trade_status: "TRADE_SUCCESS",
        money: "800.00",
        type: "wxpay",
        sign_type: "MD5"
      };
      const signed = { ...notifyPayload, sign: signZpayPayload(notifyPayload, key) };
      const callback = await requestText(baseUrl, `/v1/payments/zpay/notify?${new URLSearchParams(signed)}`, {
        method: "GET"
      });
      assert.equal(callback.response.status, 200);
      assert.equal(callback.text, "success");

      const balance = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(balance.payload.balanceCredits, 2000);

      const tampered = await requestText(baseUrl, `/v1/payments/zpay/notify?${new URLSearchParams({ ...signed, money: "1.00" })}`, {
        method: "GET"
      });
      assert.equal(tampered.response.status, 401);
    }, {
      env: {
        ZPAY_GATEWAY_URL: "https://zpayz.cn",
        ZPAY_PID: pid,
        ZPAY_KEY: key,
        ZPAY_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/zpay/notify",
        ZPAY_RETURN_URL: "https://addwhatsapp.com",
        ZPAY_TYPE: "wxpay",
        ZPAY_SITE_NAME: "Add WhatsApp"
      }
    });
  });

  it("creates WeChat Native payment requests and accepts encrypted APIv3 callbacks", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const apiV3Key = "0123456789abcdef0123456789abcdef";
    let capturedWechatRequest;
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "wechat-link-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "professional", credits: 5000, amountCents: 150000 }
      });

      const payment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/wechat/native-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(payment.response.status, 200);
      assert.equal(
        JSON.parse(capturedWechatRequest.options.body).time_expire,
        new Date(order.payload.expiresAt).toISOString().replace(/\.\d{3}Z$/, "+00:00")
      );
      assert.equal(payment.payload.provider, "wechat");
      assert.equal(payment.payload.orderId, order.payload.id);
      assert.equal(payment.payload.orderNo, order.payload.orderNo);
      assert.equal(payment.payload.codeUrl, "weixin://wxpay/bizpayurl?pr=http-test-token");
      assert.equal(JSON.parse(capturedWechatRequest.options.body).out_trade_no, order.payload.orderNo);

      const callback = await requestText(baseUrl, "/v1/payments/wechat/notify", {
        method: "POST",
        body: JSON.stringify({
          id: "wechat-http-notify-001",
          event_type: "TRANSACTION.SUCCESS",
          resource_type: "encrypt-resource",
          resource: encryptWechatResource({
            appid: "wx92f39a8b81948f51",
            mchid: "1113492162",
            out_trade_no: order.payload.orderNo,
            transaction_id: "420000000020260603000001",
            trade_state: "SUCCESS",
            amount: { total: 150000, payer_total: 150000, currency: "CNY" }
          }, apiV3Key)
        })
      });
      assert.equal(callback.response.status, 200);
      assert.equal(callback.text, "success");

      const balance = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(balance.payload.balanceCredits, 5000);
      assert.equal(balance.payload.planId, "professional");
    }, {
      env: {
        WECHAT_MCH_ID: "1113492162",
        WECHAT_APP_ID: "wx92f39a8b81948f51",
        WECHAT_API_V3_KEY: apiV3Key,
        WECHAT_MERCHANT_SERIAL_NO: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
        WECHAT_MERCHANT_PRIVATE_KEY: privateKey,
        WECHAT_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/wechat/notify"
      },
      fetchImpl: async (url, options) => {
        capturedWechatRequest = { url, options };
        return {
          ok: true,
          status: 200,
          json: async () => ({ code_url: "weixin://wxpay/bizpayurl?pr=http-test-token" })
        };
      }
    });
  });

  it("lets admins actively sync a WeChat paid order into the ledger", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const calls = [];
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "wechat-sync-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "yojiro", password: "yojiro123" }
      });
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "professional", credits: 5000, amountCents: 150000 }
      });
      await request(baseUrl, `/v1/orders/${order.payload.id}/payments/wechat/native-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });

      const synced = await request(baseUrl, `/v1/admin/orders/${order.payload.orderNo}/sync-wechat`, {
        method: "POST",
        headers: adminAuth,
        body: {}
      });
      assert.equal(synced.response.status, 200);
      assert.equal(synced.payload.synced, true);
      assert.equal(synced.payload.wechat.tradeState, "SUCCESS");
      assert.equal(synced.payload.settlement.order.status, "paid");

      const balance = await request(baseUrl, "/v1/me/entitlements", { headers: auth });
      assert.equal(balance.payload.balanceCredits, 5000);
      assert.equal(balance.payload.planId, "professional");

      const duplicate = await request(baseUrl, `/v1/admin/orders/${order.payload.id}/sync-wechat`, {
        method: "POST",
        headers: adminAuth,
        body: {}
      });
      assert.equal(duplicate.response.status, 200);
      assert.equal(duplicate.payload.settlement.idempotentReplay, true);
    }, {
      env: {
        WECHAT_MCH_ID: "1113492162",
        WECHAT_APP_ID: "wx92f39a8b81948f51",
        WECHAT_API_V3_KEY: "0123456789abcdef0123456789abcdef",
        WECHAT_MERCHANT_SERIAL_NO: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
        WECHAT_MERCHANT_PRIVATE_KEY: privateKey,
        WECHAT_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/wechat/notify"
      },
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, options });
        if (url.endsWith("/v3/pay/transactions/native")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ code_url: "weixin://wxpay/bizpayurl?pr=sync-test-token" })
          };
        }
        if (url.includes("/v3/pay/transactions/out-trade-no/000000000001?mchid=1113492162")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              mchid: "1113492162",
              out_trade_no: "000000000001",
              transaction_id: "420000000020260603000011",
              trade_state: "SUCCESS",
              success_time: "2026-06-03T15:20:00+08:00",
              amount: { total: 150000, currency: "CNY" }
            })
          };
        }
        throw new Error(`unexpected wechat fetch ${url}`);
      }
    });

    assert.equal(calls.filter((call) => call.url.includes("/v3/pay/transactions/out-trade-no/")).length, 2);
  });

  it("shows user order status and closes WeChat Native payment orders on cancel", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const calls = [];
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "wechat-close-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "professional", credits: 5000, amountCents: 150000 }
      });
      assert.equal(order.response.status, 201);
      assert.match(order.payload.expiresAt, /^20/);

      const payment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/wechat/native-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(payment.response.status, 200);

      const status = await request(baseUrl, `/v1/orders/${order.payload.id}`, { headers: auth });
      assert.equal(status.response.status, 200);
      assert.equal(status.payload.paymentProvider, "wechat");
      assert.equal(status.payload.status, "created");
      assert.equal(status.payload.expiresAt, order.payload.expiresAt);

      const closed = await request(baseUrl, `/v1/orders/${order.payload.id}/close`, {
        method: "POST",
        headers: auth,
        body: { reason: "canceled" }
      });
      assert.equal(closed.response.status, 200);
      assert.equal(closed.payload.status, "canceled");
      assert.ok(closed.payload.closedAt);

      const rejectedPayment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/wechat/native-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(rejectedPayment.response.status, 409);
    }, {
      env: {
        WECHAT_MCH_ID: "1113492162",
        WECHAT_APP_ID: "wx92f39a8b81948f51",
        WECHAT_API_V3_KEY: "0123456789abcdef0123456789abcdef",
        WECHAT_MERCHANT_SERIAL_NO: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
        WECHAT_MERCHANT_PRIVATE_KEY: privateKey,
        WECHAT_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/wechat/notify"
      },
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, options });
        if (url.endsWith("/v3/pay/transactions/native")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ code_url: "weixin://wxpay/bizpayurl?pr=close-test-token" })
          };
        }
        if (url.endsWith("/v3/pay/transactions/out-trade-no/000000000001/close")) {
          return {
            ok: true,
            status: 204,
            json: async () => ({})
          };
        }
        throw new Error(`unexpected wechat fetch ${url}`);
      }
    });

    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /\/v3\/pay\/transactions\/out-trade-no\/000000000001\/close$/);
  });

  it("still calls WeChat close before expiring a locally timed-out Native order", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    let now = new Date("2026-06-03T07:20:00.000Z");
    const store = createCloudStore();
    store.now = () => now;
    const runtime = createMemoryRuntime({ store });
    const calls = [];

    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "wechat-expired-close-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "professional", credits: 5000, amountCents: 150000 }
      });
      const payment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/wechat/native-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(payment.response.status, 200);

      now = new Date("2026-06-03T07:26:00.000Z");
      const closed = await request(baseUrl, `/v1/orders/${order.payload.id}/close`, {
        method: "POST",
        headers: auth,
        body: { reason: "expired" }
      });

      assert.equal(closed.response.status, 200);
      assert.equal(closed.payload.status, "expired");
    }, {
      runtime,
      env: {
        WECHAT_MCH_ID: "1113492162",
        WECHAT_APP_ID: "wx92f39a8b81948f51",
        WECHAT_API_V3_KEY: "0123456789abcdef0123456789abcdef",
        WECHAT_MERCHANT_SERIAL_NO: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
        WECHAT_MERCHANT_PRIVATE_KEY: privateKey,
        WECHAT_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/wechat/notify"
      },
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, options });
        if (url.endsWith("/v3/pay/transactions/native")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ code_url: "weixin://wxpay/bizpayurl?pr=expired-close-token" })
          };
        }
        if (url.endsWith("/v3/pay/transactions/out-trade-no/000000000001/close")) {
          return {
            ok: true,
            status: 204,
            json: async () => ({})
          };
        }
        throw new Error(`unexpected wechat fetch ${url}`);
      }
    });

    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /\/v3\/pay\/transactions\/out-trade-no\/000000000001\/close$/);
  });

  it("lists the current user's orders and times out slow WeChat close calls without locally closing", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    let closeSignal;
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "wechat-close-timeout-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "professional", credits: 5000, amountCents: 150000 }
      });
      await request(baseUrl, `/v1/orders/${order.payload.id}/payments/wechat/native-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });

      const closed = await request(baseUrl, `/v1/orders/${order.payload.id}/close`, {
        method: "POST",
        headers: auth,
        body: { reason: "canceled" }
      });
      assert.equal(closed.response.status, 504);
      assert.equal(closed.payload.error, "WECHAT_CLOSE_ORDER_TIMEOUT");

      const status = await request(baseUrl, `/v1/orders/${order.payload.id}`, { headers: auth });
      assert.equal(status.payload.status, "created");
      assert.equal(status.payload.closedAt, null);
      assert.equal(closeSignal.aborted, true);

      const history = await request(baseUrl, "/v1/orders", { headers: auth });
      assert.equal(history.response.status, 200);
      assert.equal(history.payload.items.length, 1);
      assert.equal(history.payload.items[0].orderNo, order.payload.orderNo);
      assert.equal(history.payload.items[0].status, "created");
    }, {
      env: {
        WECHAT_MCH_ID: "1113492162",
        WECHAT_APP_ID: "wx92f39a8b81948f51",
        WECHAT_API_V3_KEY: "0123456789abcdef0123456789abcdef",
        WECHAT_MERCHANT_SERIAL_NO: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
        WECHAT_MERCHANT_PRIVATE_KEY: privateKey,
        WECHAT_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/wechat/notify",
        WECHAT_CLOSE_TIMEOUT_MS: "25"
      },
      fetchImpl: async (url, options = {}) => {
        if (url.endsWith("/v3/pay/transactions/native")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ code_url: "weixin://wxpay/bizpayurl?pr=timeout-close-token" })
          };
        }
        if (url.endsWith("/v3/pay/transactions/out-trade-no/000000000001/close")) {
          closeSignal = options.signal;
          return new Promise(() => {});
        }
        throw new Error(`unexpected wechat fetch ${url}`);
      }
    });
  });

  it("times out slow WeChat Native payment creation without marking the order provider", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    let nativeSignal;
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "wechat-native-timeout-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const order = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "professional", credits: 5000, amountCents: 150000 }
      });

      const payment = await request(baseUrl, `/v1/orders/${order.payload.id}/payments/wechat/native-pay`, {
        method: "POST",
        headers: auth,
        body: {}
      });
      assert.equal(payment.response.status, 504);
      assert.equal(payment.payload.error, "WECHAT_NATIVE_PAY_TIMEOUT");
      assert.equal(nativeSignal.aborted, true);

      const status = await request(baseUrl, `/v1/orders/${order.payload.id}`, { headers: auth });
      assert.equal(status.payload.status, "created");
      assert.equal(status.payload.paymentProvider, "manual");
    }, {
      env: {
        WECHAT_MCH_ID: "1113492162",
        WECHAT_APP_ID: "wx92f39a8b81948f51",
        WECHAT_API_V3_KEY: "0123456789abcdef0123456789abcdef",
        WECHAT_MERCHANT_SERIAL_NO: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
        WECHAT_MERCHANT_PRIVATE_KEY: privateKey,
        WECHAT_NOTIFY_URL: "https://api.addwhatsapp.com/v1/payments/wechat/notify",
        WECHAT_NATIVE_PAY_TIMEOUT_MS: "25"
      },
      fetchImpl: async (url, options = {}) => {
        if (url.endsWith("/v3/pay/transactions/native")) {
          nativeSignal = options.signal;
          return new Promise(() => {});
        }
        throw new Error(`unexpected wechat fetch ${url}`);
      }
    });
  });

  it("lists payment events for admins with filters and pagination", async () => {
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "payment-events-user", password: "StrongPass123", planId: "advanced" }
      });
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "yojiro", password: "yojiro123" }
      });
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };
      const firstOrder = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });
      const secondOrder = await request(baseUrl, "/v1/orders", {
        method: "POST",
        headers: auth,
        body: { planId: "advanced", credits: 2000, amountCents: 60000 }
      });

      await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        headers: adminAuth,
        body: {
          provider: "manual",
          providerEventId: "manual-paid-list-1",
          orderId: firstOrder.payload.id,
          eventType: "payment_succeeded",
          providerTradeNo: "manual-list-1"
        }
      });
      await request(baseUrl, "/v1/payments/events", {
        method: "POST",
        headers: adminAuth,
        body: {
          provider: "mock_alipay",
          providerEventId: "mock-pending-list-1",
          orderId: secondOrder.payload.id,
          eventType: "payment_ignored",
          providerTradeNo: "mock-list-1"
        }
      });

      const rejected = await request(baseUrl, "/v1/admin/payment-events");
      assert.equal(rejected.response.status, 401);

      const pending = await request(baseUrl, "/v1/admin/payment-events?processed=pending&provider=mock_alipay&limit=1&offset=0", {
        headers: adminAuth
      });
      assert.equal(pending.response.status, 200);
      assert.equal(pending.payload.total, 1);
      assert.equal(pending.payload.items.length, 1);
      assert.equal(pending.payload.items[0].provider, "mock_alipay");
      assert.equal(pending.payload.items[0].processedAt, null);

      const searched = await request(baseUrl, "/v1/admin/payment-events?q=manual-paid&eventType=payment_succeeded", {
        headers: adminAuth
      });
      assert.equal(searched.response.status, 200);
      assert.equal(searched.payload.total, 1);
      assert.equal(searched.payload.items[0].providerEventId, "manual-paid-list-1");
    });
  });

  it("stores desktop contact imports for admin audit and artifact downloads", async () => {
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "import-user", password: "StrongPass123", planId: "advanced" }
      });
      assert.equal(registered.response.status, 201);
      const auth = { authorization: `Bearer ${registered.payload.accessToken}` };
      const original = Buffer.from("raw workbook bytes");
      const originalSha256 = crypto.createHash("sha256").update(original).digest("hex");
      const parsedRows = [
        {
          rowNumber: 2,
          status: "valid",
          e164: "+15551234567",
          countryIso: "US",
          language: "en",
          source: { phone: "5551234567", country: "US", 姓名: "客户名" }
        }
      ];

      const created = await request(baseUrl, "/v1/contact-imports", {
        method: "POST",
        headers: auth,
        body: {
          originalFileName: "1000条(1)(1).xlsx",
          originalFormat: "xlsx",
          originalMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          originalSizeBytes: original.length,
          originalSha256,
          originalBase64: original.toString("base64"),
          columns: { phoneColumn: "phone", countryColumn: "country", languageColumn: "language" },
          stats: { total: 1, valid: 1, invalid: 0 },
          importOptions: { skipChinaNumbers: true },
          parsedRowsGzipBase64: zlib.gzipSync(JSON.stringify(parsedRows)).toString("base64")
        }
      });
      assert.equal(created.response.status, 201);
      assert.equal(created.payload.originalFormat, "xlsx");
      assert.equal(created.payload.parsedRowCount, 1);

      const rejectedList = await request(baseUrl, "/v1/admin/contact-imports");
      assert.equal(rejectedList.response.status, 401);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "yojiro", password: "yojiro123" }
      });
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };

      const list = await request(baseUrl, "/v1/admin/contact-imports?q=import-user", { headers: adminAuth });
      assert.equal(list.response.status, 200);
      assert.equal(list.payload.total, 1);
      assert.equal(list.payload.items[0].account, "import-user");
      assert.equal(list.payload.items[0].originalFileName, "1000条(1)(1).xlsx");
      assert.equal(list.payload.items[0].originalSha256, originalSha256);

      const originalDownload = await requestText(baseUrl, `/v1/admin/contact-imports/${created.payload.id}/download?kind=original`, {
        headers: adminAuth
      });
      assert.equal(originalDownload.response.status, 200);
      assert.equal(originalDownload.text, "raw workbook bytes");
      assert.match(originalDownload.response.headers.get("content-disposition"), /filename\*=UTF-8''1000%E6%9D%A1\(1\)\(1\)\.xlsx/);

      const parsedDownload = await requestText(baseUrl, `/v1/admin/contact-imports/${created.payload.id}/download?kind=parsed`, {
        headers: adminAuth
      });
      assert.equal(parsedDownload.response.status, 200);
      assert.match(parsedDownload.response.headers.get("content-type"), /text\/csv/);
      assert.match(parsedDownload.response.headers.get("content-disposition"), /filename\*=UTF-8''1000%E6%9D%A1\(1\)\(1\)-parsed\.csv/);
      assert.match(parsedDownload.text, /rowNumber,status,e164,countryIso,language,source_phone,source_country,source_姓名/);
      assert.match(parsedDownload.text, /\t\+15551234567/);
      assert.match(parsedDownload.text, /\t5551234567/);
      assert.match(parsedDownload.text, /客户名/);

      const parsedBytes = await requestBuffer(baseUrl, `/v1/admin/contact-imports/${created.payload.id}/download?kind=parsed`, {
        headers: adminAuth
      });
      assert.deepEqual([...parsedBytes.buffer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    });
  });

  it("routes through an async billing runtime instead of a hard-coded memory store", async () => {
    const runtime = {
      mode: "test-runtime",
      authenticateAdminToken: async () => "admin-test",
      getAdminConsoleSnapshot: async () => ({
        source: "test-runtime",
        summary: { users: 9 },
        modules: { users: { records: [["runtime-user", "active", "PLUS", "test"]] } },
        actionQueue: [],
        auditTrail: []
      })
    };

    await withServer(async (baseUrl) => {
      const health = await request(baseUrl, "/v1/health");
      assert.equal(health.payload.mode, "test-runtime");

      const rejectedConsoleSnapshot = await request(baseUrl, "/v1/admin/console");
      assert.equal(rejectedConsoleSnapshot.response.status, 401);

      const consoleSnapshot = await request(baseUrl, "/v1/admin/console", {
        headers: { authorization: "Bearer admin-test-token" }
      });
      assert.equal(consoleSnapshot.payload.source, "test-runtime");
      assert.equal(consoleSnapshot.payload.summary.users, 9);
    }, { runtime });
  });

  it("lets admins freeze users and release abnormal workspace leases with audit logs", async () => {
    await withServer(async (baseUrl) => {
      const registered = await request(baseUrl, "/v1/auth/register", {
        method: "POST",
        body: { username: "ops-user", password: "StrongPass123", planId: "advanced" }
      });
      assert.equal(registered.response.status, 201);
      const userAuth = { authorization: `Bearer ${registered.payload.accessToken}` };

      const lease = await request(baseUrl, "/v1/workspaces/leases", {
        method: "POST",
        headers: userAuth,
        body: { deviceId: "ops-device", workspaceKind: "secondary", processNonce: "ops-nonce" }
      });
      assert.equal(lease.response.status, 201);

      const adminLogin = await request(baseUrl, "/v1/admin/auth/login", {
        method: "POST",
        body: { username: "yojiro", password: "yojiro123" }
      });
      const adminAuth = { authorization: `Bearer ${adminLogin.payload.adminAccessToken}` };
      const consoleSnapshot = await request(baseUrl, "/v1/admin/console", { headers: adminAuth });
      const opsUserRow = consoleSnapshot.payload.modules.users.records.find((row) => row[2] === "ops-user");
      assert.ok(opsUserRow);
      assert.match(opsUserRow[1], /^\d{8}$/);

      const releasedLease = await request(baseUrl, `/v1/admin/workspaces/leases/${lease.payload.leaseId}/release`, {
        method: "POST",
        headers: adminAuth,
        body: { reason: "stale process cleanup" }
      });
      assert.equal(releasedLease.response.status, 200);
      assert.equal(releasedLease.payload.status, "released");

      const frozen = await request(baseUrl, `/v1/admin/users/${opsUserRow[1]}/status`, {
        method: "POST",
        headers: adminAuth,
        body: { status: "frozen", reason: "risk review" }
      });
      assert.equal(frozen.response.status, 200);
      assert.equal(frozen.payload.status, "frozen");

      const rejectedEntitlements = await request(baseUrl, "/v1/me/entitlements", { headers: userAuth });
      assert.equal(rejectedEntitlements.response.status, 401);

      const audit = await request(baseUrl, "/v1/admin/audit-logs", { headers: adminAuth });
      assert.equal(audit.response.status, 200);
      assert.ok(audit.payload.items.some((entry) => entry.action === "workspace.release"));
      assert.ok(audit.payload.items.some((entry) => entry.action === "user.status_update"));
    });
  });

  it("selects the PostgreSQL runtime when DATABASE_URL is configured", async () => {
    const runtime = createRuntimeFromEnv({ DATABASE_URL: "postgres://user:pass@127.0.0.1:5432/addwhatsapp" });

    assert.equal(runtime.mode, "postgres");
    await runtime.close();
  });
});
