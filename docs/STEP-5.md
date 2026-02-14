# Step 5 Deliverable

## Order Lifecycle State Machine
Implemented lifecycle transitions in `order-service`:
- Vendor: `accept`, `preparing`, `ready`, `reject`
- Rider: `pickup`, `start`, `deliver`
- Dispatch: rider assignment (auto on ready, plus manual assign endpoint)

## New/Updated Endpoints
- `GET /orders/customer/:customerId`
- `POST /orders/vendor/:orderId/accept`
- `POST /orders/vendor/:orderId/preparing`
- `POST /orders/vendor/:orderId/ready`
- `POST /orders/vendor/:orderId/reject`
- `POST /orders/dispatch/assign`
- `GET /orders/rider/:riderId/tasks`
- `POST /orders/rider/:orderId/pickup`
- `POST /orders/rider/:orderId/start`
- `POST /orders/rider/:orderId/deliver`
- `GET /orders/admin/orders`

## App Integration
- Customer app polls and shows latest order status + rider assignment.
- Vendor web can trigger lifecycle actions from queue cards.
- Rider app lists assigned tasks and executes pickup/start/deliver.
- Admin web shows overview plus recent order lifecycle stream.
