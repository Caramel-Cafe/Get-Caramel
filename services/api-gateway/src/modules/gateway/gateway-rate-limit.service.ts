import { UnifiedPersistence } from "@get-caramel/persistence";
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";

type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

type RateLimitDecision = {
  limit: number;
  remaining: number;
  resetUnixMs: number;
};

@Injectable()
export class GatewayRateLimitService {
  private readonly logger = new Logger(GatewayRateLimitService.name);
  private readonly persistence = new UnifiedPersistence({
    namespace: "api-gateway",
    postgresUrl: process.env.GATEWAY_DATABASE_URL || process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    log: (message: string) => this.logger.log(message),
  });

  async enforce(clientKey: string, routeKey: string): Promise<RateLimitDecision> {
    const policy = this.policyFor(routeKey);
    const now = Date.now();
    const windowMs = policy.windowSeconds * 1000;
    const bucket = Math.floor(now / windowMs);
    const resetUnixMs = (bucket + 1) * windowMs;
    const storageKey = `ratelimit:${routeKey}:${clientKey}:${bucket}`;

    const existingRaw = await this.persistence.getCache(storageKey);
    const currentCount = existingRaw ? Number(existingRaw) : 0;
    if (currentCount >= policy.limit) {
      throw new HttpException({
        message: "Rate limit exceeded",
        limit: policy.limit,
        resetUnixMs,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const nextCount = currentCount + 1;
    const ttl = Math.max(1, Math.ceil((resetUnixMs - now) / 1000));
    await this.persistence.setCache(storageKey, String(nextCount), ttl);

    return {
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - nextCount),
      resetUnixMs,
    };
  }

  private policyFor(routeKey: string): RateLimitPolicy {
    if (routeKey.startsWith("auth")) return { limit: 60, windowSeconds: 60 };
    if (routeKey === "orders/checkout") return { limit: 30, windowSeconds: 60 };
    if (routeKey === "payments/confirm") return { limit: 30, windowSeconds: 60 };
    if (routeKey === "payments/intents") return { limit: 40, windowSeconds: 60 };
    if (routeKey === "payouts/run") return { limit: 10, windowSeconds: 60 };
    return { limit: 180, windowSeconds: 60 };
  }
}
