# Step 7 Deliverable

## Payments
- Added `payment-service` with:
  - `POST /payments/intents`
  - `POST /payments/confirm`
  - `POST /payments/webhook`
  - `GET /payments/order/:orderId`
  - `GET /payments/customer/:customerId`
- Supports methods: `CARD`, `WALLET`, `CASH`.
- Includes basic fraud scoring and high-risk failure guard.

## Settlements + Payouts
- Payout endpoints:
  - `POST /payouts/run`
  - `GET /payouts/vendor/:vendorId/summary`
  - `GET /payouts/overview`
- Settlement model:
  - platform fee (basis points)
  - vendor net accumulation
  - payout batch execution

## Invoices
- Invoice endpoints:
  - `GET /invoices/vendor/:vendorId`
  - `GET /invoices/order/:orderId`
- Invoices are generated when payment transitions to `SUCCEEDED`.

## App Integration
- Customer app:
  - Payment method selector
  - intent + confirmation flow at checkout
  - payment risk/status display
- Vendor web:
  - pending balance, paid-out totals, and invoice feed
- Admin web:
  - payout overview + run payout batch button
