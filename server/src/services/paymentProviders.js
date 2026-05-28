import crypto from "node:crypto";

function canonicalizePayload(payload) {
  return Object.keys(payload)
    .filter((key) => key !== "sign" && key !== "signature")
    .sort()
    .map((key) => `${key}=${String(payload[key] ?? "")}`)
    .join("&");
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left), "hex");
  const rightBuffer = Buffer.from(String(right), "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
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
  const publicPayload = { ...payload };
  delete publicPayload.sign;
  delete publicPayload.signature;

  return {
    provider: "mock_alipay",
    providerEventId: `mock_alipay:${payload.notify_id || payload.trade_no}:${tradeStatus || "UNKNOWN"}`,
    orderNo: payload.out_trade_no,
    eventType: successful ? "payment_succeeded" : "payment_ignored",
    providerTradeNo: payload.trade_no,
    payload: publicPayload
  };
}
