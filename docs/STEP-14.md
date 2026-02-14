# Step 14 - Durable Background Jobs (Retry + Dead-Letter)

## Scope Delivered
- Added a shared durable background job queue in `@get-caramel/persistence`.
- Added exponential retry and dead-letter handling for failed jobs.
- Wired queue-based async processing into:
  - order-service push notification delivery
  - payment-service payout reconciliation writes
- Added API endpoints for queue status and dead-letter inspection.

## Shared Queue
- New `DurableJobQueue` supports:
  - persisted pending queue state
  - configurable retry policy (`maxAttempts`, `baseDelayMs`, `maxDelayMs`)
  - dead-letter retention with capped history
  - queue runtime status (`pendingCount`, `deadLetterCount`, `lastError`, `processing`)

## Order Service Integration
- Push delivery moved off the synchronous request path.
- Notification creation remains instant (in-memory + realtime emit), then push jobs are queued.
- New endpoints:
  - `GET /notifications/push/queue/status`
  - `GET /notifications/push/queue/dead-letter?limit=`

## Payment Service Integration
- Payout persistence and settlement reconciliation moved to queued jobs.
- Added periodic payout sweep to enqueue reconciliation work for pending vendor balances.
- New endpoints:
  - `GET /payouts/queue/status`
  - `GET /payouts/queue/dead-letter?limit=`

## Verification
- `pnpm --filter @get-caramel/persistence build`
- `pnpm --filter @get-caramel/order-service build`
- `pnpm --filter @get-caramel/payment-service build`

## Files
- `packages/persistence/src/index.ts`
- `services/order-service/src/modules/notifications/notifications.service.ts`
- `services/order-service/src/modules/notifications/notifications.controller.ts`
- `services/order-service/package.json`
- `services/payment-service/src/modules/payment/payment.service.ts`
- `services/payment-service/src/modules/payment/payment.controller.ts`
- `services/payment-service/package.json`
