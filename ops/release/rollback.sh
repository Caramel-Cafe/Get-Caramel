#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
PREVIOUS_SHA="${2:-}"

if [[ -z "${ENVIRONMENT}" || -z "${PREVIOUS_SHA}" ]]; then
  echo "usage: rollback.sh <environment> <previous_release_sha>"
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required"
  exit 1
fi

case "${ENVIRONMENT}" in
  staging) NAMESPACE="get-caramel-staging" ;;
  production) NAMESPACE="get-caramel-production" ;;
  *)
    echo "unsupported environment: ${ENVIRONMENT}"
    exit 1
    ;;
esac

IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/get-caramel}"
SERVICES=(
  auth-service
  catalog-service
  order-service
  payment-service
  delivery-service
  api-gateway
)

for service in "${SERVICES[@]}"; do
  kubectl -n "${NAMESPACE}" set image "deployment/${service}" \
    "${service}=${IMAGE_REGISTRY}/${service}:${PREVIOUS_SHA}"
done

for service in "${SERVICES[@]}"; do
  kubectl -n "${NAMESPACE}" rollout status "deployment/${service}" --timeout=240s
done

mkdir -p ops/release/state
STATE_FILE="ops/release/state/${ENVIRONMENT}.txt"

{
  echo "environment=${ENVIRONMENT}"
  echo "namespace=${NAMESPACE}"
  echo "image_registry=${IMAGE_REGISTRY}"
  echo "release_sha=${PREVIOUS_SHA}"
  echo "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "rollback=true"
} > "${STATE_FILE}"

echo "Rolled back ${ENVIRONMENT} (${NAMESPACE}) to ${PREVIOUS_SHA}"
