#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"
ALLOW_DEFAULTS="${2:-}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

declare -a REQUIRED_KEYS=(
  "AUTH_JWT_SECRET"
  "DATABASE_URL"
)

for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -q "^${key}=" "${ENV_FILE}"; then
    echo "Missing required key: ${key}"
    exit 1
  fi
done

jwt_secret="$(grep '^AUTH_JWT_SECRET=' "${ENV_FILE}" | head -n1 | cut -d'=' -f2-)"
if [[ "${ALLOW_DEFAULTS}" != "--allow-defaults" && ( "${jwt_secret}" == "replace_this_with_long_random_secret" || "${jwt_secret}" == "change-me-in-production" ) ]]; then
  echo "AUTH_JWT_SECRET is using an insecure default value"
  exit 1
fi

if [[ "${ALLOW_DEFAULTS}" != "--allow-defaults" && "${#jwt_secret}" -lt 24 ]]; then
  echo "AUTH_JWT_SECRET must be at least 24 characters"
  exit 1
fi

if [[ "${ALLOW_DEFAULTS}" != "--allow-defaults" ]] && grep -Eq '=(password|changeme|secret|postgres)$' "${ENV_FILE}"; then
  echo "Potential default secret values detected in ${ENV_FILE}"
  exit 1
fi

echo "Secret validation passed for ${ENV_FILE}"
