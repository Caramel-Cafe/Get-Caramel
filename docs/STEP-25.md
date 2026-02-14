# Step 25 - Real Auth Registration + Credential Validation

## Scope Delivered
- Added persistent credential-backed auth registration and login validation.
- Introduced `POST /auth/register` in `auth-service` and exposed it through the gateway.
- Upgraded customer app auth UI to support sign-in and create-account flows.
- Seeded legacy demo users to keep existing smoke and role-based demo apps operational.

## Backend Changes
- New DTO: `services/auth-service/src/modules/auth/dto/register.dto.ts`
- New persistent user store with password hashing:
  - `services/auth-service/src/modules/auth/storage/user-store.service.ts`
- Updated auth service flow:
  - `services/auth-service/src/modules/auth/auth.service.ts`
  - login now validates credentials
  - register creates a user then issues tokens
- Added register route:
  - `services/auth-service/src/modules/auth/auth.controller.ts`
- Registered user store provider:
  - `services/auth-service/src/app.module.ts`
- Gateway policy updated for public registration:
  - `services/api-gateway/src/modules/gateway/gateway-authz.service.ts`

## Frontend Changes
- Added register client call:
  - `apps/customer-mobile/src/api/client.ts`
- Enhanced customer auth screen:
  - sign-in / create-account mode toggle
  - full name field for registration
  - improved API error message handling
  - `apps/customer-mobile/App.tsx`

## Shared Types
- Added request type:
  - `packages/types/src/auth.ts` (`AuthRegisterRequest`)

## Validation
- `pnpm install`
- `pnpm --filter @get-caramel/types build`
- `pnpm --filter @get-caramel/auth-service build`
- `pnpm --filter @get-caramel/api-gateway build`
- `pnpm --filter @get-caramel/customer-mobile exec tsc -p tsconfig.json --noEmit`
- `powershell -ExecutionPolicy Bypass -File ops/local/smoke-gateway.ps1` -> PASS
- Direct API verify:
  - register + login for a new customer identifier -> matching user IDs
