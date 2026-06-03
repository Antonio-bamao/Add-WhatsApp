# Payment Order Timeout Design

## Goal

Keep payment status on the current desktop page and give every online payment order a clear exit path: paid, canceled, or expired.

## Decisions

- Payment UI stays inside the existing plan and billing pages. The browser is only a fallback for opening or copying the raw payment link.
- WeChat Native payment orders expire after 5 minutes.
- The payment panel shows the order number, amount, live status, countdown, QR code, and cancel/retry actions.
- Clicking cancel must close the server order and call the WeChat close-order API when the order was already sent to WeChat.
- Client-side timeout must call the same close route instead of only hiding the QR code.
- If a late WeChat paid callback arrives after local cancellation or expiry, the server still processes the paid callback and credits the account to avoid losing a real payment.

## Components

- Server order runtime stores `expiresAt` and exposes order status plus close actions.
- Payment provider adapter signs WeChat close-order requests on the server.
- HTTP API exposes user-owned order status and close endpoints.
- Desktop client adds order status, cancel order, and payment polling methods.
- Renderer upgrades the existing payment panel with a countdown, cancel button, retry action, and polling cleanup.

## Test Strategy

- Server unit tests cover 5-minute expiry and closed-order transitions.
- Provider tests cover signed WeChat close-order requests.
- HTTP tests cover user-owned order status and cancel endpoints.
- Desktop client/controller tests cover cancel/status calls with bearer auth.
- Renderer contract tests cover in-page countdown/cancel controls.
