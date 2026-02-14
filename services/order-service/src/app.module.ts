import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditController } from "./modules/audit/audit.controller";
import { AuditRepository } from "./modules/audit/repository/audit.repository";
import { AuditService } from "./modules/audit/audit.service";
import { HealthController } from "./modules/health/health.controller";
import { MetricsController } from "./modules/metrics/metrics.controller";
import { MetricsService } from "./modules/metrics/metrics.service";
import { RequestMetricsInterceptor } from "./modules/metrics/request-metrics.interceptor";
import { NotificationsController } from "./modules/notifications/notifications.controller";
import { NotificationsRepository } from "./modules/notifications/repository/notifications.repository";
import { NotificationsService } from "./modules/notifications/notifications.service";
import { OrderController } from "./modules/order/order.controller";
import { OrderRepository } from "./modules/order/repository/order.repository";
import { OrderService } from "./modules/order/order.service";
import { RealtimeEventsService } from "./modules/realtime/realtime-events.service";
import { RealtimeGateway } from "./modules/realtime/realtime.gateway";

@Module({
  controllers: [OrderController, HealthController, NotificationsController, AuditController, MetricsController],
  providers: [
    OrderService,
    OrderRepository,
    RealtimeEventsService,
    RealtimeGateway,
    NotificationsService,
    NotificationsRepository,
    AuditService,
    AuditRepository,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
