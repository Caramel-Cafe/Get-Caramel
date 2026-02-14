import { OrderRecord } from "./order";

export type RealtimeEventType =
  | "order.updated"
  | "order.created"
  | "notification.created";

export interface RealtimeOrderEvent {
  type: "order.updated" | "order.created";
  order: OrderRecord;
  emittedAtIso: string;
  targetActorKeys: string[];
}

export interface NotificationItem {
  id: string;
  actorKey: string;
  title: string;
  body: string;
  createdAtIso: string;
  orderId?: string;
  read: boolean;
}

export interface RealtimeNotificationEvent {
  type: "notification.created";
  notification: NotificationItem;
  emittedAtIso: string;
  targetActorKeys: string[];
}

export type RealtimeEvent = RealtimeOrderEvent | RealtimeNotificationEvent;

export interface RegisterPushTokenRequest {
  actorKey: string;
  token: string;
  platform: "ios" | "android" | "web";
}

export interface PushDeliveryLog {
  id: string;
  actorKey: string;
  token: string;
  title: string;
  body: string;
  createdAtIso: string;
}
