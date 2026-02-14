import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { getAuthEnv } from "../../../config/env";
import { SessionRecord } from "./session-record";

@Injectable()
export class SessionStoreService {
  private readonly logger = new Logger(SessionStoreService.name);
  private readonly memory = new Map<string, SessionRecord>();
  private redis?: Redis;
  private redisEnabled = false;

  constructor() {
    const env = getAuthEnv();
    if (!env.redisUrl) return;

    this.redis = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.redis.connect()
      .then(() => {
        this.redisEnabled = true;
        this.logger.log("Redis session store enabled");
      })
      .catch((error: unknown) => {
        this.redisEnabled = false;
        this.logger.warn(`Redis unavailable; using in-memory session store. ${String(error)}`);
      });
  }

  async set(record: SessionRecord, ttlSeconds: number): Promise<void> {
    this.memory.set(record.sessionId, record);
    if (!this.redisEnabled || !this.redis) return;
    await this.redis.setex(this.redisKey(record.sessionId), ttlSeconds, JSON.stringify(record));
  }

  async get(sessionId: string): Promise<SessionRecord | null> {
    if (this.redisEnabled && this.redis) {
      const raw = await this.redis.get(this.redisKey(sessionId));
      if (raw) return JSON.parse(raw) as SessionRecord;
    }

    const fallback = this.memory.get(sessionId);
    if (!fallback) return null;
    if (fallback.expiresAtUnix <= Math.floor(Date.now() / 1000)) {
      this.memory.delete(sessionId);
      return null;
    }

    return fallback;
  }

  async delete(sessionId: string): Promise<void> {
    this.memory.delete(sessionId);
    if (this.redisEnabled && this.redis) {
      await this.redis.del(this.redisKey(sessionId));
    }
  }

  private redisKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }
}
