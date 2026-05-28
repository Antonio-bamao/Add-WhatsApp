import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseMockAlipayNotification,
  signMockAlipayPayload
} from "../src/services/paymentProviders.js";

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
});
