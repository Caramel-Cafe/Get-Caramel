import { CoreDatabase } from "@get-caramel/database";
import { NotificationItem, PushDeliveryLog } from "@get-caramel/types";
import { Injectable, Logger } from "@nestjs/common";

type PushTokenRecord = {
  actorKey: string;
  token: string;
  platform: "ios" | "android" | "web";
};

type NotificationState = {
  notificationsByActor: Array<[string, NotificationItem[]]>;
  pushTokensByActor: Array<[string, PushTokenRecord[]]>;
  pushLogs: PushDeliveryLog[];
};

@Injectable()
export class NotificationsRepository {
  private readonly logger = new Logger(NotificationsRepository.name);
  private readonly db = new CoreDatabase({
    connectionString: process.env.ORDER_DATABASE_URL || process.env.DATABASE_URL,
    log: (message: string) => this.logger.log(message),
  });
  private initialized = false;

  async loadState(): Promise<NotificationState | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    const notificationRows = await this.db.query(
      "select * from notifications order by created_at_iso desc limit 5000",
    );
    const tokenRows = await this.db.query(
      "select * from push_tokens",
    );
    const pushLogRows = await this.db.query(
      "select * from push_logs order by created_at_iso desc limit 5000",
    );

    const notificationsByActorMap = new Map<string, NotificationItem[]>();
    for (const row of notificationRows) {
      const item = this.mapNotification(row);
      const current = notificationsByActorMap.get(item.actorKey) || [];
      current.push(item);
      notificationsByActorMap.set(item.actorKey, current.slice(0, 200));
    }

    const pushTokensByActorMap = new Map<string, PushTokenRecord[]>();
    for (const row of tokenRows) {
      const token = this.mapPushToken(row);
      const current = pushTokensByActorMap.get(token.actorKey) || [];
      current.push(token);
      pushTokensByActorMap.set(token.actorKey, current);
    }

    return {
      notificationsByActor: Array.from(notificationsByActorMap.entries()),
      pushTokensByActor: Array.from(pushTokensByActorMap.entries()),
      pushLogs: pushLogRows.map((row) => this.mapPushLog(row)),
    };
  }

  async upsertNotification(notification: NotificationItem): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into notifications (id, actor_key, title, body, order_id, created_at_iso, is_read) values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do update set title=excluded.title, body=excluded.body, order_id=excluded.order_id, is_read=excluded.is_read",
      [notification.id, notification.actorKey, notification.title, notification.body, notification.orderId || null, notification.createdAtIso, notification.read],
    );
  }

  async upsertPushToken(record: PushTokenRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into push_tokens (actor_key, token, platform, updated_at_iso) values ($1,$2,$3,$4) on conflict (actor_key, token) do update set platform=excluded.platform, updated_at_iso=excluded.updated_at_iso",
      [record.actorKey, record.token, record.platform, new Date().toISOString()],
    );
  }

  async appendPushLog(log: PushDeliveryLog): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into push_logs (id, actor_key, token, title, body, created_at_iso) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing",
      [log.id, log.actorKey, log.token, log.title, log.body, log.createdAtIso],
    );
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.db.init();
  }

  private mapNotification(row: Record<string, unknown>): NotificationItem {
    return {
      id: String(row.id),
      actorKey: String(row.actor_key),
      title: String(row.title),
      body: String(row.body),
      orderId: row.order_id ? String(row.order_id) : undefined,
      createdAtIso: String(row.created_at_iso),
      read: Boolean(row.is_read),
    };
  }

  private mapPushToken(row: Record<string, unknown>): PushTokenRecord {
    return {
      actorKey: String(row.actor_key),
      token: String(row.token),
      platform: String(row.platform) as PushTokenRecord["platform"],
    };
  }

  private mapPushLog(row: Record<string, unknown>): PushDeliveryLog {
    return {
      id: String(row.id),
      actorKey: String(row.actor_key),
      token: String(row.token),
      title: String(row.title),
      body: String(row.body),
      createdAtIso: String(row.created_at_iso),
    };
  }
}
