import { Controller, Get, Query } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  metricsSnapshot(@Query("windowSec") windowSec?: string): ReturnType<MetricsService["snapshot"]> {
    return this.metrics.snapshot(Number(windowSec || 300));
  }
}
