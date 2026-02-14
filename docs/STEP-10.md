# Step 10 - Durable Persistence Layer

## Scope Delivered
- Added new shared package:
  - `packages/persistence` (`@get-caramel/persistence`)
- Introduced `UnifiedPersistence` with:
  - PostgreSQL-backed durable JSON state (`app_state` table)
  - Redis-backed cache interface
  - Repository-backed durable state as the source of truth for critical domains
- Migrated `order-service` state from volatile memory-only to durable snapshots:
  - startup hydration (`onModuleInit`)
  - non-blocking snapshot persistence on writes
- Migrated `payment-service` state from volatile memory-only to durable snapshots:
  - startup hydration (`onModuleInit`)
  - non-blocking snapshot persistence on writes

## Config
- `DATABASE_URL` (shared)
- `ORDER_DATABASE_URL` (optional override)
- `PAYMENT_DATABASE_URL` (optional override)
- `REDIS_URL`

## Notes
- Writes remain low-latency: snapshot persistence is async and does not block request response path.
- Postgres-backed state remains the source of truth for critical order/payment persistence domains.
- Next hardening step should move from whole-service snapshot writes to entity-level repositories and migrations.
