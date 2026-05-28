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

## Boundaries

- Do not put Alipay keys in Electron, `website/`, or `admin/`.
- Do not let clients submit arbitrary amount, subject, or order number for signed Alipay requests; derive them from the server order row.
- Do not accept anonymous generic payment events; public callbacks must go through a provider-specific verified webhook.
- Orders that are paid but not credited remain `paid_pending_credit` and are retried by the compensation endpoint.
- Refunds and chargebacks must be written as reverse ledger entries, not destructive order edits.
