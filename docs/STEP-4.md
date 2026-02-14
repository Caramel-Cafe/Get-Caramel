# Step 4 Deliverable

## Customer Discovery + Cart + Checkout
- `GET /orders/discovery`
- `GET /orders/cart/:customerId`
- `POST /orders/cart/items`
- `POST /orders/checkout`

## Vendor + Admin Operational Views
- Vendor queue endpoint: `GET /orders/vendor/:vendorId/queue`
- Admin overview endpoint: `GET /orders/admin/overview`

## New Service
- `services/order-service` (NestJS + Fastify)
  - In-memory vendor/menu seed data
  - Cart constraints (single vendor per cart)
  - Checkout and order creation

## App Integration
- `apps/customer-mobile`: live discovery/cart/checkout screens with cache-first hydration
- `apps/vendor-web`: live queue and active order values
- `apps/admin-web`: live ops overview metrics
