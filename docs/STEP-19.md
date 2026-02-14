# Step 19 - Search + Geo Proximity Ranking

## Scope Delivered
- Added catalog search endpoint with text relevance and optional geo ranking.
- Added nearby-vendors endpoint using latitude/longitude and radius filters.
- Extended vendor model to store optional location coordinates.
- Added short-TTL cache for search responses to keep browse latency low.

## New Catalog APIs
- `GET /catalog/vendors/search?q=&lat=&lng=&radiusKm=&limit=`
- `GET /catalog/vendors/nearby?lat=&lng=&radiusKm=&limit=`

## Ranking Model
- Combines:
  - text match score (`name`, `description`, `cuisineTags`)
  - distance score (Haversine distance when coordinates provided)
  - open-status bonus
- Filters out results outside `radiusKm` when origin is provided.

## Type Updates
- `VendorProfile` now supports optional:
  - `latitude`
  - `longitude`
- `VendorOnboardingRequest` supports optional location input.
- Added response models:
  - `CatalogVendorSearchItem`
  - `CatalogVendorSearchResponse`

## Gateway Access Policy
- Added RBAC allowances for:
  - `GET /api/catalog/vendors/search`
  - `GET /api/catalog/vendors/nearby`

## Verification
- `pnpm --filter @get-caramel/types build`
- `pnpm -F @get-caramel/catalog-service install`
- `pnpm --filter @get-caramel/catalog-service build`
- `pnpm --filter @get-caramel/api-gateway build`

## Files
- `packages/types/src/catalog.ts`
- `services/catalog-service/src/modules/catalog/dto/catalog.dto.ts`
- `services/catalog-service/src/modules/catalog/catalog.service.ts`
- `services/catalog-service/src/modules/catalog/catalog.controller.ts`
- `services/api-gateway/src/modules/gateway/gateway-authz.service.ts`
