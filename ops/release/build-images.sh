#!/usr/bin/env bash
set -euo pipefail

RELEASE_SHA="${RELEASE_SHA:-}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/get-caramel}"

if [[ -z "${RELEASE_SHA}" ]]; then
  echo "RELEASE_SHA is required"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
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

for service in "${SERVICES[@]}"; do
  image="${IMAGE_REGISTRY}/${service}:${RELEASE_SHA}"
  echo "Building ${image}"
  docker build \
    -f infra/docker/Dockerfile.service \
    --build-arg "PACKAGE_NAME=@get-caramel/${service}" \
    --build-arg "SERVICE_PATH=services/${service}" \
    -t "${image}" \
    .
  echo "Pushing ${image}"
  docker push "${image}"
done
