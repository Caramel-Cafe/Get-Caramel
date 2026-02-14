import { DeadLetterJobRecord, DurableJobQueue, DurableJobQueueStatus } from "@get-caramel/persistence";
import { NotificationItem, PushDeliveryLog, RealtimeNotificationEvent } from "@get-caramel/types";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { RealtimeEventsService } from "../realtime/realtime-events.service";
import { NotificationsRepository } from "./repository/notifications.repository";

type PushDispatchPayload = {
  actorKey: string;
  notificationId: string;
  title: string;
  body: string;
  orderId?: string;
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly notifications = new Map<string, NotificationItem[]>();
  private readonly pushTokens = new Map<string, { token: string; platform: "ios" | "android" | "web" }[]>();
  private readonly pushLogs: PushDeliveryLog[] = [];
  private readonly pushQueue = new DurableJobQueue<PushDispatchPayload>({
    namespace: "order-service",
    queueName: "push-delivery",
    pollIntervalMs: 500,
    maxAttempts: 4,
    baseDelayMs: 300,
    maxDelayMs: 10000,
    postgresUrl: process.env.ORDER_DATABASE_URL || process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
  });

  constructor(
    private readonly realtime: RealtimeEventsService,
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const state = await this.notificationsRepository.loadState();
    if (state) {
      this.notifications.clear();
      this.pushTokens.clear();
      this.pushLogs.splice(0, this.pushLogs.length, ...state.pushLogs.slice(0, 200));
      for (const [actorKey, items] of state.notificationsByActor) this.notifications.set(actorKey, items.slice(0, 200));
      for (const [actorKey, tokens] of state.pushTokensByActor) {
        this.pushTokens.set(actorKey, tokens.map((token) => ({ token: token.token, platform: token.platform })));
      }
      this.logger.log("Hydrated notifications state from repository");
    }

    await this.pushQueue.start(async (job: { payload: PushDispatchPayload; attempt: number }) => {
      await this.processPushJob(job.payload, job.attempt);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pushQueue.stop();
  }

  create(actorKey: string, title: string, body: string, orderId?: string): NotificationItem {
    const item: NotificationItem = {
      id: `ntf_${randomUUID().slice(0, 10)}`,
      actorKey,
      title,
      body,
      orderId,
      createdAtIso: new Date().toISOString(),
      read: false,
    };

    const current = this.notifications.get(actorKey) || [];
    current.unshift(item);
    this.notifications.set(actorKey, current.slice(0, 200));
    void this.notificationsRepository.upsertNotification(item)
      .catch((error: unknown) => this.logger.warn(`Persist notification failed: ${String(error)}`));

    this.emitRealtime(item);
    this.enqueuePush(item);

    return item;
  }

  listByActor(actorKey: string): NotificationItem[] {
    return this.notifications.get(actorKey) || [];
  }

  registerPushToken(actorKey: string, token: string, platform: "ios" | "android" | "web"): { success: true } {
    const current = this.pushTokens.get(actorKey) || [];
    if (!current.find((entry) => entry.token === token)) {
      current.push({ token, platform });
    }
    this.pushTokens.set(actorKey, current);
    void this.notificationsRepository.upsertPushToken({ actorKey, token, platform })
      .catch((error: unknown) => this.logger.warn(`Persist push token failed: ${String(error)}`));
    return { success: true };
  }

  listPushLogs(actorKey: string): PushDeliveryLog[] {
    return this.pushLogs.filter((log) => log.actorKey === actorKey).slice(0, 200);
  }

  getPushQueueStatus(): Promise<DurableJobQueueStatus> {
    return this.pushQueue.getStatus();
  }

  listPushDeadLetters(limit = 100): Promise<DeadLetterJobRecord<PushDispatchPayload>[]> {
    return this.pushQueue.listDeadLetters(limit);
  }

  private emitRealtime(item: NotificationItem): void {
    const event: RealtimeNotificationEvent = {
      type: "notification.created",
      notification: item,
      emittedAtIso: new Date().toISOString(),
      targetActorKeys: [item.actorKey],
    };

    this.realtime.emit(event);
  }

  private enqueuePush(item: NotificationItem): void {
    void this.pushQueue.enqueue("push.dispatch", {
      actorKey: item.actorKey,
      notificationId: item.id,
      title: item.title,
      body: item.body,
      orderId: item.orderId,
    }).catch((error: unknown) => {
      this.logger.warn(`Queue push dispatch failed, processing inline: ${String(error)}`);
      void this.processPushJob({
        actorKey: item.actorKey,
        notificationId: item.id,
        title: item.title,
        body: item.body,
        orderId: item.orderId,
      }, 0);
    });
  }

  private async processPushJob(payload: PushDispatchPayload, _attempt: number): Promise<void> {
    const tokens = this.pushTokens.get(payload.actorKey) || [];
    for (const tokenInfo of tokens) {
      const log: PushDeliveryLog = {
        id: `push_${randomUUID().slice(0, 10)}`,
        actorKey: payload.actorKey,
        token: tokenInfo.token,
        title: payload.title,
        body: payload.body,
        createdAtIso: new Date().toISOString(),
      };
      this.pushLogs.unshift(log);
      void this.notificationsRepository.appendPushLog(log)
        .catch((error: unknown) => this.logger.warn(`Persist push log failed: ${String(error)}`));
    }

    this.pushLogs.splice(200);
  }
}
