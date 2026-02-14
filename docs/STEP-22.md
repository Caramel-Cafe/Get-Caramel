# Step 22 - Automated Test Baseline (Gateway Contract + Security Tests)

## Scope Delivered
- Replaced placeholder test script in `api-gateway` with executable tests.
- Added gateway-focused automated tests covering:
  - RBAC authorization behavior
  - route-to-upstream resolution contracts
  - rate-limit threshold and 429 enforcement

## Test Coverage Added
### AuthZ tests
- Public route access without token.
- Protected route access with valid role.
- Forbidden role on admin-only path.
- Unauthorized access when bearer token is missing.

### Proxy contract tests
- Correct upstream route mapping for order and payment paths.
- Explicit failure for unknown routes.

### Rate limit tests
- Remaining quota decrement behavior.
- 429 `Too Many Requests` after policy threshold is exceeded.

## Run
- `pnpm --filter @get-caramel/api-gateway test`

## Verification Result
- 8 tests passed, 0 failed.

## Files
- `services/api-gateway/package.json`
- `services/api-gateway/test/gateway-authz.test.js`
- `services/api-gateway/test/gateway-proxy.test.js`
- `services/api-gateway/test/gateway-rate-limit.test.js`
