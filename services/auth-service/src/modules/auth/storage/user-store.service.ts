import { UserRole } from "@get-caramel/types";
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { UnifiedPersistence } from "@get-caramel/persistence";
import { getAuthEnv } from "../../../config/env";

type StoredUserRecord = {
  userId: string;
  identifier: string;
  role: UserRole;
  fullName: string;
  passwordSalt: string;
  passwordHash: string;
  createdAtIso: string;
};

type StoredUsersState = {
  byKey: Record<string, StoredUserRecord>;
  passwordResetsByHash?: Record<string, { userKey: string; expiresAtUnix: number; createdAtIso: string }>;
};

type RegisterUserInput = {
  identifier: string;
  password: string;
  role: UserRole;
  fullName: string;
};

@Injectable()
export class UserStoreService {
  private readonly logger = new Logger(UserStoreService.name);
  private readonly persistence: UnifiedPersistence;
  private readonly stateKey = "users:v1";
  private initPromise?: Promise<void>;

  constructor() {
    const env = getAuthEnv();
    this.persistence = new UnifiedPersistence({
      namespace: "auth-service-users",
      postgresUrl: process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL,
      redisUrl: env.redisUrl,
      log: (message: string) => this.logger.log(message),
    });
  }

  async register(input: RegisterUserInput): Promise<StoredUserRecord> {
    await this.ensureInitialized();
    const state = await this.readState();
    const key = this.userKey(input.identifier, input.role);

    if (state.byKey[key]) {
      throw new Error("user_exists");
    }

    const salt = randomUUID().replace(/-/g, "");
    const normalizedIdentifier = this.normalizeIdentifier(input.identifier);
    const userId = `usr_${input.role}_${normalizedIdentifier.slice(0, 12) || randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const record: StoredUserRecord = {
      userId,
      identifier: normalizedIdentifier,
      role: input.role,
      fullName: this.normalizeName(input.fullName),
      passwordSalt: salt,
      passwordHash: this.hashPassword(input.password, salt),
      createdAtIso: now,
    };

    state.byKey[key] = record;
    await this.persistence.setState(this.stateKey, state);
    return record;
  }

  async authenticate(identifier: string, password: string, role: UserRole): Promise<StoredUserRecord | null> {
    await this.ensureInitialized();
    const state = await this.readState();
    const key = this.userKey(identifier, role);
    const record = state.byKey[key];
    if (!record) return null;

    const nextHash = this.hashPassword(password, record.passwordSalt);
    const hashBuf = Buffer.from(record.passwordHash, "hex");
    const nextBuf = Buffer.from(nextHash, "hex");
    if (hashBuf.length !== nextBuf.length) return null;
    return timingSafeEqual(hashBuf, nextBuf) ? record : null;
  }

  async issuePasswordResetToken(identifier: string, role: UserRole, ttlSeconds: number): Promise<string | null> {
    await this.ensureInitialized();
    const state = await this.readState();
    const key = this.userKey(identifier, role);
    const record = state.byKey[key];
    this.cleanupExpiredResetTokens(state);
    if (!record) {
      await this.persistence.setState(this.stateKey, state);
      return null;
    }

    const rawToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const tokenHash = this.hashPassword(rawToken, "reset-token");
    const expiresAtUnix = Math.floor(Date.now() / 1000) + ttlSeconds;
    const bucket = state.passwordResetsByHash || {};
    bucket[tokenHash] = {
      userKey: key,
      expiresAtUnix,
      createdAtIso: new Date().toISOString(),
    };
    state.passwordResetsByHash = bucket;
    await this.persistence.setState(this.stateKey, state);
    return rawToken;
  }

  async consumePasswordResetToken(resetToken: string, newPassword: string): Promise<boolean> {
    await this.ensureInitialized();
    const state = await this.readState();
    this.cleanupExpiredResetTokens(state);
    const bucket = state.passwordResetsByHash || {};
    const tokenHash = this.hashPassword(resetToken, "reset-token");
    const reset = bucket[tokenHash];
    if (!reset) {
      await this.persistence.setState(this.stateKey, state);
      return false;
    }

    const user = state.byKey[reset.userKey];
    if (!user) {
      delete bucket[tokenHash];
      state.passwordResetsByHash = bucket;
      await this.persistence.setState(this.stateKey, state);
      return false;
    }

    const newSalt = randomUUID().replace(/-/g, "");
    user.passwordSalt = newSalt;
    user.passwordHash = this.hashPassword(newPassword, newSalt);
    delete bucket[tokenHash];
    state.passwordResetsByHash = bucket;
    await this.persistence.setState(this.stateKey, state);
    return true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    await this.persistence.init();
    const state = await this.readState();
    if (Object.keys(state.byKey).length > 0) return;

    const seeds: RegisterUserInput[] = [
      { identifier: "customer.demo@getcaramel.app", password: "dev-password", role: "customer", fullName: "Customer Demo" },
      { identifier: "customer@getcaramel.app", password: "password123", role: "customer", fullName: "Customer Demo" },
      { identifier: "vendor.demo@getcaramel.app", password: "dev-password", role: "vendor_owner", fullName: "Vendor Demo" },
      { identifier: "courier.demo@getcaramel.app", password: "dev-password", role: "courier", fullName: "Courier Demo" },
      { identifier: "admin.ops@getcaramel.app", password: "dev-password", role: "admin", fullName: "Admin Ops" },
    ];

    for (const seed of seeds) {
      const salt = randomUUID().replace(/-/g, "");
      const key = this.userKey(seed.identifier, seed.role);
      const normalizedIdentifier = this.normalizeIdentifier(seed.identifier);
      state.byKey[key] = {
        userId: `usr_${seed.role}_${normalizedIdentifier.slice(0, 12) || randomUUID().slice(0, 12)}`,
        identifier: normalizedIdentifier,
        role: seed.role,
        fullName: seed.fullName,
        passwordSalt: salt,
        passwordHash: this.hashPassword(seed.password, salt),
        createdAtIso: new Date().toISOString(),
      };
    }

    await this.persistence.setState(this.stateKey, state);
  }

  private async readState(): Promise<StoredUsersState> {
    const state = await this.persistence.getState<StoredUsersState>(this.stateKey);
    return state || { byKey: {}, passwordResetsByHash: {} };
  }

  private userKey(identifier: string, role: UserRole): string {
    return `${role}:${this.normalizeIdentifier(identifier)}`;
  }

  private normalizeIdentifier(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  private normalizeName(fullName: string): string {
    const cleaned = fullName.trim();
    if (!cleaned) return "Get Caramel User";
    return cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned;
  }

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString("hex");
  }

  private cleanupExpiredResetTokens(state: StoredUsersState): void {
    const now = Math.floor(Date.now() / 1000);
    const bucket = state.passwordResetsByHash || {};
    for (const [tokenHash, reset] of Object.entries(bucket)) {
      if (reset.expiresAtUnix <= now) {
        delete bucket[tokenHash];
      }
    }
    state.passwordResetsByHash = bucket;
  }
}
