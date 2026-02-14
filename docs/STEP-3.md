# Step 3 Deliverable

## New app surfaces
- `apps/vendor-web`: vendor operations dashboard starter
- `apps/admin-web`: operations and moderation console starter
- `apps/courier-mobile`: rider dispatch starter

## New backend service
- `services/catalog-service`
  - Vendor onboarding
  - Vendor listing
  - Menu upsert/get

## Shared contracts
- Added catalog and vendor DTOs to `packages/types`.

## API endpoints (catalog-service)
- `POST /catalog/vendors`
- `GET /catalog/vendors`
- `POST /catalog/vendors/menu`
- `GET /catalog/vendors/:vendorId/menu`
