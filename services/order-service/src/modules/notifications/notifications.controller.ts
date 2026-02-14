import { DeadLetterJobRecord, DurableJobQueueStatus } from "@get-caramel/persistence";
import { NotificationItem, PushDeliveryLog } from "@get-caramel/types";
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("actor/:actorKey")
  actorNotifications(@Param("actorKey") actorKey: string): NotificationItem[] {
    return this.notifications.listByActor(actorKey);
  }

  @Get("customer/:customerId")
  customerNotifications(@Param("customerId") customerId: string): NotificationItem[] {
    return this.notifications.listByActor(`customer:${customerId}`);
  }

  @Get("vendor/:vendorId")
  vendorNotifications(@Param("vendorId") vendorId: string): NotificationItem[] {
    return this.notifications.listByActor(`vendor:${vendorId}`);
  }

  @Get("rider/:riderId")
  riderNotifications(@Param("riderId") riderId: string): NotificationItem[] {
    return this.notifications.listByActor(`rider:${riderId}`);
  }

  @Get("admin")
  adminNotifications(): NotificationItem[] {
    return this.notifications.listByActor("admin:ops");
  }

  @Post("push/register")
  registerPush(@Body() dto: RegisterPushTokenDto): { success: true } {
    return this.notifications.registerPushToken(dto.actorKey, dto.token, dto.platform);
  }

  @Get("push/logs/:actorKey")
  pushLogs(@Param("actorKey") actorKey: string): PushDeliveryLog[] {
    return this.notifications.listPushLogs(actorKey);
  }

  @Get("push/queue/status")
  pushQueueStatus(): Promise<DurableJobQueueStatus> {
    return this.notifications.getPushQueueStatus();
  }

  @Get("push/queue/dead-letter")
  pushDeadLetters(@Query("limit") limit?: string): Promise<DeadLetterJobRecord<unknown>[]> {
    return this.notifications.listPushDeadLetters(Number(limit || 100));
  }
}
