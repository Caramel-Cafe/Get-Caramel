# Step 15 - Idempotent Write APIs (Retry-Safe Checkout + Payments)

## Scope Delivered
- Added shared idempotency support in `@get-caramel/persistence`.
- Integrated idempotent command handling for high-value write endpoints:
  - order checkout
  - payment intent creation
  - payment confirmation
  - payout run command
- Idempotency responses are persisted with TTL so client retries return the same result instead of duplicating writes.

## Shared Idempotency Store
- New `IdempotencyStore`:
  - `execute(key, handler)` to run-once and replay
  - persistence-backed record storage
  - in-flight request dedupe (same key, concurrent requests)
  - configurable TTL

## API Usage
- Send `x-idempotency-key` header on write requests.
- If the same key is retried within TTL, the previous response is returned.

### Order Service
- `POST /orders/checkout`

### Payment Service
- `POST /payments/intents`
- `POST /payments/confirm`
- `POST /payouts/run`

## Verification
- `pnpm --filter @get-caramel/persistence build`
- `pnpm --filter @get-caramel/order-service build`
- `pnpm --filter @get-caramel/payment-service build`

## Files
- `packages/persistence/src/index.ts`
- `services/order-service/src/modules/order/order.service.ts`
- `services/order-service/src/modules/order/order.controller.ts`
- `services/payment-service/src/modules/payment/payment.service.ts`
- `services/payment-service/src/modules/payment/payment.controller.ts`
