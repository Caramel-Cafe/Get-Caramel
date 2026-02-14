# Get Caramel

Professional multi-vendor food delivery platform (Glovo-style) with modern UI.

## App Surfaces (4)
- Customer App: `apps/customer-mobile`
- Vendor Dashboard: `apps/vendor-web`
- Rider App: `apps/courier-mobile`
- Admin Console: `apps/admin-web`

## Services
- Auth Service: `services/auth-service`
- Catalog Service: `services/catalog-service`
- Order Service: `services/order-service`
- Payment Service: `services/payment-service`
- Delivery Service: `services/delivery-service`

## Quick Start
1. Install dependencies: `pnpm install`
2. Start auth service: `pnpm --filter @get-caramel/auth-service dev`
3. Start catalog service: `pnpm --filter @get-caramel/catalog-service dev`
4. Start order service: `pnpm --filter @get-caramel/order-service dev`
5. Start payment service: `pnpm --filter @get-caramel/payment-service dev`
6. Start delivery service: `pnpm --filter @get-caramel/delivery-service dev`
7. Start API gateway: `pnpm --filter @get-caramel/api-gateway dev`
8. Start customer app: `pnpm --filter @get-caramel/customer-mobile dev`
9. Start rider app: `pnpm --filter @get-caramel/courier-mobile dev`
10. Start vendor web: `pnpm --filter @get-caramel/vendor-web dev`
11. Start admin web: `pnpm --filter @get-caramel/admin-web dev`

## Step Status
- Step 2: auth + customer shell complete
- Step 3: vendor/admin/rider shells + catalog service complete
- Step 4: discovery + cart + checkout + vendor/admin live ops views complete
- Step 5: full order lifecycle transitions (vendor/rider/admin/customer) complete
- Step 6: realtime socket tracking + notifications + push simulation complete
- Step 7: payments, payouts, invoices, and settlement views complete
- Step 8: reviews, moderation, and support ticket operations complete
- Step 9: scale + security foundations (audit logs, load tests, runbooks) complete
- Step 10: durable persistence foundation (Postgres + Redis fallback adapters) complete
- Step 11: PostgreSQL repository layer + core normalized migrations complete
- Step 12: incremental repository writes + indexed pagination queries complete
- Step 13: migration versioning + rollback tooling complete
- Step 14: durable background jobs + retry + dead-letter complete
- Step 15: idempotent write APIs for checkout/payments/payouts complete
- Step 16: hot-read cache for catalog browse endpoints complete
- Step 17: API gateway + edge rate limiting complete
- Step 18: gateway RBAC authorization enforcement complete
- Step 19: search + geo proximity vendor ranking complete
- Step 20: dispatch optimization with rider location/load scoring complete
- Step 21: observability baseline with request metrics + alerts complete
- Step 22: automated gateway security/contract tests complete
- Step 23: CI/CD promotion pipeline + rollback workflow complete
- Step 24: production hardening (secrets, backup, DR, compliance ops) complete
- Step 25: real auth registration + persistent credential validation complete
- Step 26: vendor/courier onboarding + invite-only admin registration complete

See `docs/STEP-2.md`, `docs/STEP-3.md`, `docs/STEP-4.md`, `docs/STEP-5.md`, `docs/STEP-6.md`, `docs/STEP-7.md`, `docs/STEP-8.md`, `docs/STEP-9.md`, `docs/STEP-10.md`, `docs/STEP-11.md`, `docs/STEP-12.md`, `docs/STEP-13.md`, `docs/STEP-14.md`, `docs/STEP-15.md`, `docs/STEP-16.md`, `docs/STEP-17.md`, `docs/STEP-18.md`, `docs/STEP-19.md`, `docs/STEP-20.md`, `docs/STEP-21.md`, `docs/STEP-22.md`, `docs/STEP-23.md`, `docs/STEP-24.md`, `docs/STEP-25.md`, `docs/STEP-26.md`, `docs/HARDENING.md`, `docs/PERFORMANCE.md`.

Go-live execution guide: `docs/GO-LIVE-CHECKLIST.md`.
Release promotion guide: `docs/RELEASE-PROMOTION.md`.
Quick local backend start: `pnpm ops:start-backend`.
