# Add WhatsApp Server

This folder contains the local-preview cloud API skeleton for `api.addwhatsapp.com`.

## Scope

- Cloud account registration and login.
- Entitlement summaries for plans, credits, daily usage, workspaces, and referral codes.
- Successful-add credit consumption with idempotency.
- Manual admin credit adjustments with audit logs.
- Manual order creation and paid marking.
- Workspace lease limits.
- Admin console snapshot data for local `admin/` API integration.
- Admin authentication for sensitive operations.
- Desktop contact import audit storage for signed-in users, including original CSV/XLS/XLSX files and parsed results for admin download.

## Boundaries

- The API runtime currently uses in-memory state so it can run without external services.
- `src/db/schema.sql` is the PostgreSQL target schema and local migration source.
- Customer contact imports may be uploaded only through the authenticated `/v1/contact-imports` audit path. WhatsApp sessions and desktop cache data must stay out of this service.

## Local Commands

```powershell
cd server
npm test
npm run dev
```

Default local API URL:

```text
http://127.0.0.1:4110/v1/health
```

Admin console snapshot:

```text
http://127.0.0.1:4110/v1/admin/console
```

Admin payment event query:

```text
GET http://127.0.0.1:4110/v1/admin/payment-events?provider=alipay&processed=processed&limit=50&offset=0
```

Supported filters are `provider`, `eventType`, `processed=processed|pending`, `q`, `limit`, and `offset`. This endpoint requires an admin bearer token.

Admin contact import audit query:

```text
GET http://127.0.0.1:4110/v1/admin/contact-imports?q=account&limit=50&offset=0
GET http://127.0.0.1:4110/v1/admin/contact-imports/:id/download?kind=original
GET http://127.0.0.1:4110/v1/admin/contact-imports/:id/download?kind=parsed
```

The desktop client silently creates contact import audit records with `POST /v1/contact-imports` after local import succeeds. The admin endpoints require an admin bearer token; `kind=original` returns the uploaded file and `kind=parsed` returns a standard CSV export of the parsed rows.

Alipay page-pay request creation:

```text
POST http://127.0.0.1:4110/v1/orders/:id/payments/alipay/page-pay
```

This endpoint requires the order owner's bearer token. It reads the existing order, verifies ownership and payable status, then returns server-signed Alipay `alipay.trade.page.pay` request parameters plus a `paymentUrl`. The server never returns or stores the app private key.

WeChat Native payment request creation:

```text
POST http://127.0.0.1:4110/v1/orders/:id/payments/wechat/native-pay
```

This endpoint requires the order owner's bearer token. It reads the existing order, verifies ownership and payable status, calls WeChat Pay APIv3 `POST /v3/pay/transactions/native`, and returns the `codeUrl` / `paymentUrl` that the desktop client renders as a WeChat scan-to-pay QR code. The server never returns the merchant private key or APIv3 key.

Local admin login endpoint:

```text
POST http://127.0.0.1:4110/v1/admin/auth/login
```

The local development seed admin username is `yojiro`. Its password is stored only as a scrypt hash in the local schema/runtime seed; use `yojiro123` for local preview login.

Payment callback endpoints:

```text
POST http://127.0.0.1:4110/v1/payments/mock-alipay/notify
POST http://127.0.0.1:4110/v1/payments/alipay/notify
POST http://127.0.0.1:4110/v1/payments/wechat/notify
```

`mock_alipay` is only for local preview and uses `MOCK_ALIPAY_WEBHOOK_SECRET`.

Real Alipay callback verification expects:

```text
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
ALIPAY_APP_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
ALIPAY_NOTIFY_URL=https://api.addwhatsapp.com/v1/payments/alipay/notify
ALIPAY_RETURN_URL=https://addwhatsapp.com/billing/success
ALIPAY_GATEWAY_URL=https://openapi.alipay.com/gateway.do
```

`ALIPAY_APP_PRIVATE_KEY`, `ALIPAY_NOTIFY_URL`, `ALIPAY_RETURN_URL`, and `ALIPAY_GATEWAY_URL` are used only when creating a signed page-pay request. Use the sandbox gateway only for sandbox app credentials.

The real Alipay notify endpoint accepts form POST payloads, verifies RSA2 signatures, maps successful `TRADE_SUCCESS` / `TRADE_FINISHED` notifications into the common payment event contract, and returns plain text `success` only after the notification has been accepted by the idempotent payment-event flow.

Real WeChat Native payment expects:

```text
WECHAT_MCH_ID=1113492162
WECHAT_APP_ID=wx92f39a8b81948f51
WECHAT_API_V3_KEY=32-character-api-v3-key
WECHAT_MERCHANT_SERIAL_NO=merchant-api-certificate-serial-number
WECHAT_MERCHANT_PRIVATE_KEY_PATH=/etc/add-whatsapp/wechat/apiclient_key.pem
WECHAT_NOTIFY_URL=https://api.addwhatsapp.com/v1/payments/wechat/notify
```

The WeChat notify endpoint decrypts APIv3 `AEAD_AES_256_GCM` resources with `WECHAT_API_V3_KEY`, checks the expected merchant ID and AppID, maps `TRANSACTION.SUCCESS` / `trade_state=SUCCESS` into the common payment event contract, and returns plain text `success` after idempotent processing.

See `docs/payment-production-checklist.md` before using a production payment channel.

Run the API against PostgreSQL instead of the in-memory preview store:

```powershell
cd server
$env:DATABASE_URL="postgres://addwhatsapp:addwhatsapp_dev_password@127.0.0.1:55433/addwhatsapp"
npm run dev
```

Run the PostgreSQL persistence integration test:

```powershell
cd server
$env:ADD_WHATSAPP_TEST_DATABASE_URL="postgres://addwhatsapp:addwhatsapp_dev_password@127.0.0.1:55433/addwhatsapp"
npm run test:postgres
```

## Local PostgreSQL

Start the project database:

```powershell
cd server
docker compose up -d
```

Apply the schema and seed the plan catalog:

```powershell
.\scripts\apply-schema.ps1
```

The local database is visible in Docker Desktop as `add-whatsapp-postgres`.

Connection values:

```text
host: 127.0.0.1
port: 55433
database: addwhatsapp
user: addwhatsapp
password: addwhatsapp_dev_password
```
