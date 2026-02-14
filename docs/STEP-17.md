# Step 17 - API Gateway + Edge Rate Limiting

## Scope Delivered
- Added a dedicated `api-gateway` service to front auth, catalog, order, and payment services.
- Implemented path-based reverse proxy routing under `/api/*`.
- Added fixed-window edge rate limiting with Redis/memory-backed counters.

## Gateway Routing
- `GET/POST/... /api/auth/*` -> auth service (`:4001`)
- `GET/POST/... /api/catalog/*` -> catalog service (`:4002`)
- `GET/POST/... /api/orders/*` and `/api/notifications/*` -> order service (`:4003`)
- `GET/POST/... /api/payments/*`, `/api/payouts/*`, `/api/invoices/*` -> payment service (`:4004`)

Service URLs are configurable:
- `AUTH_SERVICE_URL`
- `CATALOG_SERVICE_URL`
- `ORDER_SERVICE_URL`
- `PAYMENT_SERVICE_URL`

## Rate Limiting
- Implemented in gateway before proxy forwarding.
- Default: `180 req / 60s` per client IP + route bucket.
- Stricter policies:
  - auth routes: `60 req / 60s`
  - checkout and payment confirm: `30 req / 60s`
  - payment intent create: `40 req / 60s`
  - payouts run: `10 req / 60s`
- Response headers added:
  - `x-ratelimit-limit`
  - `x-ratelimit-remaining`
  - `x-ratelimit-reset`

## Health
- `GET /health` on gateway for liveness.

## Verification
- `pnpm install`
- `pnpm --filter @get-caramel/api-gateway build`

## Files
- `services/api-gateway/package.json`
- `services/api-gateway/nest-cli.json`
- `services/api-gateway/tsconfig.json`
- `services/api-gateway/src/main.ts`
- `services/api-gateway/src/app.module.ts`
- `services/api-gateway/src/modules/health/health.controller.ts`
- `services/api-gateway/src/modules/gateway/gateway.controller.ts`
- `services/api-gateway/src/modules/gateway/gateway-proxy.service.ts`
- `services/api-gateway/src/modules/gateway/gateway-rate-limit.service.ts`
