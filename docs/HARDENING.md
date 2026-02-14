# Production Hardening Checklist

## Secrets
- Do not commit `.env` files.
- Keep `AUTH_JWT_SECRET` rotated and >= 24 chars.
- Validate baseline config:
  - `bash ops/security/validate-secrets.sh .env.example`
  - Windows: `pnpm ops:validate-secrets`

## Backups
- Run PostgreSQL backups daily:
  - `bash ops/backup/backup.sh`
- Keep minimum 14-day retention.
- Perform weekly restore verification:
  - `bash ops/backup/restore-verify.sh <backup-file>`

## Disaster Recovery
- Run DR drill weekly:
  - `bash ops/dr/drill.sh staging`
  - Windows: `pnpm ops:dr-drill`
- Track RTO and ensure it remains within runbook target.

## CI/CD Safety
- CI must pass before merge (`.github/workflows/ci.yml`).
- Use release promotion workflow for staging/production.
- On failed smoke checks, rollback to previous known good SHA.

## Security and Access
- Route all public traffic through API gateway.
- Keep RBAC and rate limiting enabled.
- Restrict admin operations to admin role only.

## Observability
- Monitor `/metrics` per service.
- Alert on:
  - high error rate
  - p95 latency spikes
  - dead-letter queue growth

## Runbooks
- Backup/restore: `ops/runbooks/BACKUP_AND_RESTORE.md`
- Incident response: `ops/runbooks/INCIDENT_RESPONSE.md`
