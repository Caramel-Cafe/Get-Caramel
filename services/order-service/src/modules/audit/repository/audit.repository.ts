import { CoreDatabase } from "@get-caramel/database";
import { AuditEventRecord } from "@get-caramel/types";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class AuditRepository {
  private readonly logger = new Logger(AuditRepository.name);
  private readonly db = new CoreDatabase({
    connectionString: process.env.ORDER_DATABASE_URL || process.env.DATABASE_URL,
    log: (message: string) => this.logger.log(message),
  });
  private initialized = false;

  async loadRecent(limit = 5000): Promise<AuditEventRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;
    const rows = await this.db.query(
      "select * from audit_events where service = 'order-service' order by created_at_iso desc limit $1",
      [limit],
    );
    return rows.map((row) => this.mapAuditEvent(row));
  }

  async insert(event: AuditEventRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into audit_events (id, service, actor_key, actor_role, action, resource_type, resource_id, outcome, metadata_json, created_at_iso) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (id) do nothing",
      [
        event.id,
        event.service,
        event.actorKey,
        event.actorRole,
        event.action,
        event.resourceType,
        event.resourceId || null,
        event.outcome,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.createdAtIso,
      ],
    );
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.db.init();
  }

  private mapAuditEvent(row: Record<string, unknown>): AuditEventRecord {
    return {
      id: String(row.id),
      service: String(row.service),
      actorKey: String(row.actor_key),
      actorRole: String(row.actor_role) as AuditEventRecord["actorRole"],
      action: String(row.action),
      resourceType: String(row.resource_type),
      resourceId: row.resource_id ? String(row.resource_id) : undefined,
      outcome: String(row.outcome) as AuditEventRecord["outcome"],
      metadata: row.metadata_json ? (JSON.parse(String(row.metadata_json)) as Record<string, string | number | boolean>) : undefined,
      createdAtIso: String(row.created_at_iso),
    };
  }
}
