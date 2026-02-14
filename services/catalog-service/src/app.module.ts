import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CatalogController } from "./modules/catalog/catalog.controller";
import { CatalogService } from "./modules/catalog/catalog.service";
import { HealthController } from "./modules/health/health.controller";
import { MetricsController } from "./modules/metrics/metrics.controller";
import { MetricsService } from "./modules/metrics/metrics.service";
import { RequestMetricsInterceptor } from "./modules/metrics/request-metrics.interceptor";

@Module({
  controllers: [CatalogController, HealthController, MetricsController],
  providers: [
    CatalogService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
