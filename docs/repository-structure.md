# Repository Structure

The project currently uses one repository with separated folders instead of separate repositories.

## Current Layout

```text
Add-WhatsApp/
  src/          Desktop Electron app source.
  assets/       Desktop app assets.
  scripts/      Desktop helper scripts.
  website/      Public website for addwhatsapp.com.
  admin/        Admin console preview for admin.addwhatsapp.com.
  server/       Cloud API skeleton for api.addwhatsapp.com.
  docs/         Product, deployment, and architecture documentation.
  tests/        Node test suite for desktop and shared behavior.
```

## Boundaries

- `src/` remains the desktop app.
- `website/` owns the public marketing website and download pages.
- `admin/` owns the management console surface for cloud accounts, plans, credits, usage, orders, referrals, workspace leases, and audit review.
- `server/` owns the API skeleton, billing rules, audit rules, local admin auth/snapshot API, and PostgreSQL schema/migration entrypoint.
- Website code must not import desktop internals directly.
- Website code must not hold admin secrets, database URLs, customer data, WhatsApp sessions, or imported spreadsheets.
- Admin preview code must not embed customer spreadsheets, full phone lists, local task files, WhatsApp login/cache data, or production credentials; customer list downloads must be fetched through authenticated admin API calls.
- Server code may store authenticated contact import audit records, including original CSV/XLS/XLSX files and parsed results, but WhatsApp sessions and desktop cache data must stay out of cloud storage.
- Local PostgreSQL runs as `add-whatsapp-postgres` on port `55433`; `server/` uses the in-memory preview store by default and switches to PostgreSQL when `DATABASE_URL` is set.

## Future Split Criteria

Split into separate repositories only when deployment and ownership justify it:

- Website needs independent release cadence.
- Admin console grows into a full web app.
- Desktop and website release processes block each other.
- Different people maintain desktop, website, and server.
