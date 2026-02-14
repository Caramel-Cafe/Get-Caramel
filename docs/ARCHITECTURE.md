# Architecture (v1)

## Tech Stack
- Mobile apps: React Native + Expo + TypeScript
- Web apps: Next.js + TypeScript + Tailwind
- Backend: Node.js + NestJS
- Data: PostgreSQL, Redis
- Messaging: RabbitMQ
- Object storage: S3-compatible
- Realtime: WebSocket gateway
- Observability: OpenTelemetry + Prometheus + Grafana

## Bounded Services
- API Gateway: public API composition, rate limiting
- Auth Service: identity, sessions, role grants
- Catalog Service: vendors, menus, item availability
- Order Service: cart checkout, order state transitions
- Delivery Service: courier matching, tracking, ETA
- Payment Service: charge intents, webhooks, payouts

## Core Domain Entities
- User, Role, Address
- Vendor, Branch, Menu, MenuItem, ModifierGroup
- Cart, Order, OrderItem, Payment
- Courier, DeliveryTask, CourierLocationPing
- Review, SupportTicket

## Order States
- DRAFT
- PLACED
- ACCEPTED_BY_VENDOR
- PREPARING
- READY_FOR_PICKUP
- PICKED_UP
- ON_THE_WAY
- DELIVERED
- CANCELED

## Non-Functional Targets
- P95 read latency < 250ms (gateway)
- P95 write latency < 500ms (order placement)
- 99.9% monthly uptime target
- Full audit log for financial and order transitions
