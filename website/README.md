# Add WhatsApp Website

This folder contains the public website for `addwhatsapp.com`.

## Scope

- Marketing homepage.
- Download page for the Windows desktop package.
- Release notes and version metadata.
- Public product explanation and support links.

## Boundaries

- Do not put admin-only pages here.
- Do not put API secrets or admin keys here.
- Do not store customer data, WhatsApp sessions, or imported spreadsheets here.
- Desktop app code stays in the repository root `src/`.

## Local Commands

```powershell
cd website
npm install
npm run dev
npm run build
```
