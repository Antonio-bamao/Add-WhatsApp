# Payment Production Checklist

This checklist records what must exist before switching from `mock_alipay` to a real payment channel.

## Alipay

- Public HTTPS API domain for `api.addwhatsapp.com`.
- Plain path-only notify URL, for example `https://api.addwhatsapp.com/v1/payments/alipay/notify`.
- Alipay Open Platform app ID stored as `ALIPAY_APP_ID` on the server.
- Alipay public key stored as `ALIPAY_PUBLIC_KEY` on the server.
- App private key stored as server-only `ALIPAY_APP_PRIVATE_KEY` for order creation signing.
- Server-side page-pay creation endpoint `POST /v1/orders/:id/payments/alipay/page-pay` enabled only after the order owner is authenticated.
- Page-pay request creation uses `alipay.trade.page.pay`, `FAST_INSTANT_TRADE_PAY`, `out_trade_no = orders.order_no`, and `total_amount = orders.amount_cents / 100`.
- Gateway URL is environment-specific: sandbox credentials use the sandbox gateway; production credentials use the production gateway.
- `notify_url` handling must return exactly `success` after accepted processing.
- Notification verification must use all returned parameters except `sign` and `sign_type`.
- Repeated notifications must be idempotent through `payment_events.provider_event_id` and `credit_ledger.purchase:{orderId}`.

## ZPAY EasyPay

- Public HTTPS API domain for `api.addwhatsapp.com`.
- ZPAY API gateway stored as `ZPAY_GATEWAY_URL`, normally `https://zpayz.cn`.
- Merchant PID stored as `ZPAY_PID` on the server.
- Merchant KEY stored as server-only `ZPAY_KEY`; never put it in Electron, `website/`, or `admin/`.
- Callback URL stored as `ZPAY_NOTIFY_URL`, normally `https://api.addwhatsapp.com/v1/payments/zpay/notify`.
- Return URL stored as `ZPAY_RETURN_URL`, normally `https://addwhatsapp.com`.
- Payment type stored as `ZPAY_TYPE`, normally `wxpay` for the approved WeChat channel.
- Server-side page-pay creation endpoint `POST /v1/orders/:id/payments/zpay/page-pay` must authenticate the order owner before returning the cashier URL.
- ZPAY request signing uses MD5 over sorted non-empty fields excluding `sign` and `sign_type`, then appends `ZPAY_KEY`.
- `notify_url` handling must verify PID and MD5 signature, process the unified payment event idempotently, and return exactly `success`.

## WeChat Pay Native

- Public HTTPS API domain for `api.addwhatsapp.com`.
- Merchant ID stored as `WECHAT_MCH_ID` on the server.
- Bound and approved Mini Program/App/Official Account AppID stored as `WECHAT_APP_ID`.
- APIv3 key stored as server-only `WECHAT_API_V3_KEY`; never put it in Electron, `website/`, or `admin/`.
- Merchant API certificate serial number stored as `WECHAT_MERCHANT_SERIAL_NO`.
- Merchant API certificate private key stored only on the server, normally through `WECHAT_MERCHANT_PRIVATE_KEY_PATH=/etc/add-whatsapp/wechat/apiclient_key.pem`.
- Callback URL stored as `WECHAT_NOTIFY_URL`, normally `https://api.addwhatsapp.com/v1/payments/wechat/notify`.
- Server-side Native payment endpoint `POST /v1/orders/:id/payments/wechat/native-pay` must authenticate the order owner before returning the `code_url`.
- WeChat request signing uses `WECHATPAY2-SHA256-RSA2048` with method, path, timestamp, nonce and JSON body.
- WeChat notify handling must decrypt `AEAD_AES_256_GCM` resource data with the APIv3 key, check expected merchant ID/AppID, process the unified payment event idempotently, and return exactly `success`.

## Boundaries

- Do not put Alipay, ZPAY, or WeChat payment keys in Electron, `website/`, or `admin/`.
- Do not let clients submit arbitrary amount, subject, or order number for signed payment requests; derive them from the server order row.
- Do not accept anonymous generic payment events; public callbacks must go through a provider-specific verified webhook.
- Orders that are paid but not credited remain `paid_pending_credit` and are retried by the compensation endpoint.
- Refunds and chargebacks must be written as reverse ledger entries, not destructive order edits.
