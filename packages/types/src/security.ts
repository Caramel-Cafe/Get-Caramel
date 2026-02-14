export type AuditOutcome = "SUCCESS" | "FAILURE";

export type AuditActorRole =
  | "customer"
  | "vendor"
  | "rider"
  | "admin"
  | "system";

export interface AuditEventRecord {
  id: string;
  service: string;
  actorKey: string;
  actorRole: AuditActorRole;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: AuditOutcome;
  metadata?: Record<string, string | number | boolean>;
  createdAtIso: string;
}

export interface AuditSummary {
  service: string;
  totalEvents: number;
  failedEvents: number;
  lastEventAtIso: string | null;
  actions: Array<{ action: string; count: number }>;
}
