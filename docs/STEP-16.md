# Step 16 - Hot-Read Cache for Catalog (Instant Browse UX)

## Scope Delivered
- Added hot-read caching for catalog endpoints (vendor list and vendor menus).
- Backed cache by `UnifiedPersistence` (Redis when available, memory fallback).
- Added write-path cache refresh on vendor onboarding and menu updates.

## Why This Step
- Catalog browse APIs are read-heavy and directly impact perceived app speed.
- Caching these payloads cuts repeated compute and IO on home/store screens.

## Endpoints Accelerated
- `GET /catalog/vendors`
- `GET /catalog/vendors/:vendorId/menu`

## Cache Behavior
- Vendors list cache TTL: 15s
- Vendor menu cache TTL: 30s
- On writes:
  - `POST /catalog/vendors` refreshes vendors cache and initializes menu cache
  - `POST /catalog/vendors/menu` refreshes vendor menu cache

## Verification
- `pnpm install`
- `pnpm --filter @get-caramel/persistence build`
- `pnpm --filter @get-caramel/catalog-service build`

## Files
- `services/catalog-service/src/modules/catalog/catalog.service.ts`
- `services/catalog-service/src/modules/catalog/catalog.controller.ts`
- `services/catalog-service/package.json`
