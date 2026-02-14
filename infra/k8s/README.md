# Kubernetes Deployment

This folder contains deployable Kubernetes manifests using `kustomize`.

## Layout
- `base/`: shared resources for all environments
- `overlays/staging`: staging namespace, host, replicas
- `overlays/production`: production namespace, host, replicas

## Required Cluster Setup
1. Ingress controller installed (for example `ingress-nginx`).
2. Create secrets per namespace before deploy:
```bash
kubectl -n get-caramel-staging create secret generic get-caramel-secrets \
  --from-literal=AUTH_JWT_SECRET='replace-me' \
  --from-literal=AUTH_ADMIN_INVITE_CODE='replace-me' \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=REDIS_URL='redis://...' \
  --from-literal=PESAPAL_CONSUMER_KEY='' \
  --from-literal=PESAPAL_CONSUMER_SECRET='' \
  --from-literal=SENTRY_DSN_BACKEND=''
```

Use the same secret keys in `get-caramel-production`.

## Manual Deploy
```bash
kubectl apply -k infra/k8s/overlays/staging
kubectl -n get-caramel-staging rollout status deploy/api-gateway
```

## Release Automation
CI release scripts use:
- `ops/release/deploy.sh`
- `ops/release/smoke.sh`
- `ops/release/rollback.sh`

They require:
- `kubectl` access
- namespace permissions
- container images published at `${IMAGE_REGISTRY}/<service>:<sha>`
