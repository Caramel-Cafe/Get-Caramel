type MemoryCacheValue = {
  value: string;
  expiresAtUnixMs: number;
};

declare const require: (id: string) => any;

export interface PersistenceOptions {
  namespace: string;
  postgresUrl?: string;
  redisUrl?: string;
  log?: (message: string) => void;
}

export interface DurableJobQueueOptions {
  namespace: string;
  queueName: string;
  pollIntervalMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  deadLetterLimit?: number;
  postgresUrl?: string;
  redisUrl?: string;
  log?: (message: string) => void;
}

export interface DurableJobRecord<TPayload> {
  id: string;
  queueName: string;
  type: string;
  payload: TPayload;
  attempt: number;
  nextRunAtUnixMs: number;
  createdAtIso: string;
  updatedAtIso: string;
  lastError?: string;
}

export interface DeadLetterJobRecord<TPayload> extends DurableJobRecord<TPayload> {
  failedAtIso: string;
}

export interface DurableJobQueueStatus {
  queueName: string;
  pendingCount: number;
  deadLetterCount: number;
  processing: boolean;
  pollIntervalMs: number;
  maxAttempts: number;
  lastProcessedAtIso?: string;
  lastError?: string;
}

export interface IdempotencyStoreOptions {
  namespace: string;
  ttlSeconds?: number;
  postgresUrl?: string;
  redisUrl?: string;
  log?: (message: string) => void;
}

export interface IdempotencyRecord<TResponse> {
  key: string;
  response: TResponse;
  createdAtIso: string;
  expiresAtUnixMs: number;
}

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

type RedisClient = {
  connect: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode?: string, ttl?: number) => Promise<unknown>;
};

type JobQueueState<TPayload> = {
  pending: DurableJobRecord<TPayload>[];
  deadLetters: DeadLetterJobRecord<TPayload>[];
};

export class UnifiedPersistence {
  private readonly memoryState = new Map<string, string>();
  private readonly memoryCache = new Map<string, MemoryCacheValue>();
  private readonly namespace: string;
  private readonly postgresUrl?: string;
  private readonly redisUrl?: string;
  private readonly log: (message: string) => void;
  private pg?: PgPool;
  private redis?: RedisClient;
  private initPromise?: Promise<void>;

  constructor(options: PersistenceOptions) {
    this.namespace = options.namespace;
    this.postgresUrl = options.postgresUrl;
    this.redisUrl = options.redisUrl;
    this.log = options.log || (() => undefined);
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
  }

  async getState<T>(key: string): Promise<T | null> {
    await this.init();
    const scopedKey = this.stateKey(key);

    if (this.pg) {
      try {
        const result = await this.pg.query(
          "select value_json from app_state where namespace = $1 and key = $2 limit 1",
          [this.namespace, key],
        );
        const row = result.rows[0];
        if (row && typeof row.value_json === "string") {
          return JSON.parse(row.value_json) as T;
        }
      } catch (error) {
        this.log(`postgres getState fallback to memory: ${String(error)}`);
      }
    }

    const raw = this.memoryState.get(scopedKey);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setState<T>(key: string, value: T): Promise<void> {
    await this.init();
    const scopedKey = this.stateKey(key);
    const encoded = JSON.stringify(value);
    this.memoryState.set(scopedKey, encoded);

    if (!this.pg) return;
    try {
      await this.pg.query(
        "insert into app_state (namespace, key, value_json, updated_at) values ($1, $2, $3, now()) on conflict (namespace, key) do update set value_json = excluded.value_json, updated_at = now()",
        [this.namespace, key, encoded],
      );
    } catch (error) {
      this.log(`postgres setState failed: ${String(error)}`);
    }
  }

  async getCache(key: string): Promise<string | null> {
    await this.init();
    const scopedKey = this.cacheKey(key);

    if (this.redis) {
      try {
        return await this.redis.get(scopedKey);
      } catch (error) {
        this.log(`redis getCache fallback to memory: ${String(error)}`);
      }
    }

    const cached = this.memoryCache.get(scopedKey);
    if (!cached) return null;
    if (cached.expiresAtUnixMs <= Date.now()) {
      this.memoryCache.delete(scopedKey);
      return null;
    }
    return cached.value;
  }

  async setCache(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.init();
    const scopedKey = this.cacheKey(key);
    this.memoryCache.set(scopedKey, {
      value,
      expiresAtUnixMs: Date.now() + (ttlSeconds * 1000),
    });

    if (!this.redis) return;
    try {
      await this.redis.set(scopedKey, value, "EX", ttlSeconds);
    } catch (error) {
      this.log(`redis setCache failed: ${String(error)}`);
    }
  }

  private async initialize(): Promise<void> {
    await this.tryInitPostgres();
    await this.tryInitRedis();
  }

  private async tryInitPostgres(): Promise<void> {
    if (!this.postgresUrl) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pg = require("pg") as { Pool: new (options: { connectionString: string }) => PgPool };
      this.pg = new pg.Pool({ connectionString: this.postgresUrl });
      await this.pg.query(
        "create table if not exists app_state (namespace text not null, key text not null, value_json text not null, updated_at timestamptz not null default now(), primary key(namespace, key))",
      );
      this.log(`postgres enabled for ${this.namespace}`);
    } catch (error) {
      this.pg = undefined;
      this.log(`postgres unavailable for ${this.namespace}; using memory: ${String(error)}`);
    }
  }

  private async tryInitRedis(): Promise<void> {
    if (!this.redisUrl) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require("ioredis") as new (url: string, options: Record<string, unknown>) => RedisClient;
      this.redis = new Redis(this.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await this.redis.connect();
      this.log(`redis enabled for ${this.namespace}`);
    } catch (error) {
      this.redis = undefined;
      this.log(`redis unavailable for ${this.namespace}; using memory: ${String(error)}`);
    }
  }

  private stateKey(key: string): string {
    return `${this.namespace}:state:${key}`;
  }

  private cacheKey(key: string): string {
    return `${this.namespace}:cache:${key}`;
  }
}

export class DurableJobQueue<TPayload> {
  private readonly queueName: string;
  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly deadLetterLimit: number;
  private readonly persistence: UnifiedPersistence;
  private readonly log: (message: string) => void;
  private readonly stateKey: string;
  private timer?: ReturnType<typeof setInterval>;
  private handler?: (job: DurableJobRecord<TPayload>) => Promise<void>;
  private isProcessing = false;
  private lastProcessedAtIso?: string;
  private lastError?: string;

  constructor(options: DurableJobQueueOptions) {
    this.queueName = options.queueName;
    this.pollIntervalMs = options.pollIntervalMs ?? 750;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.deadLetterLimit = options.deadLetterLimit ?? 500;
    this.log = options.log || (() => undefined);
    this.stateKey = `queue:${this.queueName}:state`;
    this.persistence = new UnifiedPersistence({
      namespace: `${options.namespace}:jobs`,
      postgresUrl: options.postgresUrl,
      redisUrl: options.redisUrl,
      log: this.log,
    });
  }

  async start(handler: (job: DurableJobRecord<TPayload>) => Promise<void>): Promise<void> {
    this.handler = handler;
    await this.persistence.init();
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async enqueue(type: string, payload: TPayload, runAtUnixMs = Date.now()): Promise<DurableJobRecord<TPayload>> {
    const state = await this.loadState();
    const nowIso = new Date().toISOString();
    const job: DurableJobRecord<TPayload> = {
      id: this.nextId(),
      queueName: this.queueName,
      type,
      payload,
      attempt: 0,
      nextRunAtUnixMs: runAtUnixMs,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    state.pending.unshift(job);
    await this.saveState(state);
    return job;
  }

  async getStatus(): Promise<DurableJobQueueStatus> {
    const state = await this.loadState();
    return {
      queueName: this.queueName,
      pendingCount: state.pending.length,
      deadLetterCount: state.deadLetters.length,
      processing: this.isProcessing,
      pollIntervalMs: this.pollIntervalMs,
      maxAttempts: this.maxAttempts,
      lastProcessedAtIso: this.lastProcessedAtIso,
      lastError: this.lastError,
    };
  }

  async listDeadLetters(limit = 100): Promise<DeadLetterJobRecord<TPayload>[]> {
    const state = await this.loadState();
    return state.deadLetters.slice(0, Math.max(1, limit));
  }

  private async tick(): Promise<void> {
    if (this.isProcessing || !this.handler) return;
    this.isProcessing = true;

    try {
      const state = await this.loadState();
      if (state.pending.length === 0) return;

      const nowUnixMs = Date.now();
      const due = state.pending
        .filter((job) => job.nextRunAtUnixMs <= nowUnixMs)
        .sort((a, b) => a.nextRunAtUnixMs - b.nextRunAtUnixMs);
      if (due.length === 0) return;

      const processIds = new Set(due.map((job) => job.id));
      const carry = state.pending.filter((job) => !processIds.has(job.id));

      for (const job of due) {
        try {
          await this.handler(job);
        } catch (error) {
          const failedAttempt = job.attempt + 1;
          const failedAtIso = new Date().toISOString();
          const message = String(error);

          if (failedAttempt >= this.maxAttempts) {
            state.deadLetters.unshift({
              ...job,
              attempt: failedAttempt,
              updatedAtIso: failedAtIso,
              lastError: message,
              failedAtIso,
            });
            state.deadLetters = state.deadLetters.slice(0, this.deadLetterLimit);
          } else {
            carry.push({
              ...job,
              attempt: failedAttempt,
              lastError: message,
              updatedAtIso: failedAtIso,
              nextRunAtUnixMs: nowUnixMs + this.retryDelayMs(failedAttempt),
            });
          }
        }
      }

      state.pending = carry.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      this.lastProcessedAtIso = new Date().toISOString();
      this.lastError = undefined;
      await this.saveState(state);
    } catch (error) {
      this.lastError = String(error);
      this.log(`queue ${this.queueName} tick failed: ${this.lastError}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private retryDelayMs(attempt: number): number {
    return Math.min(this.baseDelayMs * (2 ** Math.max(0, attempt - 1)), this.maxDelayMs);
  }

  private async loadState(): Promise<JobQueueState<TPayload>> {
    const state = await this.persistence.getState<JobQueueState<TPayload>>(this.stateKey);
    return state || { pending: [], deadLetters: [] };
  }

  private async saveState(state: JobQueueState<TPayload>): Promise<void> {
    await this.persistence.setState(this.stateKey, state);
  }

  private nextId(): string {
    return `job_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }
}

export class IdempotencyStore {
  private readonly ttlSeconds: number;
  private readonly persistence: UnifiedPersistence;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(options: IdempotencyStoreOptions) {
    this.ttlSeconds = options.ttlSeconds ?? 300;
    this.persistence = new UnifiedPersistence({
      namespace: `${options.namespace}:idempotency`,
      postgresUrl: options.postgresUrl,
      redisUrl: options.redisUrl,
      log: options.log,
    });
  }

  async execute<TResponse>(key: string, handler: () => Promise<TResponse> | TResponse): Promise<TResponse> {
    const normalizedKey = this.normalizeKey(key);
    const existing = await this.get<TResponse>(normalizedKey);
    if (existing) return existing.response;

    const current = this.inFlight.get(normalizedKey);
    if (current) return current as Promise<TResponse>;

    const run = (async () => {
      const response = await handler();
      const now = Date.now();
      const record: IdempotencyRecord<TResponse> = {
        key: normalizedKey,
        response,
        createdAtIso: new Date(now).toISOString(),
        expiresAtUnixMs: now + (this.ttlSeconds * 1000),
      };
      await this.persistence.setState(this.key(normalizedKey), record);
      return response;
    })();

    this.inFlight.set(normalizedKey, run);
    try {
      return await run;
    } finally {
      this.inFlight.delete(normalizedKey);
    }
  }

  async get<TResponse>(key: string): Promise<IdempotencyRecord<TResponse> | null> {
    const normalizedKey = this.normalizeKey(key);
    const record = await this.persistence.getState<IdempotencyRecord<TResponse>>(this.key(normalizedKey));
    if (!record) return null;
    if (record.expiresAtUnixMs <= Date.now()) return null;
    return record;
  }

  private key(raw: string): string {
    return `key:${raw}`;
  }

  private normalizeKey(raw: string): string {
    return raw.trim().toLowerCase();
  }
}
