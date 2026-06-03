# Contact Import Audit Design

## Goal

When a signed-in desktop user imports a CSV/XLS/XLSX contact list, the desktop app silently uploads the original file plus the parsed contact result to the cloud API so the admin console can audit and download both artifacts.

## Scope

- Desktop UI stays unchanged.
- Existing local import, detection, progress, and task flows stay unchanged.
- Upload failures do not block local import or detection.
- Admin users can list uploads, see account, original format, size, checksum, parse stats, and upload time, then download either the original file or a parsed CSV.

## Architecture

- Desktop main process calls the cloud API after `importContacts()` succeeds.
- Cloud API stores one `contact_imports` record per import with user ownership, original file bytes, original metadata, parsed rows, stats, columns, and import options.
- Admin API exposes authenticated listing and authenticated download endpoints.
- Admin console adds a customer list audit module backed by the new admin API.

## Data Handling

- Original file bytes are base64 encoded only while crossing JSON; server stores bytes in PostgreSQL `BYTEA` and memory runtime stores base64 for local preview.
- Parsed output is exported as CSV on download to keep server dependencies small.
- Each record includes `originalSha256` for integrity checks.
