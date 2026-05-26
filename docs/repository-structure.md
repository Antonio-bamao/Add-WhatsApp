# Repository Structure

The project currently uses one repository with separated folders instead of separate repositories.

## Current Layout

```text
Add-WhatsApp/
  src/          Desktop Electron app source.
  assets/       Desktop app assets.
  scripts/      Desktop helper scripts.
  website/      Public website for addwhatsapp.com.
  docs/         Product, deployment, and architecture documentation.
  tests/        Node test suite for desktop and shared behavior.
```

## Boundaries

- `src/` remains the desktop app.
- `website/` owns the public marketing website and download pages.
- Website code must not import desktop internals directly.
- Website code must not hold admin secrets, database URLs, customer data, WhatsApp sessions, or imported spreadsheets.

## Future Split Criteria

Split into separate repositories only when deployment and ownership justify it:

- Website needs independent release cadence.
- Admin console grows into a full web app.
- Desktop and website release processes block each other.
- Different people maintain desktop, website, and server.
