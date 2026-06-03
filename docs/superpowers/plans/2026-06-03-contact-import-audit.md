# Contact Import Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add silent desktop contact-import upload and admin-side audit/download of original and parsed files.

**Architecture:** The desktop main process reuses the existing cloud session and posts a JSON upload after local import succeeds. The server owns persistence and download formatting; the admin console only lists records and fetches downloads with the admin bearer token.

**Tech Stack:** Electron main process, Node core `fetch`, Node test runner, server memory runtime, PostgreSQL runtime, static admin HTML/CSS/JS.

---

### Task 1: Server API And Runtime

**Files:**
- Modify: `server/src/app.js`
- Modify: `server/src/services/billingService.js`
- Modify: `server/src/db/postgresRuntime.js`
- Modify: `server/src/db/schema.sql`
- Test: `server/tests/http-api.test.mjs`

- [ ] Write a failing HTTP API test that posts `/v1/contact-imports`, lists `/v1/admin/contact-imports`, rejects anonymous admin access, and downloads `original` plus `parsed`.
- [ ] Implement memory runtime storage with validation, listing, and download payloads.
- [ ] Implement PostgreSQL storage using `contact_imports`.
- [ ] Add routes for user upload and admin list/download.

### Task 2: Desktop Silent Upload

**Files:**
- Modify: `src/core/cloudApiClient.js`
- Modify: `src/main/cloudDesktopController.js`
- Modify: `src/main/main.js`
- Test: `tests/cloudApiClient.test.js`

- [ ] Write a failing client test for `POST /v1/contact-imports`.
- [ ] Add the client method and controller wrapper.
- [ ] In the existing import handler, upload after local parsing succeeds without changing renderer payloads.
- [ ] Swallow upload failures so import still works locally.

### Task 3: Admin Audit Surface

**Files:**
- Modify: `admin/public/admin-data.js`
- Modify: `admin/public/admin.js`
- Modify: `admin/public/admin.css`
- Test: `admin/tests/admin-structure.test.mjs`

- [ ] Write a failing structure test for the new customer list audit module and admin API endpoint usage.
- [ ] Add the module config and desktop mapping.
- [ ] Add API-backed list rendering and token-authenticated Blob downloads.

### Task 4: Verification

**Commands:**
- `node --test tests\cloudApiClient.test.js`
- `node --test server\tests\http-api.test.mjs`
- `node --test admin\tests\admin-structure.test.mjs`
- `npm test`
- `npm test --prefix server`
- `npm test --prefix admin`
