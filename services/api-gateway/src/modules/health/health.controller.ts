import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health(): { service: string; ok: true; nowIso: string } {
    return { service: "api-gateway", ok: true, nowIso: new Date().toISOString() };
  }
}
