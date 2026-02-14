# Step 18 - Gateway RBAC Authorization Enforcement

## Scope Delivered
- Added JWT-based authorization checks at API gateway edge.
- Enforced role-based route access policy matrix before proxy forwarding.
- Forwarded trusted actor context headers downstream after successful auth:
  - `x-actor-id`
  - `x-actor-role`

## Auth Model
- Gateway validates bearer access tokens using `AUTH_JWT_SECRET`.
- Access token requirements:
  - valid signature
  - `typ` must be `access`
- Public routes remain open (for example `auth/login`, `auth/refresh`, payment webhook).

## Role Policy Enforcement
- Customer-only and admin-shared routes are restricted (checkout, customer orders/payments, etc.).
- Vendor-owner routes are restricted (vendor queue, vendor invoices/payout summary, catalog write paths).
- Courier routes are restricted (rider task and dispatch actions).
- Admin-only routes are restricted (ops/admin endpoints, payout run, queue dead-letter/status endpoints).

## Operational Impact
- Unauthorized traffic is blocked at the gateway instead of reaching upstream services.
- Reduces blast radius and enforces app-surface boundaries centrally.

## Verification
- `pnpm install`
- `pnpm -F @get-caramel/api-gateway install`
- `pnpm --filter @get-caramel/api-gateway build`

## Files
- `services/api-gateway/src/modules/gateway/gateway-authz.service.ts`
- `services/api-gateway/src/modules/gateway/gateway.controller.ts`
- `services/api-gateway/src/modules/gateway/gateway-proxy.service.ts`
- `services/api-gateway/src/app.module.ts`
- `services/api-gateway/package.json`
