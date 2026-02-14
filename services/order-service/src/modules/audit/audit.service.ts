import { AuditEventRecord, AuditSummary } from "@get-caramel/types";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditRepository } from "./repository/audit.repository";

type RecordInput = Omit<AuditEventRecord, "id" | "createdAtIso" | "service">;

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);
  private readonly serviceName = "order-service";
  private readonly events: AuditEventRecord[] = [];

  constructor(private readonly auditRepository: AuditRepository) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.auditRepository.loadRecent();
    if (!existing) return;
    this.events.splice(0, this.events.length, ...existing.slice(0, 5000));
    this.logger.log("Hydrated audit events from repository");
  }

  record(input: RecordInput): AuditEventRecord {
    const event: AuditEventRecord = {
      id: `adt_${randomUUID().slice(0, 12)}`,
      service: this.serviceName,
      createdAtIso: new Date().toISOString(),
      ...input,
    };

    this.events.unshift(event);
    if (this.events.length > 5000) this.events.length = 5000;
    void this.auditRepository.insert(event)
      .catch((error: unknown) => this.logger.warn(`Persist audit event failed: ${String(error)}`));
    return event;
  }

  list(limit = 100, action?: string, actorKey?: string): AuditEventRecord[] {
    return this.events
      .filter((event) => (action ? event.action === action : true))
      .filter((event) => (actorKey ? event.actorKey === actorKey : true))
      .slice(0, Math.min(Math.max(limit, 1), 500));
  }

  summary(): AuditSummary {
    const actionCounts = new Map<string, number>();
    let failedEvents = 0;

    for (const event of this.events) {
      actionCounts.set(event.action, (actionCounts.get(event.action) || 0) + 1);
      if (event.outcome === "FAILURE") failedEvents += 1;
    }

    return {
      service: this.serviceName,
      totalEvents: this.events.length,
      failedEvents,
      lastEventAtIso: this.events[0]?.createdAtIso || null,
      actions: Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  }
}
