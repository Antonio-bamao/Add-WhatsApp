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

Local admin login endpoint:

```text
POST http://127.0.0.1:4110/v1/admin/auth/login
```

The local development seed admin is `admin-preview`. Its password is stored only as a scrypt hash in the local schema/runtime seed; use `AdminPass123` for local preview login.

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
