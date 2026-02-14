import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): { status: "ok"; service: string; timestamp: string } {
    return { status: "ok", service: "delivery-service", timestamp: new Date().toISOString() };
  }
}
