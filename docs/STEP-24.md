# Step 24 - Production Hardening (Secrets, Backup, DR, Compliance Ops)

## Scope Delivered
- Added enforceable hardening scripts for secrets, backups, restore verification, and DR drills.
- Added scheduled hardening workflow in GitHub Actions.
- Upgraded runbooks for backup/restore and incident response to operational standards.
- Added centralized hardening checklist for ongoing compliance posture.

## New Automation

### Secrets Policy Validation
- Script: `ops/security/validate-secrets.sh`
- Windows helper: `ops/security/validate-secrets.ps1`
- Validates required keys and rejects insecure default secrets.

### Backup/Restore Automation
- Backup: `ops/backup/backup.sh`
- Restore verify: `ops/backup/restore-verify.sh`
- Supports retention control and restore DB verification.

### Disaster Recovery Drill
- Script: `ops/dr/drill.sh`
- Windows helper: `ops/dr/drill.ps1`
- Produces timestamped drill reports in `ops/dr/reports`.
- Validates secret baseline + rollback readiness + RTO capture.

### Scheduled Hardening Workflow
- Workflow: `.github/workflows/hardening.yml`
- Runs weekly (and manually) with:
  - secret baseline checks
  - synthetic release-state creation
  - DR drill execution
  - drill report artifact upload

## Runbooks and Docs
- Updated:
  - `ops/runbooks/BACKUP_AND_RESTORE.md`
  - `ops/runbooks/INCIDENT_RESPONSE.md`
- Added:
  - `docs/HARDENING.md`

## Root Scripts
- Added:
  - `pnpm ops:validate-secrets`
  - `pnpm ops:dr-drill`

## Validation Run
- `pnpm ops:validate-secrets` passed.
- `pnpm ops:dr-drill` passed with synthetic staging release state.

## Files
- `.github/workflows/hardening.yml`
- `ops/security/validate-secrets.sh`
- `ops/backup/backup.sh`
- `ops/backup/restore-verify.sh`
- `ops/dr/drill.sh`
- `ops/runbooks/BACKUP_AND_RESTORE.md`
- `ops/runbooks/INCIDENT_RESPONSE.md`
- `docs/HARDENING.md`
- `package.json`
- `.env.example`
