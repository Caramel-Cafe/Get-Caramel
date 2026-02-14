# Release Promotion (Staging -> Production)

This project uses a promotion model:
- deploy to `staging` first
- validate and smoke test
- promote the same SHA to `production`

## One-Time GitHub Setup
1. Create repository secret `KUBE_CONFIG_B64` (base64 kubeconfig with access to both namespaces).
2. Create repository variable `IMAGE_REGISTRY` (for example `ghcr.io/get-caramel`).
3. Create GitHub environments:
   - `staging`
   - `production` (recommended: required reviewers for manual approval)

## One-Time Cluster Setup
1. Ensure namespaces exist:
   - `get-caramel-staging`
   - `get-caramel-production`
2. Create `get-caramel-secrets` in both namespaces.
3. Ensure ingress/DNS resolves:
   - staging host
   - production host

## Promotion Steps Per Release
1. Merge code and choose a commit SHA (`release_sha`).
2. Run workflow `Release Promotion`:
   - `environment=staging`
   - `release_sha=<sha>`
   - `previous_release_sha=<last-known-good-sha>`
3. Validate staging manually (UI + API checks).
4. Run workflow `Release Promotion` again:
   - `environment=production`
   - `release_sha=<same-sha>`
   - `previous_release_sha=<last-known-good-sha>`

## Production Guardrail
Production deploy is blocked unless staging is already running the exact same SHA image for all services.

If you intentionally need to bypass this (not recommended), set:
- `BYPASS_STAGING_GUARD=true`

## Rollback
If smoke checks fail and `previous_release_sha` is provided, rollback job runs automatically.
