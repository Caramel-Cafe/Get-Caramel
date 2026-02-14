import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditController } from "./modules/audit/audit.controller";
import { AuditService } from "./modules/audit/audit.service";
import { HealthController } from "./modules/health/health.controller";
import { MetricsController } from "./modules/metrics/metrics.controller";
import { MetricsService } from "./modules/metrics/metrics.service";
import { RequestMetricsInterceptor } from "./modules/metrics/request-metrics.interceptor";
import { PaymentController } from "./modules/payment/payment.controller";
import { PaymentRepository } from "./modules/payment/repository/payment.repository";
import { PaymentService } from "./modules/payment/payment.service";

@Module({
  controllers: [PaymentController, HealthController, AuditController, MetricsController],
  providers: [
    PaymentService,
    PaymentRepository,
    AuditService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
