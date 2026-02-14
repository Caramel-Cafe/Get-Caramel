import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { GatewayAuthzService } from "./modules/gateway/gateway-authz.service";
import { GatewayController } from "./modules/gateway/gateway.controller";
import { GatewayProxyService } from "./modules/gateway/gateway-proxy.service";
import { GatewayRateLimitService } from "./modules/gateway/gateway-rate-limit.service";
import { HealthController } from "./modules/health/health.controller";
import { MetricsController } from "./modules/metrics/metrics.controller";
import { MetricsService } from "./modules/metrics/metrics.service";
import { RequestMetricsInterceptor } from "./modules/metrics/request-metrics.interceptor";

@Module({
  controllers: [GatewayController, HealthController, MetricsController],
  providers: [
    GatewayProxyService,
    GatewayRateLimitService,
    GatewayAuthzService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
