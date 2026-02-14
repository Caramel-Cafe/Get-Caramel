# Step 26 - Vendor/Courier Onboarding + Invite-Only Admin Registration

## Scope Delivered
- Added role-specific registration UX for vendor web and courier mobile.
- Added invite-only admin registration path and policy enforcement in auth-service.
- Kept existing login paths intact and gateway-routed.

## Backend
- Added admin invite code support in env:
  - `services/auth-service/src/config/env.ts`
- Added DTO for invite-only admin registration:
  - `services/auth-service/src/modules/auth/dto/register-admin.dto.ts`
- Enforced registration policy:
  - `POST /auth/register` blocks `role=admin`
  - `POST /auth/register-admin` requires `inviteCode`
  - `services/auth-service/src/modules/auth/auth.service.ts`
  - `services/auth-service/src/modules/auth/auth.controller.ts`
- Gateway policy updated:
  - `services/api-gateway/src/modules/gateway/gateway-authz.service.ts`
  - allows public `POST /api/auth/register-admin`

## Frontend
- Vendor web:
  - Added `Sign In` / `Create Account` modes with full-name onboarding
  - `apps/vendor-web/app/page.tsx`
- Courier mobile:
  - Added `Sign In` / `Create Account` modes with full name and rider ID
  - `apps/courier-mobile/App.tsx`
- Admin web:
  - Added `Sign In` / `Invite Register` modes
  - Invite register uses `/api/auth/register-admin`
  - `apps/admin-web/app/page.tsx`

## Config + Ops Docs
- Added required env key:
  - `.env.example` -> `AUTH_ADMIN_INVITE_CODE`
- Added go-live note:
  - `docs/GO-LIVE-CHECKLIST.md`

## Validation
- `pnpm --filter @get-caramel/auth-service build`
- `pnpm --filter @get-caramel/api-gateway build`
- `pnpm --filter @get-caramel/courier-mobile exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @get-caramel/vendor-web build`
- `pnpm --filter @get-caramel/admin-web build`
- Register endpoint verification:
  - vendor registration PASS
  - courier registration PASS
- `powershell -ExecutionPolicy Bypass -File ops/local/smoke-gateway.ps1` -> PASS

## Action Required
- Ensure `AUTH_ADMIN_INVITE_CODE` is set in `.env` for each environment, then restart backend services after any invite-code rotation.
