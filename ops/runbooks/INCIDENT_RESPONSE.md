# Incident Response Runbook

## Severity Levels
- `SEV-1`: Customer checkout/auth outage, security incident, data integrity risk.
- `SEV-2`: Significant latency/error regression with partial functionality.
- `SEV-3`: Localized feature degradation with workaround.

## First 10 Minutes
1. Assign incident commander and communications owner.
2. Freeze deployments and schema changes.
3. Collect service snapshots:
   - `/health`
   - `/metrics?windowSec=300`
   - queue status endpoints
4. Record timeline in UTC.

## Triage Paths
1. Security signal:
   - Rotate compromised secret immediately.
   - Revoke active tokens if auth scope impacted.
2. Availability signal:
   - Reduce abusive load via gateway rate limits.
   - Drain unhealthy instances.
3. Data integrity signal:
   - Pause write traffic.
   - Prepare restore candidate and rollback plan.

## Containment Actions
1. Disable non-critical background jobs.
2. Restrict admin mutating endpoints if breach suspected.
3. Trigger rollback workflow to last known-good release.

## Recovery Checklist
1. Validate fix in staging.
2. Deploy via release workflow.
3. Run smoke and metrics checks for 30 minutes.
4. Confirm user-facing status green.

## Post-Incident
- Publish postmortem within 48 hours including:
  - Root cause
  - Blast radius
  - Corrective actions (owner + due date)
  - Preventive hardening items
