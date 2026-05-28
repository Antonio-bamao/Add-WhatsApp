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

## Boundaries

- The API runtime currently uses in-memory state so it can run without external services.
- `src/db/schema.sql` is the PostgreSQL target schema and local migration source.
- Do not upload customer spreadsheets, complete phone lists, WhatsApp sessions, or desktop cache data to this service.

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

Alipay page-pay request creation:

```text
POST http://127.0.0.1:4110/v1/orders/:id/payments/alipay/page-pay
```

This endpoint requires the order owner's bearer token. It reads the existing order, verifies ownership and payable status, then returns server-signed Alipay `alipay.trade.page.pay` request parameters plus a `paymentUrl`. The server never returns or stores the app private key.

Local admin login endpoint:

```text
POST http://127.0.0.1:4110/v1/admin/auth/login
```

The local development seed admin is `admin-preview`. Its password is stored only as a scrypt hash in the local schema/runtime seed; use `AdminPass123` for local preview login.

Payment callback endpoints:

```text
POST http://127.0.0.1:4110/v1/payments/mock-alipay/notify
POST http://127.0.0.1:4110/v1/payments/alipay/notify
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
