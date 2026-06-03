import crypto from "node:crypto";
import { AlipaySdk } from "alipay-sdk";

function canonicalizePayload(payload) {
  return Object.keys(payload)
    .filter((key) => key !== "sign" && key !== "signature")
    .sort()
    .map((key) => `${key}=${String(payload[key] ?? "")}`)
    .join("&");
}

function canonicalizeAlipayPayload(payload) {
  return Object.keys(payload)
    .filter((key) => key !== "sign" && key !== "signature" && key !== "sign_type")
    .sort()
    .map((key) => `${key}=${String(payload[key] ?? "")}`)
    .join("&");
}

function canonicalizeZpayPayload(payload) {
  return Object.keys(payload)
    .filter((key) => key !== "sign" && key !== "sign_type" && payload[key] !== "" && payload[key] !== undefined && payload[key] !== null)
    .sort()
    .map((key) => `${key}=${String(payload[key])}`)
    .join("&");
}

function formatAlipayTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizePem(value) {
  return String(value || "").replaceAll("\\n", "\n");
}

function normalizeWechatPrivateKey(value) {
  const privateKey = normalizePem(value).trim();
  if (!privateKey) throw new Error("WECHAT_MERCHANT_PRIVATE_KEY_REQUIRED");
  return privateKey;
}

function formatWechatTimeExpire(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function alipayKeyType(privateKey) {
  return privateKey.includes("BEGIN PRIVATE KEY") && !privateKey.includes("BEGIN RSA PRIVATE KEY")
    ? "PKCS8"
    : "PKCS1";
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

export function signZpayPayload(payload, key) {
  const merchantKey = String(key || "").trim();
  if (!merchantKey) throw new Error("ZPAY_KEY_REQUIRED");
  return crypto
    .createHash("md5")
    .update(canonicalizeZpayPayload(payload) + merchantKey)
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

export function parseZpayNotification(payload, { key, expectedPid } = {}) {
  const merchantKey = String(key || "").trim();
  if (!merchantKey) throw new Error("ZPAY_KEY_REQUIRED");
  const signature = payload.sign;
  if (!signature) throw new Error("PAYMENT_SIGNATURE_REQUIRED");
  if (payload.sign_type && String(payload.sign_type).toUpperCase() !== "MD5") throw new Error("PAYMENT_SIGN_TYPE_UNSUPPORTED");
  if (expectedPid && String(payload.pid) !== String(expectedPid)) throw new Error("PAYMENT_PID_MISMATCH");
  const expected = signZpayPayload(payload, merchantKey);
  if (!timingSafeEqualText(String(signature).toLowerCase(), expected)) throw new Error("PAYMENT_SIGNATURE_INVALID");

  const tradeStatus = String(payload.trade_status || "");
  const successful = tradeStatus === "TRADE_SUCCESS";
  const publicPayload = publicPayloadWithoutSignature(payload);

  return {
    provider: "zpay",
    providerEventId: `zpay:${payload.trade_no || payload.out_trade_no}:${tradeStatus || "UNKNOWN"}`,
    orderNo: payload.out_trade_no,
    eventType: successful ? "payment_succeeded" : "payment_ignored",
    providerTradeNo: payload.trade_no,
    payload: publicPayload
  };
}

function decryptWechatResource(resource, apiV3Key) {
  const key = String(apiV3Key || "");
  if (Buffer.byteLength(key) !== 32) throw new Error("WECHAT_API_V3_KEY_REQUIRED");
  if (!resource || resource.algorithm !== "AEAD_AES_256_GCM") throw new Error("WECHAT_RESOURCE_UNSUPPORTED");
  const encrypted = Buffer.from(String(resource.ciphertext || ""), "base64");
  if (encrypted.length <= 16) throw new Error("WECHAT_RESOURCE_INVALID");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key), Buffer.from(String(resource.nonce || "")));
  decipher.setAuthTag(authTag);
  if (resource.associated_data) decipher.setAAD(Buffer.from(String(resource.associated_data)));
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
}

export function parseWechatNotification(payload, { apiV3Key, expectedMchId, expectedAppId } = {}) {
  const decrypted = decryptWechatResource(payload.resource, apiV3Key);
  if (expectedMchId && String(decrypted.mchid) !== String(expectedMchId)) throw new Error("WECHAT_MCH_ID_MISMATCH");
  if (expectedAppId && String(decrypted.appid) !== String(expectedAppId)) throw new Error("WECHAT_APP_ID_MISMATCH");
  const eventType = String(payload.event_type || decrypted.trade_state || "UNKNOWN");
  const successful = eventType === "TRANSACTION.SUCCESS" && String(decrypted.trade_state || "") === "SUCCESS";

  return {
    provider: "wechat",
    providerEventId: `wechat:${payload.id || decrypted.transaction_id || decrypted.out_trade_no}:${eventType}`,
    orderNo: decrypted.out_trade_no,
    eventType: successful ? "payment_succeeded" : "payment_ignored",
    providerTradeNo: decrypted.transaction_id,
    payload: decrypted
  };
}

function signWechatRequest({ method, pathname, body, timestamp, nonce, privateKey }) {
  const signingText = `${method}\n${pathname}\n${timestamp}\n${nonce}\n${body}\n`;
  return crypto.sign("RSA-SHA256", Buffer.from(signingText), normalizeWechatPrivateKey(privateKey)).toString("base64");
}

export async function buildWechatNativePayRequest(order, options = {}) {
  const gatewayUrlOption = options.gatewayUrl ? String(options.gatewayUrl).trim().replace(/\/+$/, "") : "";
  const gateways = gatewayUrlOption 
    ? [gatewayUrlOption]
    : [
        "https://api.mch.weixin.qq.com",
        "https://apihk.mch.weixin.qq.com",
        "https://apius.mch.weixin.qq.com",
        "https://apieu.mch.weixin.qq.com"
      ];
  const mchId = String(options.mchId || "").trim();
  const appId = String(options.appId || "").trim();
  const apiPath = "/v3/pay/transactions/native";
  const merchantSerialNo = String(options.merchantSerialNo || "").trim();
  const merchantPrivateKey = normalizeWechatPrivateKey(options.merchantPrivateKey);
  const notifyUrl = String(options.notifyUrl || "").trim();
  if (!mchId) throw new Error("WECHAT_MCH_ID_REQUIRED");
  if (!appId) throw new Error("WECHAT_APP_ID_REQUIRED");
  if (!merchantSerialNo) throw new Error("WECHAT_MERCHANT_SERIAL_NO_REQUIRED");
  if (!notifyUrl) throw new Error("WECHAT_NOTIFY_URL_REQUIRED");

  const amountCents = Number(order.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("ORDER_AMOUNT_INVALID");
  const credits = Number(order.credits);
  if (!Number.isInteger(credits) || credits <= 0) throw new Error("ORDER_CREDITS_INVALID");

  const payload = {
    appid: appId,
    mchid: mchId,
    description: String(options.description || `Add WhatsApp ${credits} credits`).slice(0, 127),
    out_trade_no: String(order.orderNo),
    notify_url: notifyUrl,
    amount: {
      total: amountCents,
      currency: "CNY"
    }
  };
  const timeExpire = formatWechatTimeExpire(order.expiresAt || options.expiresAt);
  if (timeExpire) payload.time_expire = timeExpire;
  const body = JSON.stringify(payload);
  const timestamp = String(options.now || Math.floor(Date.now() / 1000));
  const nonce = String(options.nonce || crypto.randomBytes(16).toString("hex"));
  const signature = signWechatRequest({
    method: "POST",
    pathname: apiPath,
    body,
    timestamp,
    nonce,
    privateKey: merchantPrivateKey
  });
  const authorization = [
    `mchid="${mchId}"`,
    `nonce_str="${nonce}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${merchantSerialNo}"`,
    `signature="${signature}"`
  ].join(",");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("WECHAT_FETCH_UNAVAILABLE");

  let lastError;
  let response;
  let responsePayload;

  for (const gateway of gateways) {
    try {
      response = await fetchImpl(`${gateway}${apiPath}`, {
        method: "POST",
        signal: options.signal,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `WECHATPAY2-SHA256-RSA2048 ${authorization}`
        },
        body
      });
      responsePayload = await response.json();
      lastError = null;
      break;
    } catch (err) {
      if (response) {
        lastError = null;
        break;
      }
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  if (!response.ok) {
    throw new Error(`WECHAT_NATIVE_PAY_FAILED:${responsePayload.message || responsePayload.code || response.status}`);
  }
  const codeUrl = String(responsePayload.code_url || "").trim();
  if (!codeUrl) throw new Error("WECHAT_CODE_URL_MISSING");

  return {
    provider: "wechat",
    orderId: order.id,
    orderNo: order.orderNo,
    amountCents,
    codeUrl,
    paymentUrl: codeUrl,
    params: payload
  };
}

export async function buildWechatCloseOrderRequest(order, options = {}) {
  const gatewayUrlOption = options.gatewayUrl ? String(options.gatewayUrl).trim().replace(/\/+$/, "") : "";
  const gateways = gatewayUrlOption
    ? [gatewayUrlOption]
    : [
        "https://api.mch.weixin.qq.com",
        "https://apihk.mch.weixin.qq.com",
        "https://apius.mch.weixin.qq.com",
        "https://apieu.mch.weixin.qq.com"
      ];
  const mchId = String(options.mchId || "").trim();
  const merchantSerialNo = String(options.merchantSerialNo || "").trim();
  const merchantPrivateKey = normalizeWechatPrivateKey(options.merchantPrivateKey);
  const orderNo = String(order?.orderNo || "").trim();
  if (!mchId) throw new Error("WECHAT_MCH_ID_REQUIRED");
  if (!merchantSerialNo) throw new Error("WECHAT_MERCHANT_SERIAL_NO_REQUIRED");
  if (!orderNo) throw new Error("ORDER_NO_REQUIRED");

  const apiPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}/close`;
  const body = JSON.stringify({ mchid: mchId });
  const timestamp = String(options.now || Math.floor(Date.now() / 1000));
  const nonce = String(options.nonce || crypto.randomBytes(16).toString("hex"));
  const signature = signWechatRequest({
    method: "POST",
    pathname: apiPath,
    body,
    timestamp,
    nonce,
    privateKey: merchantPrivateKey
  });
  const authorization = [
    `mchid="${mchId}"`,
    `nonce_str="${nonce}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${merchantSerialNo}"`,
    `signature="${signature}"`
  ].join(",");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("WECHAT_FETCH_UNAVAILABLE");

  let lastError;
  let response;
  let responsePayload = {};
  for (const gateway of gateways) {
    try {
      response = await fetchImpl(`${gateway}${apiPath}`, {
        method: "POST",
        signal: options.signal,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `WECHATPAY2-SHA256-RSA2048 ${authorization}`
        },
        body
      });
      if (response.status !== 204 && typeof response.json === "function") responsePayload = await response.json();
      lastError = null;
      break;
    } catch (err) {
      if (response) {
        lastError = null;
        break;
      }
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  if (!response.ok && response.status !== 204) {
    throw new Error(`WECHAT_CLOSE_ORDER_FAILED:${responsePayload.message || responsePayload.code || response.status}`);
  }
  return { provider: "wechat", orderNo, closed: true };
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
    subject: options.subject || "test",
    product_code: "FAST_INSTANT_TRADE_PAY"
  };
  if (options.qrPayMode !== "off" && (options.qrPayMode || gatewayUrl.includes("sandbox"))) {
    bizContent.qr_pay_mode = String(options.qrPayMode || "4");
    bizContent.qrcode_width = Number(options.qrcodeWidth || 120);
  }

  const sdk = new AlipaySdk({
    appId,
    privateKey: appPrivateKey,
    signType: "RSA2",
    keyType: options.keyType || alipayKeyType(appPrivateKey),
    gateway: gatewayUrl,
    timeout: Number(options.timeout || 20000)
  });
  const pageParams = {
    bizContent,
    notifyUrl,
    timestamp: options.timestamp || formatAlipayTimestamp(options.now ? new Date(options.now) : new Date())
  };
  if (options.returnUrl) pageParams.returnUrl = String(options.returnUrl);
  const paymentUrl = sdk.pageExecute("alipay.trade.page.pay", "GET", pageParams);
  const paymentHtml = sdk.pageExecute("alipay.trade.page.pay", "POST", pageParams);
  const params = Object.fromEntries(new URL(paymentUrl).searchParams.entries());

  return {
    provider: "alipay",
    orderId: order.id,
    orderNo: order.orderNo,
    amountCents,
    params,
    paymentUrl,
    paymentHtml
  };
}

export function buildZpayPagePayRequest(order, options = {}) {
  const gatewayUrl = String(options.gatewayUrl || "https://zpayz.cn/").trim().replace(/\/+$/, "");
  const pid = String(options.pid || "").trim();
  const key = String(options.key || "").trim();
  const notifyUrl = String(options.notifyUrl || "").trim();
  const returnUrl = String(options.returnUrl || "").trim();
  const type = String(options.type || "wxpay").trim();
  if (!pid) throw new Error("ZPAY_PID_REQUIRED");
  if (!key) throw new Error("ZPAY_KEY_REQUIRED");
  if (!notifyUrl) throw new Error("ZPAY_NOTIFY_URL_REQUIRED");
  if (!returnUrl) throw new Error("ZPAY_RETURN_URL_REQUIRED");

  const amountCents = Number(order.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("ORDER_AMOUNT_INVALID");
  const credits = Number(order.credits);
  if (!Number.isInteger(credits) || credits <= 0) throw new Error("ORDER_CREDITS_INVALID");

  const params = {
    pid,
    type,
    out_trade_no: String(order.orderNo),
    notify_url: notifyUrl,
    return_url: returnUrl,
    name: String(options.name || `Add WhatsApp ${credits} credits`).slice(0, 100),
    money: (amountCents / 100).toFixed(2),
    sign_type: "MD5"
  };
  if (options.siteName) params.sitename = String(options.siteName);
  if (options.channelId) params.cid = String(options.channelId);
  if (options.param) params.param = String(options.param);
  params.sign = signZpayPayload(params, key);

  const query = new URLSearchParams(params).toString();
  return {
    provider: "zpay",
    orderId: order.id,
    orderNo: order.orderNo,
    amountCents,
    params,
    paymentUrl: `${gatewayUrl}/submit.php?${query}`
  };
}

export async function queryAlipayTrade(orderNo, options = {}) {
  const appId = String(options.appId || "").trim();
  const appPrivateKey = normalizePem(options.appPrivateKey);
  const gatewayUrl = String(options.gatewayUrl || "https://openapi.alipay.com/gateway.do").trim();
  if (!appId) throw new Error("ALIPAY_APP_ID_REQUIRED");
  if (!appPrivateKey) throw new Error("ALIPAY_APP_PRIVATE_KEY_REQUIRED");
  const sdk = new AlipaySdk({
    appId,
    privateKey: appPrivateKey,
    signType: "RSA2",
    keyType: options.keyType || alipayKeyType(appPrivateKey),
    gateway: gatewayUrl
  });
  return sdk.exec("alipay.trade.query", {
    bizContent: {
      out_trade_no: String(orderNo)
    }
  });
}
