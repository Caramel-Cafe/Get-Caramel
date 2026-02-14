# Step 23 - CI/CD Promotion + Rollback Pipeline

## Scope Delivered
- Replaced placeholder CI with a production-style quality gate workflow.
- Added manual release promotion workflow with environment targets.
- Added rollback path that automatically triggers on failed smoke validation.
- Added release automation scripts under `ops/release`.

## CI Workflow
File: `.github/workflows/ci.yml`

### Triggers
- Pull requests
- Pushes to `main`

### Quality Gates
- `pnpm install --frozen-lockfile`
- Monorepo build (`pnpm build`)
- Monorepo tests (`pnpm test`)
- Focused gateway tests (`pnpm --filter @get-caramel/api-gateway test`)
- Mobile typechecks:
  - customer app
  - courier app

### Artifacts
- Uploads build metadata (`sha`, `ref`, `run_id`, timestamp)

## Release Promotion Workflow
File: `.github/workflows/release.yml`

### Trigger
- Manual `workflow_dispatch`

### Inputs
- `environment`: `staging` or `production`
- `release_sha`: git SHA to deploy
- `previous_release_sha`: fallback SHA for rollback

### Stages
1. Deploy selected SHA to selected environment
2. Run smoke checks
3. If smoke fails and fallback SHA provided, run rollback automatically

## Release Scripts
- `ops/release/deploy.sh`
- `ops/release/smoke.sh`
- `ops/release/rollback.sh`

These scripts maintain release state in:
- `ops/release/state/<environment>.txt`

## Files
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `ops/release/deploy.sh`
- `ops/release/smoke.sh`
- `ops/release/rollback.sh`
