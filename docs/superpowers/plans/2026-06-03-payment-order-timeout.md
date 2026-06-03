# Payment Order Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5-minute WeChat payment order expiry, real cancellation, and in-page status controls.

**Architecture:** The server remains the source of truth for order lifecycle and WeChat signing. Electron exposes small IPC methods, and the renderer owns only display, countdown, polling, and user actions.

**Tech Stack:** Node HTTP server, Electron IPC/preload, vanilla renderer JavaScript/CSS, Node test runner.

---

### Task 1: Server Order Lifecycle

**Files:**
- Modify: `server/src/services/billingService.js`
- Modify: `server/src/db/postgresRuntime.js`
- Modify: `server/src/db/schema.sql`
- Test: `server/tests/billing-service.test.mjs`

- [ ] Write failing tests for 5-minute `expiresAt`, status lookup, cancel, and expiry closure.
- [ ] Implement memory runtime lifecycle helpers.
- [ ] Mirror the lifecycle in Postgres runtime and schema.
- [ ] Run server billing tests.

### Task 2: WeChat Close Adapter And HTTP Routes

**Files:**
- Modify: `server/src/services/paymentProviders.js`
- Modify: `server/src/app.js`
- Test: `server/tests/payment-providers.test.mjs`
- Test: `server/tests/http-api.test.mjs`

- [ ] Write failing tests for signed WeChat close-order requests.
- [ ] Write failing tests for user order status and close routes.
- [ ] Implement the close-order adapter and routes.
- [ ] Run provider and HTTP tests.

### Task 3: Desktop Client Contract

**Files:**
- Modify: `src/core/cloudApiClient.js`
- Modify: `src/main/cloudDesktopController.js`
- Modify: `src/main/main.js`
- Modify: `src/main/preload.js`
- Test: `tests/cloudApiClient.test.js`
- Test: `tests/cloudMainIntegration.test.js`

- [ ] Write failing tests for `getOrderStatus` and `closePaymentOrder`.
- [ ] Implement client/controller IPC methods.
- [ ] Run desktop client tests.

### Task 4: Renderer Payment Panel

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/renderer.js`
- Modify: `src/renderer/styles.css`
- Test: `tests/cloudRendererContract.test.js`
- Test: `tests/rendererPlanPayment.test.js`

- [ ] Write failing contract tests for countdown and cancel controls.
- [ ] Implement the in-page countdown, polling, cancellation, expiry, and retry states.
- [ ] Run renderer tests and inspect the local app.
