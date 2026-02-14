# Step 21 - Observability Baseline (Metrics + Alerts)

## Scope Delivered
- Added automatic HTTP request instrumentation to all backend services:
  - auth-service
  - catalog-service
  - order-service
  - payment-service
  - api-gateway
- Added per-service metrics endpoint:
  - `GET /metrics?windowSec=300`
- Added built-in lightweight alert signals from metrics snapshots.

## Captured Signals
- Total requests (windowed)
- Error requests (5xx)
- Error rate
- p50 latency
- p95 latency
- Top route breakdown (`method + route`) with:
  - request count
  - route error rate
  - route p50/p95

## Alert Flags
- `HIGH_ERROR_RATE` when error rate >= 5% with enough volume
- `HIGH_P95_LATENCY` when p95 latency >= 800ms with enough volume

## Implementation Notes
- Uses a global Nest interceptor per service to record request metrics automatically.
- Metrics are in-memory ring-buffer snapshots for low overhead and quick operational visibility.
- No endpoint handler changes required for instrumentation.

## Verification
- `pnpm --filter @get-caramel/auth-service build`
- `pnpm --filter @get-caramel/catalog-service build`
- `pnpm --filter @get-caramel/order-service build`
- `pnpm --filter @get-caramel/payment-service build`
- `pnpm --filter @get-caramel/api-gateway build`

## Files
- `services/auth-service/src/modules/metrics/metrics.service.ts`
- `services/auth-service/src/modules/metrics/request-metrics.interceptor.ts`
- `services/auth-service/src/modules/metrics/metrics.controller.ts`
- `services/auth-service/src/app.module.ts`
- `services/catalog-service/src/modules/metrics/metrics.service.ts`
- `services/catalog-service/src/modules/metrics/request-metrics.interceptor.ts`
- `services/catalog-service/src/modules/metrics/metrics.controller.ts`
- `services/catalog-service/src/app.module.ts`
- `services/order-service/src/modules/metrics/metrics.service.ts`
- `services/order-service/src/modules/metrics/request-metrics.interceptor.ts`
- `services/order-service/src/modules/metrics/metrics.controller.ts`
- `services/order-service/src/app.module.ts`
- `services/payment-service/src/modules/metrics/metrics.service.ts`
- `services/payment-service/src/modules/metrics/request-metrics.interceptor.ts`
- `services/payment-service/src/modules/metrics/metrics.controller.ts`
- `services/payment-service/src/app.module.ts`
- `services/api-gateway/src/modules/metrics/metrics.service.ts`
- `services/api-gateway/src/modules/metrics/request-metrics.interceptor.ts`
- `services/api-gateway/src/modules/metrics/metrics.controller.ts`
- `services/api-gateway/src/app.module.ts`
