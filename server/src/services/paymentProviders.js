import crypto from "node:crypto";

function canonicalizePayload(payload) {
  return Object.keys(payload)
    .filter((key) => key !== "sign" && key !== "signature")
    .sort()
    .map((key) => `${key}=${String(payload[key] ?? "")}`)
    .join("&");
}

function canonicalizeAlipayPayload(payload) {
  return Object.keys(payload)
    .filter((key) => key !== "sign" && key !== "sign_type")
    .sort()
    .map((key) => `${key}=${String(payload[key] ?? "")}`)
    .join("&");
}

function formatAlipayTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizePem(value) {
  return String(value || "").replaceAll("\\n", "\n");
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left), "hex");
  const rightBuffer = Buffer.from(String(right), "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function publicPayloadWithoutSignature(payload) {
  const publicPayload = { ...payload };
  delete publicPayload.sign;
  delete publicPayload.signature;
  delete publicPayload.sign_type;
  return publicPayload;
}

export function signMockAlipayPayload(payload, secret) {
  if (!secret) throw new Error("PAYMENT_WEBHOOK_SECRET_REQUIRED");
  return crypto
    .createHmac("sha256", String(secret))
    .update(canonicalizePayload(payload))
    .digest("hex");
}

export function parseMockAlipayNotification(payload, { secret } = {}) {
  if (!secret) throw new Error("PAYMENT_WEBHOOK_SECRET_REQUIRED");
  const signature = payload.sign || payload.signature;
  if (!signature) throw new Error("PAYMENT_SIGNATURE_REQUIRED");
  const expected = signMockAlipayPayload(payload, secret);
  if (!timingSafeEqualText(signature, expected)) throw new Error("PAYMENT_SIGNATURE_INVALID");

  const tradeStatus = String(payload.trade_status || "");
  const successful = ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(tradeStatus);
  const publicPayload = publicPayloadWithoutSignature(payload);

  return {
    provider: "mock_alipay",
    providerEventId: `mock_alipay:${payload.notify_id || payload.trade_no}:${tradeStatus || "UNKNOWN"}`,
    orderNo: payload.out_trade_no,
    eventType: successful ? "payment_succeeded" : "payment_ignored",
    providerTradeNo: payload.trade_no,
    payload: publicPayload
  };
}

export function parseAlipayNotification(payload, { alipayPublicKey, expectedAppId } = {}) {
  if (!alipayPublicKey) throw new Error("ALIPAY_PUBLIC_KEY_REQUIRED");
  const signature = payload.sign;
  if (!signature) throw new Error("PAYMENT_SIGNATURE_REQUIRED");
  if (payload.sign_type !== "RSA2") throw new Error("PAYMENT_SIGN_TYPE_UNSUPPORTED");
  if (expectedAppId && payload.app_id !== expectedAppId) throw new Error("PAYMENT_APP_ID_MISMATCH");

  const signingText = canonicalizeAlipayPayload(payload);
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(signingText),
    normalizePem(alipayPublicKey),
    Buffer.from(String(signature), "base64")
  );
  if (!verified) throw new Error("PAYMENT_SIGNATURE_INVALID");

  const tradeStatus = String(payload.trade_status || "");
  const successful = ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(tradeStatus);

  return {
    provider: "alipay",
    providerEventId: `alipay:${payload.notify_id || payload.trade_no}:${tradeStatus || "UNKNOWN"}`,
    orderNo: payload.out_trade_no,
    eventType: successful ? "payment_succeeded" : "payment_ignored",
    providerTradeNo: payload.trade_no,
    payload: publicPayloadWithoutSignature(payload)
  };
}

export function buildAlipayPagePayRequest(order, options = {}) {
  const appId = String(options.appId || "").trim();
  const appPrivateKey = normalizePem(options.appPrivateKey);
  const notifyUrl = String(options.notifyUrl || "").trim();
  const gatewayUrl = String(options.gatewayUrl || "https://openapi.alipay.com/gateway.do").trim();
  if (!appId) throw new Error("ALIPAY_APP_ID_REQUIRED");
  if (!appPrivateKey) throw new Error("ALIPAY_APP_PRIVATE_KEY_REQUIRED");
  if (!notifyUrl) throw new Error("ALIPAY_NOTIFY_URL_REQUIRED");

  const amountCents = Number(order.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("ORDER_AMOUNT_INVALID");
  const credits = Number(order.credits);
  if (!Number.isInteger(credits) || credits <= 0) throw new Error("ORDER_CREDITS_INVALID");

  const bizContent = {
    out_trade_no: order.orderNo,
    total_amount: (amountCents / 100).toFixed(2),
    subject: `Add WhatsApp ${order.planId} ${credits} credits`,
    product_code: "FAST_INSTANT_TRADE_PAY"
  };
  const params = {
    app_id: appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: options.timestamp || formatAlipayTimestamp(options.now ? new Date(options.now) : new Date()),
    version: "1.0",
    notify_url: notifyUrl,
    biz_content: JSON.stringify(bizContent)
  };
  if (options.returnUrl) params.return_url = String(options.returnUrl);

  params.sign = crypto.sign("RSA-SHA256", Buffer.from(canonicalizeAlipayPayload(params)), appPrivateKey).toString("base64");
  const query = new URLSearchParams(params);
  return {
    provider: "alipay",
    orderId: order.id,
    orderNo: order.orderNo,
    amountCents,
    params,
    paymentUrl: `${gatewayUrl}?${query.toString()}`
  };
}
