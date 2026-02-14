# Backup And Restore Runbook

## Objective
- Maintain recoverable PostgreSQL backups with defined retention and restore verification.
- Target `RPO <= 24h` and `RTO <= 60m` for baseline environment.

## Prerequisites
- `pg_dump`, `pg_restore`, `psql`, `createdb`, `dropdb` installed.
- `DATABASE_URL` set for source database.
- `RESTORE_DATABASE_URL` set for restore validation target.

## Backup Procedure
```bash
bash ops/backup/backup.sh
```
PowerShell (Windows):
```powershell
# Use WSL/Git-Bash for backup scripts, or invoke from CI on Linux runners.
```

Environment overrides:
- `BACKUP_DIR` default: `ops/backup/artifacts`
- `RETENTION_DAYS` default: `14`

Expected output:
- `ops/backup/artifacts/get-caramel-<timestamp>.dump.gz`

## Restore Verification Procedure
```bash
bash ops/backup/restore-verify.sh ops/backup/artifacts/get-caramel-YYYYMMDDTHHMMSSZ.dump.gz
```

Environment overrides:
- `RESTORE_DB` default: `get_caramel_restore`
- `RESTORE_DATABASE_URL` required

## Post-Restore Validation
1. Verify schema migration status from database package.
2. Call health endpoints:
   - gateway `/health`
   - auth `/health`
   - catalog `/health`
   - order `/health`
   - payment `/health`
3. Run smoke checks through gateway.

## Escalation Triggers
- Restore exceeds 60 minutes -> escalate `SEV-1`.
- Data mismatch across critical tables -> freeze write traffic and invoke incident process.
