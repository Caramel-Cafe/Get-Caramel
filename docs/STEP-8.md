# Step 8 - Quality, Reviews, and Support Operations

## Scope Delivered
- Added shared quality contracts in `packages/types/src/quality.ts`.
- Extended order APIs with:
  - Customer review submission/listing.
  - Vendor review summary endpoint.
  - Support ticket creation/listing.
  - Admin review moderation endpoints.
  - Admin support ticket status management endpoint.
- Implemented order-service durable review and support ticket workflows with notifications.
- Added customer mobile UX for:
  - Submit review for delivered order.
  - Open support tickets with priority.
  - View own reviews and tickets.
- Added vendor web quality visibility:
  - Average rating, review count, recent review feed.
- Added admin web quality ops:
  - Pending review moderation (approve/reject).
  - Support ticket triage (OPEN/IN_PROGRESS/RESOLVED/ESCALATED).

## API Endpoints Added
- `GET /orders/customer/:customerId/reviews`
- `GET /orders/customer/:customerId/tickets`
- `GET /orders/vendor/:vendorId/reviews`
- `POST /orders/reviews`
- `POST /orders/support/tickets`
- `GET /orders/admin/reviews/pending`
- `POST /orders/admin/reviews/:reviewId/approve`
- `POST /orders/admin/reviews/:reviewId/reject`
- `GET /orders/admin/support/tickets`
- `POST /orders/admin/support/:ticketId/status`

## Notes
- Review moderation auto-flags suspicious keywords and routes flagged reviews to pending moderation.
- Reviews and support tickets are persisted durably via repository-backed PostgreSQL tables.
- Quality/support events are also pushed into existing notification flows for customer, vendor, and admin actors.
