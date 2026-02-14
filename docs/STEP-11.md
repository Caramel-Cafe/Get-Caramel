# Step 11 - PostgreSQL Repositories + Core Migrations

## Scope Delivered
- Added new shared DB package:
  - `packages/database`
  - includes PostgreSQL client wrapper and core migration runner
- Added explicit SQL migration artifact:
  - `packages/database/migrations/001_core.sql`
- Introduced normalized repository layer:
  - `services/order-service/src/modules/order/repository/order.repository.ts`
  - `services/payment-service/src/modules/payment/repository/payment.repository.ts`
- Wired repositories into services:
  - Order service hydrates from repository on startup and persists through repository snapshots.
  - Payment service hydrates from repository on startup and persists through repository snapshots.

## Tables Covered
- Order domain:
  - `order_carts`, `order_cart_items`, `orders`, `order_items`, `reviews`, `support_tickets`
- Payment domain:
  - `payments`, `invoices`, `payouts`, `vendor_balances`, `customer_payment_index`
- Shared:
  - `service_kv`

## Notes
- Runtime still keeps in-memory working sets for low-latency operations.
- Repository write path is now PostgreSQL-backed when DB is configured.
- If DB is unavailable, repository gracefully falls back to in-memory runtime state.
