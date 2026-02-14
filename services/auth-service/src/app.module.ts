import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditController } from "./modules/audit/audit.controller";
import { AuditService } from "./modules/audit/audit.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { SessionStoreService } from "./modules/auth/storage/session-store.service";
import { UserStoreService } from "./modules/auth/storage/user-store.service";
import { HealthController } from "./modules/health/health.controller";
import { MetricsController } from "./modules/metrics/metrics.controller";
import { MetricsService } from "./modules/metrics/metrics.service";
import { RequestMetricsInterceptor } from "./modules/metrics/request-metrics.interceptor";

@Module({
  controllers: [AuthController, HealthController, AuditController, MetricsController],
  providers: [
    AuthService,
    SessionStoreService,
    UserStoreService,
    AuditService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
