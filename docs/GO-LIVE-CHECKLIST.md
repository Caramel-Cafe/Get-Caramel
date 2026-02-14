# Go-Live Checklist (Windows / PowerShell)

## 1) Install Dependencies
```powershell
cd "C:\Users\siemc\OneDrive\Music\Get Caramel"
pnpm install
```

Set required auth env for invite-only admin onboarding:
```powershell
# in .env
AUTH_ADMIN_INVITE_CODE=<strong-random-private-code>
```

For payment provider mode:
```powershell
# in .env
PAYMENT_PROVIDER=local # switch to pesapal when credentials are provisioned
PESAPAL_CONSUMER_KEY=
PESAPAL_CONSUMER_SECRET=
```

## 2) Start Backend Services (separate terminals)
One-command launcher:
```powershell
pnpm ops:start-backend
```

Manual option (if you prefer separate commands):

Terminal A:
```powershell
pnpm --filter @get-caramel/auth-service dev
```

Terminal B:
```powershell
pnpm --filter @get-caramel/catalog-service dev
```

Terminal C:
```powershell
pnpm --filter @get-caramel/order-service dev
```

Terminal D:
```powershell
pnpm --filter @get-caramel/payment-service dev
```

Terminal E:
```powershell
pnpm --filter @get-caramel/delivery-service dev
```

Terminal F:
```powershell
pnpm --filter @get-caramel/api-gateway dev
```

## 3) Run End-to-End Customer Smoke Through Gateway
New terminal:
```powershell
powershell -ExecutionPolicy Bypass -File ops/local/smoke-gateway.ps1
```

Expected final output:
- `PASS`

## 4) Start Frontend Apps (optional local UX checks)
Customer app:
```powershell
pnpm --filter @get-caramel/customer-mobile dev
```

Rider app:
```powershell
pnpm --filter @get-caramel/courier-mobile dev
```

Vendor web:
```powershell
pnpm --filter @get-caramel/vendor-web dev
```

Admin web:
```powershell
pnpm --filter @get-caramel/admin-web dev
```

## 5) Quality Gates Before Production
```powershell
pnpm build
pnpm test
pnpm --filter @get-caramel/api-gateway test
pnpm ops:validate-secrets
```

## 6) DR Readiness Check
```powershell
New-Item -ItemType Directory -Force -Path "ops/release/state" | Out-Null
"environment=staging`nrelease_sha=preprod-sha`ndeployed_at=2026-02-13T00:00:00Z" | Set-Content "ops/release/state/staging.txt" -Encoding UTF8
pnpm ops:dr-drill
```

## 7) Promote via GitHub Actions
Use workflow: `Release Promotion`
- `environment`: `staging` then `production`
- `release_sha`: commit to deploy
- `previous_release_sha`: prior known-good commit for rollback
