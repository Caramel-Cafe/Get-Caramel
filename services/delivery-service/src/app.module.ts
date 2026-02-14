import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { DeliveryController } from "./modules/delivery/delivery.controller";
import { DeliveryService } from "./modules/delivery/delivery.service";
import { HealthController } from "./modules/health/health.controller";
import { MetricsController } from "./modules/metrics/metrics.controller";
import { MetricsService } from "./modules/metrics/metrics.service";
import { RequestMetricsInterceptor } from "./modules/metrics/request-metrics.interceptor";

@Module({
  controllers: [DeliveryController, HealthController, MetricsController],
  providers: [
    DeliveryService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
