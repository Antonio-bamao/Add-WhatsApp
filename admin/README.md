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

## Local Commands

```powershell
cd admin
npm run dev
npm test
```

Open `http://127.0.0.1:3220/` after the dev command is running.

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
