import http from "node:http";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import dns from "node:dns";

const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const wechatDomains = [
    "api.mch.weixin.qq.com",
    "apihk.mch.weixin.qq.com",
    "apius.mch.weixin.qq.com",
    "apieu.mch.weixin.qq.com"
  ];
  if (wechatDomains.includes(hostname)) {
    const opts = Object.assign({}, options, { family: 4 });
    return originalLookup(hostname, opts, callback);
  }
  return originalLookup(hostname, options, callback);
};
import { createPostgresRuntime } from "./db/postgresRuntime.js";
import { createMemoryRuntime } from "./services/billingService.js";
import { buildAlipayPagePayRequest, buildWechatNativePayRequest, buildZpayPagePayRequest, parseAlipayNotification, parseMockAlipayNotification, parseWechatNotification, parseZpayNotification, queryAlipayTrade } from "./services/paymentProviders.js";

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

function textResponse(response, statusCode, text) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  });
  response.end(text);
}

async function readText(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(request) {
  const text = await readText(request);
  return text ? JSON.parse(text) : {};
}

async function readFormOrJson(request) {
  const text = await readText(request);
  if (!text) return {};
  if (String(request.headers["content-type"] || "").includes("application/json")) {
    return JSON.parse(text);
  }
  return Object.fromEntries(new URLSearchParams(text).entries());
}

async function authUserId(runtime, request) {
  const header = request.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new Error("UNAUTHORIZED");
  return runtime.authenticateAccessToken(match[1]);
}

async function authAdminId(runtime, request) {
  const header = request.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new Error("ADMIN_UNAUTHORIZED");
  return runtime.authenticateAdminToken(match[1]);
}

function clientIp(request) {
  return request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket.remoteAddress || "127.0.0.1";
}

function manualPaymentInstructions(order, env = {}) {
  return {
    provider: "manual",
    orderId: order.id,
    orderNo: order.orderNo,
    planId: order.planId,
    credits: order.credits,
    amountCents: order.amountCents,
    amountYuan: (Number(order.amountCents || 0) / 100).toFixed(2),
    paymentNote: `${env.MANUAL_PAYMENT_NOTE_PREFIX || "ADWA"}-${order.orderNo}`,
    alipayQrImageUrl: env.MANUAL_PAYMENT_ALIPAY_QR_URL || "",
    wechatQrImageUrl: env.MANUAL_PAYMENT_WECHAT_QR_URL || "",
    contactText: env.MANUAL_PAYMENT_CONTACT || ""
  };
}

function readEnvFileValue(value, filePath) {
  if (value) return value;
  if (!filePath) return "";
  return fs.readFileSync(filePath, "utf8");
}

function errorStatus(error) {
  if (/ADMIN_FORBIDDEN/.test(error.message)) return 403;
  if (/SIGNATURE/.test(error.message)) return 401;
  if (/UNAUTHORIZED|AUTH_FAILED|NOT_ACTIVE/.test(error.message)) return 401;
  if (/NOT_FOUND/.test(error.message)) return 404;
  if (/LIMIT|INSUFFICIENT|NO_AVAILABLE|ALREADY_PAID|CLOSED/.test(error.message)) return 409;
  if (/INVALID|REQUIRED|WEAK|EXISTS/.test(error.message)) return 400;
  return 500;
}

export function createAppServer(options = {}) {
  const runtime = options.runtime || createMemoryRuntime(options);
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        jsonResponse(response, 204, {});
        return;
      }

      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/v1/health") {
        jsonResponse(response, 200, { ok: true, service: "add-whatsapp-server", mode: runtime.mode });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/admin/console") {
        jsonResponse(response, 200, await runtime.getAdminConsoleSnapshot());
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/admin/payment-events") {
        await authAdminId(runtime, request);
        jsonResponse(response, 200, await runtime.listPaymentEvents(Object.fromEntries(url.searchParams.entries())));
        return;
      }

      if (request.method === "GET" && /^\/v1\/admin\/alipay\/trades\/[^/]+\/query$/.test(url.pathname)) {
        await authAdminId(runtime, request);
        const orderNo = decodeURIComponent(url.pathname.split("/")[5]);
        jsonResponse(response, 200, await queryAlipayTrade(orderNo, {
          appId: env.ALIPAY_APP_ID,
          appPrivateKey: env.ALIPAY_APP_PRIVATE_KEY,
          gatewayUrl: env.ALIPAY_GATEWAY_URL
        }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/register") {
        const body = await readJson(request);
        const user = await runtime.registerUser(body);
        const session = await runtime.loginUser({ username: body.username, password: body.password, deviceId: body.deviceId || "registered-device" });
        jsonResponse(response, 201, { user, accessToken: session.accessToken, refreshToken: session.refreshToken });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/login") {
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.loginUser(body));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/admin/auth/login") {
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.loginAdmin(body));
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/me/entitlements") {
        const userId = await authUserId(runtime, request);
        jsonResponse(response, 200, await runtime.getEntitlements(userId));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/credits/consume") {
        const userId = await authUserId(runtime, request);
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.consumeCredit({ ...body, userId }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/orders") {
        const userId = await authUserId(runtime, request);
        const body = await readJson(request);
        jsonResponse(response, 201, await runtime.createOrder({ ...body, userId }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/orders\/[^/]+\/payments\/alipay\/page-pay$/.test(url.pathname)) {
        const userId = await authUserId(runtime, request);
        const orderId = url.pathname.split("/")[3];
        const order = await runtime.getOrderForPayment({ userId, orderId });
        jsonResponse(response, 200, buildAlipayPagePayRequest(order, {
          appId: env.ALIPAY_APP_ID,
          appPrivateKey: env.ALIPAY_APP_PRIVATE_KEY,
          notifyUrl: env.ALIPAY_NOTIFY_URL,
          returnUrl: env.ALIPAY_RETURN_URL,
          gatewayUrl: env.ALIPAY_GATEWAY_URL,
          qrPayMode: env.ALIPAY_QR_PAY_MODE,
          qrcodeWidth: env.ALIPAY_QRCODE_WIDTH,
          timestamp: env.ALIPAY_FIXED_TIMESTAMP
        }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/orders\/[^/]+\/payments\/zpay\/page-pay$/.test(url.pathname)) {
        const userId = await authUserId(runtime, request);
        const orderId = url.pathname.split("/")[3];
        const order = await runtime.getOrderForPayment({ userId, orderId });
        jsonResponse(response, 200, buildZpayPagePayRequest(order, {
          gatewayUrl: env.ZPAY_GATEWAY_URL,
          pid: env.ZPAY_PID,
          key: env.ZPAY_KEY,
          notifyUrl: env.ZPAY_NOTIFY_URL,
          returnUrl: env.ZPAY_RETURN_URL,
          type: env.ZPAY_TYPE || "wxpay",
          siteName: env.ZPAY_SITE_NAME || "Add WhatsApp",
          channelId: env.ZPAY_CHANNEL_ID
        }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/orders\/[^/]+\/payments\/wechat\/native-pay$/.test(url.pathname)) {
        const userId = await authUserId(runtime, request);
        const orderId = url.pathname.split("/")[3];
        const order = await runtime.getOrderForPayment({ userId, orderId });
        jsonResponse(response, 200, await buildWechatNativePayRequest(order, {
          gatewayUrl: env.WECHAT_GATEWAY_URL,
          mchId: env.WECHAT_MCH_ID,
          appId: env.WECHAT_APP_ID,
          apiV3Key: env.WECHAT_API_V3_KEY,
          merchantSerialNo: env.WECHAT_MERCHANT_SERIAL_NO,
          merchantPrivateKey: readEnvFileValue(env.WECHAT_MERCHANT_PRIVATE_KEY, env.WECHAT_MERCHANT_PRIVATE_KEY_PATH),
          notifyUrl: env.WECHAT_NOTIFY_URL,
          fetchImpl
        }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/orders\/[^/]+\/payments\/manual$/.test(url.pathname)) {
        const userId = await authUserId(runtime, request);
        const orderId = url.pathname.split("/")[3];
        const order = await runtime.getOrderForPayment({ userId, orderId });
        jsonResponse(response, 200, manualPaymentInstructions(order, env));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/payments/events") {
        await authAdminId(runtime, request);
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.processPaymentEvent(body));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/payments/mock-alipay/notify") {
        const body = await readJson(request);
        const event = parseMockAlipayNotification(body, { secret: env.MOCK_ALIPAY_WEBHOOK_SECRET });
        jsonResponse(response, 200, await runtime.processPaymentEvent(event));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/payments/alipay/notify") {
        const body = await readFormOrJson(request);
        const event = parseAlipayNotification(body, {
          alipayPublicKey: env.ALIPAY_PUBLIC_KEY,
          expectedAppId: env.ALIPAY_APP_ID
        });
        await runtime.processPaymentEvent(event);
        textResponse(response, 200, "success");
        return;
      }

      if ((request.method === "GET" || request.method === "POST") && url.pathname === "/v1/payments/zpay/notify") {
        const body = request.method === "GET"
          ? Object.fromEntries(url.searchParams.entries())
          : await readFormOrJson(request);
        const event = parseZpayNotification(body, {
          key: env.ZPAY_KEY,
          expectedPid: env.ZPAY_PID
        });
        await runtime.processPaymentEvent(event);
        textResponse(response, 200, "success");
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/payments/wechat/notify") {
        const body = await readJson(request);
        const event = parseWechatNotification(body, {
          apiV3Key: env.WECHAT_API_V3_KEY,
          expectedMchId: env.WECHAT_MCH_ID,
          expectedAppId: env.WECHAT_APP_ID
        });
        await runtime.processPaymentEvent(event);
        textResponse(response, 200, "success");
        return;
      }

      if (request.method === "POST" && /^\/v1\/admin\/orders\/[^/]+\/mark-paid$/.test(url.pathname)) {
        const adminUserId = await authAdminId(runtime, request);
        const orderId = url.pathname.split("/")[4];
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.markOrderPaid({ ...body, orderId, adminUserId, ip: clientIp(request) }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/admin/orders/compensate") {
        await authAdminId(runtime, request);
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.processPendingOrderCredits(body));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/admin/credits/adjust") {
        const adminUserId = await authAdminId(runtime, request);
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.adjustCredits({ ...body, adminUserId, ip: clientIp(request) }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/admin\/users\/[^/]+\/status$/.test(url.pathname)) {
        const adminUserId = await authAdminId(runtime, request);
        const userId = url.pathname.split("/")[4];
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.setUserStatus({ ...body, userId, adminUserId, ip: clientIp(request) }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/admin\/workspaces\/leases\/[^/]+\/release$/.test(url.pathname)) {
        const adminUserId = await authAdminId(runtime, request);
        const leaseId = url.pathname.split("/")[5];
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.adminReleaseWorkspaceLease({ ...body, leaseId, adminUserId, ip: clientIp(request) }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/workspaces/leases") {
        const userId = await authUserId(runtime, request);
        const body = await readJson(request);
        jsonResponse(response, 201, await runtime.issueWorkspaceLease({ ...body, userId }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/workspaces\/leases\/[^/]+\/renew$/.test(url.pathname)) {
        const userId = await authUserId(runtime, request);
        const leaseId = url.pathname.split("/")[4];
        jsonResponse(response, 200, await runtime.renewWorkspaceLease({ userId, leaseId }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/workspaces\/leases\/[^/]+\/release$/.test(url.pathname)) {
        const userId = await authUserId(runtime, request);
        const leaseId = url.pathname.split("/")[4];
        jsonResponse(response, 200, await runtime.releaseWorkspaceLease({ userId, leaseId }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/admin/audit-logs") {
        await authAdminId(runtime, request);
        jsonResponse(response, 200, { items: await runtime.listAuditLogs() });
        return;
      }

      jsonResponse(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      console.error("API error details:", error, "cause:", error.cause);
      let causeText = undefined;
      const primaryCause = error.cause || error;
      if (primaryCause && (primaryCause instanceof AggregateError || Array.isArray(primaryCause.errors))) {
        causeText = `AggregateError: [${primaryCause.errors.map(e => e.message || String(e)).join(", ")}]`;
      } else if (error.cause) {
        causeText = error.cause.message || String(error.cause);
      }
      jsonResponse(response, errorStatus(error), {
        error: error.message,
        cause: causeText
      });
    }
  });
}

export function createRuntimeFromEnv(env = process.env) {
  if (env.DATABASE_URL) {
    return createPostgresRuntime({ databaseUrl: env.DATABASE_URL });
  }
  return createMemoryRuntime();
}

function argvPathToFileUrl(argvPath) {
  const normalized = String(argvPath || "").replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(normalized)) return `file:///${normalized}`;
  if (normalized.startsWith("/")) return `file://${normalized}`;
  return pathToFileURL(argvPath).href;
}

export function isDirectRun(moduleUrl = import.meta.url, argvPath = process.argv[1]) {
  return Boolean(argvPath) && moduleUrl === argvPathToFileUrl(argvPath);
}

if (isDirectRun()) {
  const port = Number(process.env.PORT || 4110);
  const runtime = createRuntimeFromEnv();
  createAppServer({ runtime }).listen(port, "127.0.0.1", () => {
    console.log(`Add WhatsApp server listening at http://127.0.0.1:${port} (${runtime.mode})`);
  });
}
