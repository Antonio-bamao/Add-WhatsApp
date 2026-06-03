import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  buildAlipayPagePayRequest,
  buildWechatCloseOrderRequest,
  buildWechatNativePayRequest,
  buildZpayPagePayRequest,
  parseAlipayNotification,
  parseWechatNotification,
  parseZpayNotification,
  parseMockAlipayNotification,
  signMockAlipayPayload,
  signZpayPayload
} from "../src/services/paymentProviders.js";

function signAlipayPayload(payload, privateKey) {
  const signingText = Object.keys(payload)
    .filter((key) => key !== "sign" && key !== "sign_type")
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join("&");
  return crypto.sign("RSA-SHA256", Buffer.from(signingText), privateKey).toString("base64");
}

function verifyAlipayRequestSignature(params, publicKey) {
  const signingText = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.verify("RSA-SHA256", Buffer.from(signingText), publicKey, Buffer.from(params.sign, "base64"));
}

function encryptWechatResource(payload, apiV3Key, { nonce = "notify-nonce", associatedData = "transaction" } = {}) {
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(apiV3Key), Buffer.from(nonce));
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: "AEAD_AES_256_GCM",
    ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
    associated_data: associatedData,
    nonce
  };
}

describe("payment provider adapters", () => {
  it("maps a signed mock_alipay success notification into the common payment event contract", () => {
    const secret = "test_mock_alipay_secret";
    const payload = {
      app_id: "mock-app",
      notify_id: "notify-001",
      out_trade_no: "ADWA-000001",
      trade_no: "mock-trade-001",
      trade_status: "TRADE_SUCCESS",
      total_amount: "600.00"
    };
    const signedPayload = {
      ...payload,
      sign: signMockAlipayPayload(payload, secret)
    };

    const event = parseMockAlipayNotification(signedPayload, { secret });

    assert.equal(event.provider, "mock_alipay");
    assert.equal(event.providerEventId, "mock_alipay:notify-001:TRADE_SUCCESS");
    assert.equal(event.orderNo, "ADWA-000001");
    assert.equal(event.eventType, "payment_succeeded");
    assert.equal(event.providerTradeNo, "mock-trade-001");
    assert.deepEqual(event.payload, payload);
  });

  it("rejects unsigned or tampered mock_alipay notifications", () => {
    const secret = "test_mock_alipay_secret";
    const payload = {
      notify_id: "notify-002",
      out_trade_no: "ADWA-000002",
      trade_no: "mock-trade-002",
      trade_status: "TRADE_SUCCESS",
      total_amount: "600.00"
    };
    const signedPayload = {
      ...payload,
      sign: signMockAlipayPayload(payload, secret)
    };

    assert.throws(
      () => parseMockAlipayNotification(payload, { secret }),
      /PAYMENT_SIGNATURE_REQUIRED/
    );
    assert.throws(
      () => parseMockAlipayNotification({ ...signedPayload, total_amount: "1.00" }, { secret }),
      /PAYMENT_SIGNATURE_INVALID/
    );
  });

  it("verifies RSA2 signed Alipay notifications and maps them into the common payment event contract", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const payload = {
      app_id: "2026000000000000",
      notify_id: "alipay-notify-001",
      notify_type: "trade_status_sync",
      out_trade_no: "ADWA-000003",
      trade_no: "2026052922000000000001",
      trade_status: "TRADE_SUCCESS",
      total_amount: "600.00",
      sign_type: "RSA2"
    };
    const signed = {
      ...payload,
      sign: signAlipayPayload(payload, privateKey)
    };

    const event = parseAlipayNotification(signed, {
      alipayPublicKey: publicKey,
      expectedAppId: "2026000000000000"
    });

    assert.equal(event.provider, "alipay");
    assert.equal(event.providerEventId, "alipay:alipay-notify-001:TRADE_SUCCESS");
    assert.equal(event.orderNo, "ADWA-000003");
    assert.equal(event.eventType, "payment_succeeded");
    assert.equal(event.providerTradeNo, "2026052922000000000001");
    assert.equal(event.payload.sign_type, undefined);
    assert.equal(event.payload.sign, undefined);
  });

  it("rejects Alipay notifications with invalid RSA2 signatures or mismatched app ids", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const payload = {
      app_id: "2026000000000000",
      notify_id: "alipay-notify-002",
      out_trade_no: "ADWA-000004",
      trade_no: "2026052922000000000002",
      trade_status: "TRADE_SUCCESS",
      total_amount: "600.00",
      sign_type: "RSA2"
    };
    const signed = {
      ...payload,
      sign: signAlipayPayload(payload, privateKey)
    };

    assert.throws(
      () => parseAlipayNotification({ ...signed, total_amount: "1.00" }, { alipayPublicKey: publicKey, expectedAppId: payload.app_id }),
      /PAYMENT_SIGNATURE_INVALID/
    );
    assert.throws(
      () => parseAlipayNotification(signed, { alipayPublicKey: publicKey, expectedAppId: "wrong-app" }),
      /PAYMENT_APP_ID_MISMATCH/
    );
  });

  it("builds a server-signed Alipay page-pay request for an existing order", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const order = {
      id: "order_001",
      orderNo: "ADWA-000010",
      planId: "advanced",
      credits: 2000,
      amountCents: 60000
    };

    const request = buildAlipayPagePayRequest(order, {
      appId: "2026000000000000",
      appPrivateKey: privateKey,
      notifyUrl: "https://api.addwhatsapp.com/v1/payments/alipay/notify",
      returnUrl: "https://addwhatsapp.com/billing/success",
      gatewayUrl: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
      timestamp: "2026-05-29 10:20:30"
    });

    assert.equal(request.provider, "alipay");
    assert.equal(request.orderId, "order_001");
    assert.equal(request.orderNo, "ADWA-000010");
    assert.equal(request.amountCents, 60000);
    assert.equal(request.params.app_id, "2026000000000000");
    assert.equal(request.params.method, "alipay.trade.page.pay");
    assert.equal(request.params.sign_type, "RSA2");
    assert.equal(request.params.notify_url, "https://api.addwhatsapp.com/v1/payments/alipay/notify");
    assert.equal(request.params.return_url, "https://addwhatsapp.com/billing/success");
    assert.ok(request.paymentUrl.startsWith("https://openapi-sandbox.dl.alipaydev.com/gateway.do?"));
    assert.match(request.paymentHtml, /<form action="https:\/\/openapi-sandbox\.dl\.alipaydev\.com\/gateway\.do\?method=alipay\.trade\.page\.pay/);
    assert.match(request.paymentHtml, /document\.forms\["alipaySDKSubmit/);
    assert.equal(verifyAlipayRequestSignature(request.params, publicKey), true);

    const bizContent = JSON.parse(request.params.biz_content);
    assert.equal(bizContent.out_trade_no, "ADWA-000010");
    assert.equal(bizContent.total_amount, "600.00");
    assert.equal(bizContent.subject, "test");
    assert.equal(bizContent.product_code, "FAST_INSTANT_TRADE_PAY");
    assert.equal(bizContent.qr_pay_mode, "4");
    assert.equal(bizContent.qrcode_width, 120);
  });

  it("builds and verifies a ZPAY easy-pay request and success notification", () => {
    const order = {
      id: "order_zpay_001",
      orderNo: "2026060213340001",
      planId: "advanced",
      credits: 2000,
      amountCents: 80000
    };

    const request = buildZpayPagePayRequest(order, {
      gatewayUrl: "https://zpayz.cn/",
      pid: "2026060213344566",
      key: "zpay_secret_key",
      notifyUrl: "https://api.addwhatsapp.com/v1/payments/zpay/notify",
      returnUrl: "https://addwhatsapp.com",
      type: "wxpay",
      siteName: "Add WhatsApp"
    });

    assert.equal(request.provider, "zpay");
    assert.equal(request.orderId, "order_zpay_001");
    assert.equal(request.orderNo, "2026060213340001");
    assert.equal(request.amountCents, 80000);
    assert.ok(request.paymentUrl.startsWith("https://zpayz.cn/submit.php?"));
    assert.equal(request.params.pid, "2026060213344566");
    assert.equal(request.params.type, "wxpay");
    assert.equal(request.params.out_trade_no, "2026060213340001");
    assert.equal(request.params.money, "800.00");
    assert.equal(request.params.name, "Add WhatsApp 2000 credits");
    assert.equal(request.params.notify_url, "https://api.addwhatsapp.com/v1/payments/zpay/notify");
    assert.equal(request.params.return_url, "https://addwhatsapp.com");
    assert.equal(request.params.sign_type, "MD5");
    assert.equal(request.params.sign, signZpayPayload(request.params, "zpay_secret_key"));

    const notifyPayload = {
      pid: "2026060213344566",
      trade_no: "zpay-trade-001",
      out_trade_no: "2026060213340001",
      type: "wxpay",
      name: "Add WhatsApp 2000 credits",
      money: "800.00",
      trade_status: "TRADE_SUCCESS"
    };
    const signedNotify = {
      ...notifyPayload,
      sign: signZpayPayload(notifyPayload, "zpay_secret_key"),
      sign_type: "MD5"
    };

    const event = parseZpayNotification(signedNotify, {
      key: "zpay_secret_key",
      expectedPid: "2026060213344566"
    });

    assert.equal(event.provider, "zpay");
    assert.equal(event.providerEventId, "zpay:zpay-trade-001:TRADE_SUCCESS");
    assert.equal(event.orderNo, "2026060213340001");
    assert.equal(event.eventType, "payment_succeeded");
    assert.equal(event.providerTradeNo, "zpay-trade-001");
    assert.equal(event.payload.sign, undefined);
    assert.equal(event.payload.sign_type, undefined);
  });

  it("creates a signed WeChat Native payment request with a scannable code url", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const order = {
      id: "order_wechat_001",
      orderNo: "202606030001",
      planId: "professional",
      credits: 5000,
      amountCents: 150000,
      expiresAt: "2026-06-03T07:25:00.000Z"
    };
    let capturedRequest;
    const request = await buildWechatNativePayRequest(order, {
      mchId: "1113492162",
      appId: "wx92f39a8b81948f51",
      merchantSerialNo: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
      merchantPrivateKey: privateKey,
      notifyUrl: "https://api.addwhatsapp.com/v1/payments/wechat/notify",
      now: 1780419600,
      nonce: "wechat-test-nonce",
      fetchImpl: async (url, options) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          status: 200,
          json: async () => ({ code_url: "weixin://wxpay/bizpayurl?pr=test-token" })
        };
      }
    });

    assert.equal(capturedRequest.url, "https://api.mch.weixin.qq.com/v3/pay/transactions/native");
    const body = capturedRequest.options.body;
    const payload = JSON.parse(body);
    assert.equal(payload.mchid, "1113492162");
    assert.equal(payload.appid, "wx92f39a8b81948f51");
    assert.equal(payload.out_trade_no, "202606030001");
    assert.equal(payload.time_expire, "2026-06-03T07:25:00+00:00");
    assert.equal(payload.description, "Add WhatsApp 5000 credits");
    assert.equal(payload.notify_url, "https://api.addwhatsapp.com/v1/payments/wechat/notify");
    assert.deepEqual(payload.amount, { total: 150000, currency: "CNY" });

    const authorization = capturedRequest.options.headers.Authorization;
    assert.match(authorization, /^WECHATPAY2-SHA256-RSA2048 /);
    const authFields = Object.fromEntries(
      authorization.replace(/^WECHATPAY2-SHA256-RSA2048\s+/, "")
        .split(",")
        .map((part) => part.split("="))
        .map(([key, value]) => [key, value.replace(/^"|"$/g, "")])
    );
    assert.equal(authFields.mchid, "1113492162");
    assert.equal(authFields.serial_no, "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7");
    assert.equal(authFields.nonce_str, "wechat-test-nonce");
    assert.equal(authFields.timestamp, "1780419600");
    const signingText = `POST\n/v3/pay/transactions/native\n1780419600\nwechat-test-nonce\n${body}\n`;
    assert.equal(crypto.verify("RSA-SHA256", Buffer.from(signingText), publicKey, Buffer.from(authFields.signature, "base64")), true);

    assert.equal(request.provider, "wechat");
    assert.equal(request.orderId, "order_wechat_001");
    assert.equal(request.orderNo, "202606030001");
    assert.equal(request.amountCents, 150000);
    assert.equal(request.paymentUrl, "weixin://wxpay/bizpayurl?pr=test-token");
    assert.equal(request.codeUrl, "weixin://wxpay/bizpayurl?pr=test-token");
  });

  it("creates a signed WeChat close order request for canceled Native orders", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    let capturedRequest;

    const result = await buildWechatCloseOrderRequest({
      orderNo: "202606030001"
    }, {
      mchId: "1113492162",
      merchantSerialNo: "6E44BE6FB4CE6CBF496988E993FFE93BD3D692E7",
      merchantPrivateKey: privateKey,
      now: 1780419900,
      nonce: "wechat-close-nonce",
      fetchImpl: async (url, options) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          status: 204,
          json: async () => ({})
        };
      }
    });

    assert.equal(capturedRequest.url, "https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/202606030001/close");
    assert.equal(capturedRequest.options.method, "POST");
    assert.deepEqual(JSON.parse(capturedRequest.options.body), { mchid: "1113492162" });
    const authorization = capturedRequest.options.headers.Authorization;
    const authFields = Object.fromEntries(
      authorization.replace(/^WECHATPAY2-SHA256-RSA2048\s+/, "")
        .split(",")
        .map((part) => part.split("="))
        .map(([key, value]) => [key, value.replace(/^"|"$/g, "")])
    );
    const signingText = `POST\n/v3/pay/transactions/out-trade-no/202606030001/close\n1780419900\nwechat-close-nonce\n${capturedRequest.options.body}\n`;
    assert.equal(crypto.verify("RSA-SHA256", Buffer.from(signingText), publicKey, Buffer.from(authFields.signature, "base64")), true);
    assert.deepEqual(result, { provider: "wechat", orderNo: "202606030001", closed: true });
  });

  it("decrypts WeChat APIv3 notifications into the common payment event contract", () => {
    const apiV3Key = "0123456789abcdef0123456789abcdef";
    const decrypted = {
      appid: "wx92f39a8b81948f51",
      mchid: "1113492162",
      out_trade_no: "202606030001",
      transaction_id: "420000000020260603000001",
      trade_state: "SUCCESS",
      amount: { total: 150000, payer_total: 150000, currency: "CNY" }
    };
    const notification = {
      id: "wechat-notify-001",
      create_time: "2026-06-03T00:58:29+08:00",
      event_type: "TRANSACTION.SUCCESS",
      resource_type: "encrypt-resource",
      resource: encryptWechatResource(decrypted, apiV3Key)
    };

    const event = parseWechatNotification(notification, {
      apiV3Key,
      expectedMchId: "1113492162",
      expectedAppId: "wx92f39a8b81948f51"
    });

    assert.equal(event.provider, "wechat");
    assert.equal(event.providerEventId, "wechat:wechat-notify-001:TRANSACTION.SUCCESS");
    assert.equal(event.orderNo, "202606030001");
    assert.equal(event.eventType, "payment_succeeded");
    assert.equal(event.providerTradeNo, "420000000020260603000001");
    assert.equal(event.payload.out_trade_no, "202606030001");
  });
});
