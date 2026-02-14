import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { Subscription } from "rxjs";
import { RealtimeEvent } from "@get-caramel/types";
import { RealtimeEventsService } from "./realtime-events.service";

@WebSocketGateway({
  cors: { origin: "*" },
  namespace: "/realtime",
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private eventsSub?: Subscription;

  constructor(private readonly events: RealtimeEventsService) {}

  onModuleInit(): void {
    this.eventsSub = this.events.events$.subscribe((event: RealtimeEvent) => {
      this.server.emit("realtime:event", event);
      for (const actorKey of event.targetActorKeys) {
        this.server.to(actorKey).emit("realtime:event", event);
      }
    });
  }

  onModuleDestroy(): void {
    this.eventsSub?.unsubscribe();
  }

  handleConnection(client: Socket): void {
    const actorKey = client.handshake.query.actorKey;
    if (typeof actorKey === "string" && actorKey.length > 0) {
      client.join(actorKey);
      this.logger.log(`Socket ${client.id} joined ${actorKey}`);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }
}
