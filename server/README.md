# Add WhatsApp Server

This folder contains the local-preview cloud API skeleton for `api.addwhatsapp.com`.

## Scope

- Cloud account registration and login.
- Entitlement summaries for plans, credits, daily usage, workspaces, and referral codes.
- Successful-add credit consumption with idempotency.
- Manual admin credit adjustments with audit logs.
- Manual order creation and paid marking.
- Workspace lease limits.

## Boundaries

- This preview uses in-memory state so it can run without external services.
- `src/db/schema.sql` is the PostgreSQL target schema for the real service.
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
