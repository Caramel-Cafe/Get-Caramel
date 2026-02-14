# Step 6 Deliverable

## Realtime Tracking
- Added Socket.IO gateway at `ws://<order-service>/realtime`.
- Actor-based rooms via handshake query `actorKey`:
  - `customer:{customerId}`
  - `vendor:{vendorId}`
  - `rider:{riderId}`
  - `admin:ops`
- Realtime events emitted on order creation and every lifecycle transition.

## Notifications + Push Simulation
- Notifications stored and exposed by actor.
- Push token registration + push delivery log simulation.
- Endpoints:
  - `GET /notifications/actor/:actorKey`
  - `GET /notifications/customer/:customerId`
  - `GET /notifications/vendor/:vendorId`
  - `GET /notifications/rider/:riderId`
  - `GET /notifications/admin`
  - `POST /notifications/push/register`
  - `GET /notifications/push/logs/:actorKey`

## App Integration
- Vendor web + Admin web subscribe to socket events and refresh instantly.
- Customer + Rider apps fetch notification feeds and register demo push tokens.
