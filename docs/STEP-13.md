# Step 13 - Migration Versioning + Rollback Tooling

## Scope Delivered
- Added migration version tracking table (`schema_migrations`) via `CoreDatabase`.
- Reworked schema bootstrap into versioned migration steps:
  - `001_core_tables`
  - `002_indexes`
- Added rollback support for the latest applied migration.
- Added migration CLI:
  - `pnpm --filter @get-caramel/database migrate:up`
  - `pnpm --filter @get-caramel/database migrate:down`
  - `pnpm --filter @get-caramel/database migrate:status`

## Zero-Downtime Direction
- Schema changes are now versioned and additive-first.
- Index creation uses `if not exists` to avoid destructive churn.
- Runtime services continue operating with existing read/write fallbacks if DB is unavailable.

## Files
- `packages/database/src/index.ts`
- `packages/database/src/migrations/cli.ts`
- `packages/database/package.json`
