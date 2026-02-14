# Step 20 - Dispatch Optimization (Rider Location + Load Aware)

## Scope Delivered
- Upgraded rider auto-assignment from simple load balancing to weighted dispatch scoring.
- Added rider state tracking with live location and availability.
- Added API endpoints to update rider position and preview best dispatch candidates.

## Dispatch Model
- Score combines:
  - rider active order load (lower is better)
  - distance to vendor pickup point (closer is better)
  - availability penalty (`BUSY` penalized, `OFFLINE` excluded)
- Auto-assignment on `vendorMarkReady` now uses this scoring model.

## New Order APIs
- `POST /orders/rider/location`
  - update rider latitude/longitude and optional availability
- `GET /orders/rider/:riderId/state`
  - fetch rider snapshot (location, availability, active orders)
- `GET /orders/dispatch/suggest/:orderId`
  - returns recommended rider + ranked candidates

## Contract Updates
- Added new order types:
  - `RiderAvailability`
  - `RiderLocationUpdateRequest`
  - `RiderStateSnapshot`
  - `RiderDispatchScore`
  - `DispatchSuggestionResponse`

## Verification
- `pnpm --filter @get-caramel/types build`
- `pnpm --filter @get-caramel/order-service build`
- `pnpm --filter @get-caramel/api-gateway build`

## Files
- `packages/types/src/order.ts`
- `services/order-service/src/modules/order/dto/order.dto.ts`
- `services/order-service/src/modules/order/order.controller.ts`
- `services/order-service/src/modules/order/order.service.ts`
