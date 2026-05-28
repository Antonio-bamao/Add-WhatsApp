import http from "node:http";
import { createPostgresRuntime } from "./db/postgresRuntime.js";
import { createMemoryRuntime } from "./services/billingService.js";

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

function errorStatus(error) {
  if (/ADMIN_FORBIDDEN/.test(error.message)) return 403;
  if (/UNAUTHORIZED|AUTH_FAILED/.test(error.message)) return 401;
  if (/NOT_FOUND/.test(error.message)) return 404;
  if (/LIMIT|INSUFFICIENT|NO_AVAILABLE/.test(error.message)) return 409;
  if (/INVALID|REQUIRED|WEAK|EXISTS/.test(error.message)) return 400;
  return 500;
}

export function createAppServer(options = {}) {
  const runtime = options.runtime || createMemoryRuntime(options);

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

      if (request.method === "POST" && /^\/v1\/admin\/orders\/[^/]+\/mark-paid$/.test(url.pathname)) {
        const adminUserId = await authAdminId(runtime, request);
        const orderId = url.pathname.split("/")[4];
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.markOrderPaid({ ...body, orderId, adminUserId, ip: clientIp(request) }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/admin/credits/adjust") {
        const adminUserId = await authAdminId(runtime, request);
        const body = await readJson(request);
        jsonResponse(response, 200, await runtime.adjustCredits({ ...body, adminUserId, ip: clientIp(request) }));
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
      jsonResponse(response, errorStatus(error), { error: error.message });
    }
  });
}

export function createRuntimeFromEnv(env = process.env) {
  if (env.DATABASE_URL) {
    return createPostgresRuntime({ databaseUrl: env.DATABASE_URL });
  }
  return createMemoryRuntime();
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  const port = Number(process.env.PORT || 4110);
  const runtime = createRuntimeFromEnv();
  createAppServer({ runtime }).listen(port, "127.0.0.1", () => {
    console.log(`Add WhatsApp server listening at http://127.0.0.1:${port} (${runtime.mode})`);
  });
}
