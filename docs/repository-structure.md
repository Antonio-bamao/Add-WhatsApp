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
- `server/` owns the API skeleton, billing rules, audit rules, and target PostgreSQL schema.
- Website code must not import desktop internals directly.
- Website code must not hold admin secrets, database URLs, customer data, WhatsApp sessions, or imported spreadsheets.
- Admin preview code must not store customer spreadsheets, full phone lists, local task files, WhatsApp login/cache data, or production credentials.
- Server code must keep customer spreadsheets, full phone lists, WhatsApp sessions, and desktop cache data out of cloud storage by default.

## Future Split Criteria

Split into separate repositories only when deployment and ownership justify it:

- Website needs independent release cadence.
- Admin console grows into a full web app.
- Desktop and website release processes block each other.
- Different people maintain desktop, website, and server.
