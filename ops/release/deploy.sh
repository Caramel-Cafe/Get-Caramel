#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
RELEASE_SHA="${2:-}"

if [[ -z "${ENVIRONMENT}" || -z "${RELEASE_SHA}" ]]; then
  echo "usage: deploy.sh <environment> <release_sha>"
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

OVERLAY_PATH="infra/k8s/overlays/${ENVIRONMENT}"
if [[ ! -d "${OVERLAY_PATH}" ]]; then
  echo "missing overlay path: ${OVERLAY_PATH}"
  exit 1
fi

IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/get-caramel}"
SERVICES=(
  auth-service
  catalog-service
  order-service
  payment-service
  delivery-service
  api-gateway
)

if [[ "${ENVIRONMENT}" == "production" && "${BYPASS_STAGING_GUARD:-false}" != "true" ]]; then
  STAGING_NAMESPACE="get-caramel-staging"
  for service in "${SERVICES[@]}"; do
    current_image="$(kubectl -n "${STAGING_NAMESPACE}" get deployment "${service}" -o jsonpath="{.spec.template.spec.containers[0].image}" 2>/dev/null || true)"
    expected_image="${IMAGE_REGISTRY}/${service}:${RELEASE_SHA}"
    if [[ "${current_image}" != "${expected_image}" ]]; then
      echo "Production guard failed: ${service} in ${STAGING_NAMESPACE} is '${current_image}', expected '${expected_image}'."
      echo "Deploy this SHA to staging and pass smoke checks before promoting to production."
      exit 1
    fi
  done
  echo "Production guard passed: staging is already running ${RELEASE_SHA}."
fi

kubectl apply -k "${OVERLAY_PATH}"
for service in "${SERVICES[@]}"; do
  kubectl -n "${NAMESPACE}" set image "deployment/${service}" \
    "${service}=${IMAGE_REGISTRY}/${service}:${RELEASE_SHA}"
done

for service in "${SERVICES[@]}"; do
  kubectl -n "${NAMESPACE}" rollout status "deployment/${service}" --timeout=240s
done

mkdir -p ops/release/state
STATE_FILE="ops/release/state/${ENVIRONMENT}.txt"
ROLLBACK_FILE="ops/release/state/${ENVIRONMENT}.previous.txt"

if [[ -f "${STATE_FILE}" ]]; then
  cp "${STATE_FILE}" "${ROLLBACK_FILE}"
fi

{
  echo "environment=${ENVIRONMENT}"
  echo "namespace=${NAMESPACE}"
  echo "image_registry=${IMAGE_REGISTRY}"
  echo "release_sha=${RELEASE_SHA}"
  echo "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "${STATE_FILE}"

echo "Deployed ${RELEASE_SHA} to ${ENVIRONMENT} (${NAMESPACE})"
