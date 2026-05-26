import http from "node:http";
import {
  adjustCredits,
  authenticateAccessToken,
  consumeCredit,
  createCloudStore,
  createOrder,
  getEntitlements,
  issueWorkspaceLease,
  listAuditLogs,
  loginUser,
  markOrderPaid,
  registerUser
} from "./services/billingService.js";

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function authUserId(store, request) {
  const header = request.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new Error("UNAUTHORIZED");
  return authenticateAccessToken(store, match[1]);
}

function clientIp(request) {
  return request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket.remoteAddress || "127.0.0.1";
}

function errorStatus(error) {
  if (/UNAUTHORIZED|AUTH_FAILED/.test(error.message)) return 401;
  if (/NOT_FOUND/.test(error.message)) return 404;
  if (/LIMIT|INSUFFICIENT|NO_AVAILABLE/.test(error.message)) return 409;
  if (/INVALID|REQUIRED|WEAK|EXISTS/.test(error.message)) return 400;
  return 500;
}

export function createAppServer(options = {}) {
  const store = options.store || createCloudStore(options);

  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        jsonResponse(response, 204, {});
        return;
      }

      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/v1/health") {
        jsonResponse(response, 200, { ok: true, service: "add-whatsapp-server", mode: "local-preview" });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/register") {
        const body = await readJson(request);
        const user = registerUser(store, body);
        const session = loginUser(store, { username: body.username, password: body.password, deviceId: body.deviceId || "registered-device" });
        jsonResponse(response, 201, { user, accessToken: session.accessToken, refreshToken: session.refreshToken });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/login") {
        const body = await readJson(request);
        jsonResponse(response, 200, loginUser(store, body));
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/me/entitlements") {
        const userId = authUserId(store, request);
        jsonResponse(response, 200, getEntitlements(store, userId));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/credits/consume") {
        const userId = authUserId(store, request);
        const body = await readJson(request);
        jsonResponse(response, 200, consumeCredit(store, { ...body, userId }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/orders") {
        const userId = authUserId(store, request);
        const body = await readJson(request);
        jsonResponse(response, 201, createOrder(store, { ...body, userId }));
        return;
      }

      if (request.method === "POST" && /^\/v1\/admin\/orders\/[^/]+\/mark-paid$/.test(url.pathname)) {
        const adminUserId = authUserId(store, request);
        const orderId = url.pathname.split("/")[4];
        const body = await readJson(request);
        jsonResponse(response, 200, markOrderPaid(store, { ...body, orderId, adminUserId, ip: clientIp(request) }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/admin/credits/adjust") {
        const adminUserId = authUserId(store, request);
        const body = await readJson(request);
        jsonResponse(response, 200, adjustCredits(store, { ...body, adminUserId, ip: clientIp(request) }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/workspaces/leases") {
        const userId = authUserId(store, request);
        const body = await readJson(request);
        jsonResponse(response, 201, issueWorkspaceLease(store, { ...body, userId }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/admin/audit-logs") {
        authUserId(store, request);
        jsonResponse(response, 200, { items: listAuditLogs(store) });
        return;
      }

      jsonResponse(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      jsonResponse(response, errorStatus(error), { error: error.message });
    }
  });
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  const port = Number(process.env.PORT || 4110);
  createAppServer().listen(port, "127.0.0.1", () => {
    console.log(`Add WhatsApp server listening at http://127.0.0.1:${port}`);
  });
}
