import { AuditEventRecord, AuditSummary } from "@get-caramel/types";
import { Controller, Get, Query } from "@nestjs/common";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get("events")
  events(
    @Query("limit") limit?: string,
    @Query("action") action?: string,
    @Query("actorKey") actorKey?: string,
  ): AuditEventRecord[] {
    return this.audit.list(limit ? Number(limit) : 100, action, actorKey);
  }

  @Get("summary")
  summary(): AuditSummary {
    return this.audit.summary();
  }
}
