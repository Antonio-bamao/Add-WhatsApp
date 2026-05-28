# Add WhatsApp Admin

This folder is the preview home for `admin.addwhatsapp.com`.

## Scope

- Cloud account operations.
- Plans, subscriptions, credits, usage, orders, referrals, workspace leases, and audit review.
- Admin-only actions such as manual top-up, account freeze, plan adjustment, referral review, and lease release.

## Boundaries

- Do not put this inside `website/`.
- Do not store public marketing content here.
- Do not store customer spreadsheets, full phone lists, local task files, or desktop login/cache data here.
- API and database code should remain a separate service when it is added.
- Runtime data is read from `http://127.0.0.1:4110/v1/admin/console` during local preview; if the API is offline, the UI falls back to static preview data.
- Sensitive API operations require an admin token from `http://127.0.0.1:4110/v1/admin/auth/login`.

## Local Commands

```powershell
cd admin
npm run dev
npm test
```

Open `http://127.0.0.1:3220/` after the dev command is running.

For API-backed local preview, start the server too:

```powershell
cd ..\server
npm run dev
```

Local preview admin login:

```text
username: admin-preview
password: AdminPass123
```

Module pages use hash routes:

```text
http://127.0.0.1:3220/#/users
http://127.0.0.1:3220/#/plans
http://127.0.0.1:3220/#/credits
http://127.0.0.1:3220/#/usage
http://127.0.0.1:3220/#/orders
http://127.0.0.1:3220/#/referrals
http://127.0.0.1:3220/#/workspaces
http://127.0.0.1:3220/#/audit
```
