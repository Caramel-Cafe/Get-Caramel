#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
RESTORE_DB="${RESTORE_DB:-get_caramel_restore}"
RESTORE_DATABASE_URL="${RESTORE_DATABASE_URL:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "usage: restore-verify.sh <backup_file.dump.gz>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

if [[ -z "${RESTORE_DATABASE_URL}" ]]; then
  echo "RESTORE_DATABASE_URL is required"
  exit 1
fi

TMP_DUMP="$(mktemp)"
gunzip -c "${BACKUP_FILE}" > "${TMP_DUMP}"

dropdb --if-exists "${RESTORE_DB}"
createdb "${RESTORE_DB}"
pg_restore --no-owner --dbname "${RESTORE_DB}" "${TMP_DUMP}"
rm -f "${TMP_DUMP}"

PGDATABASE="${RESTORE_DB}" psql "${RESTORE_DATABASE_URL}" -c "select now();" >/dev/null
echo "Restore verification passed for ${RESTORE_DB}"
