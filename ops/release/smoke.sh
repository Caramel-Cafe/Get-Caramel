#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
if [[ -z "${ENVIRONMENT}" ]]; then
  echo "usage: smoke.sh <environment>"
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

STATE_FILE="ops/release/state/${ENVIRONMENT}.txt"
if [[ ! -f "${STATE_FILE}" ]]; then
  echo "No deployed release state found for ${ENVIRONMENT}"
  exit 1
fi

SERVICES=(
  auth-service
  catalog-service
  order-service
  payment-service
  delivery-service
  api-gateway
)

echo "Running smoke checks for ${ENVIRONMENT} (${NAMESPACE})"
for service in "${SERVICES[@]}"; do
  kubectl -n "${NAMESPACE}" rollout status "deployment/${service}" --timeout=180s
  ready="$(kubectl -n "${NAMESPACE}" get deployment "${service}" -o jsonpath='{.status.readyReplicas}')"
  if [[ -z "${ready}" || "${ready}" == "0" ]]; then
    echo "deployment/${service} has no ready replicas"
    exit 1
  fi
done

host="$(kubectl -n "${NAMESPACE}" get ingress api-gateway -o jsonpath='{.spec.rules[0].host}')"
if [[ -z "${host}" ]]; then
  echo "ingress/api-gateway host is empty"
  exit 1
fi

grep -q "^release_sha=" "${STATE_FILE}"
grep -q "^deployed_at=" "${STATE_FILE}"
echo "Smoke checks passed for ${ENVIRONMENT} (${host})"
