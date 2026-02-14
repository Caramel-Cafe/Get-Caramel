#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-ops/backup/artifacts}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "${DATABASE_URL}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/get-caramel-${STAMP}.dump"

pg_dump "${DATABASE_URL}" --format=custom --no-owner --file "${FILE}"
gzip -f "${FILE}"

find "${BACKUP_DIR}" -type f -name "*.dump.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "Backup created: ${FILE}.gz"
