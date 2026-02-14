import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuditActorRole,
  AuditOutcome,
  AuthAccessClaims,
  AuthLoginResponse,
  AuthProfile,
  AuthRefreshClaims,
  HomeBootstrapResponse,
  HomeVendorCard,
} from "@get-caramel/types";
import { createHash, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { getAuthEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterAdminDto } from "./dto/register-admin.dto";
import { RegisterDto } from "./dto/register.dto";
import { SessionRecord } from "./storage/session-record";
import { SessionStoreService } from "./storage/session-store.service";
import { UserStoreService } from "./storage/user-store.service";

@Injectable()
export class AuthService {
  private readonly env = getAuthEnv();

  constructor(
    private readonly sessions: SessionStoreService,
    private readonly auditService: AuditService,
    private readonly users: UserStoreService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthLoginResponse> {
    if (dto.role === "admin") {
      throw new ForbiddenException("Admin registration requires invite flow");
    }

    try {
      const created = await this.users.register({
        identifier: dto.identifier,
        password: dto.password,
        role: dto.role,
        fullName: dto.fullName,
      });

      const profile: AuthProfile = {
        userId: created.userId,
        fullName: created.fullName,
        role: created.role,
      };

      const sessionId = randomUUID();
      const response = await this.issueAndStoreTokens(profile, sessionId);
      this.audit(`customer:${profile.userId}`, "auth.register", "SUCCESS", "session", sessionId, { role: profile.role });
      return response;
    } catch (error) {
      if (String(error).includes("user_exists")) {
        throw new ConflictException("User already exists");
      }
      throw error;
    }
  }

  async registerAdmin(dto: RegisterAdminDto): Promise<AuthLoginResponse> {
    if (!this.env.adminInviteCode || dto.inviteCode !== this.env.adminInviteCode) {
      throw new UnauthorizedException("Invalid invite code");
    }

    try {
      const created = await this.users.register({
        identifier: dto.identifier,
        password: dto.password,
        role: "admin",
        fullName: dto.fullName,
      });

      const profile: AuthProfile = {
        userId: created.userId,
        fullName: created.fullName,
        role: created.role,
      };

      const sessionId = randomUUID();
      const response = await this.issueAndStoreTokens(profile, sessionId);
      this.audit(`admin:${profile.userId}`, "auth.register_admin", "SUCCESS", "session", sessionId, { role: profile.role });
      return response;
    } catch (error) {
      if (String(error).includes("user_exists")) {
        throw new ConflictException("User already exists");
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthLoginResponse> {
    const user = await this.users.authenticate(dto.identifier, dto.password, dto.role);
    if (!user) {
      this.audit("system", "auth.login", "FAILURE", "session", undefined, { reason: "invalid_credentials", role: dto.role });
      throw new UnauthorizedException("Invalid credentials");
    }

    const profile: AuthProfile = {
      userId: user.userId,
      fullName: user.fullName,
      role: user.role,
    };

    const sessionId = randomUUID();
    const response = await this.issueAndStoreTokens(profile, sessionId);
    this.audit(`customer:${profile.userId}`, "auth.login", "SUCCESS", "session", sessionId, { role: profile.role });
    return response;
  }

  async refresh(refreshToken: string): Promise<AuthLoginResponse> {
    const claims = this.verifyRefreshToken(refreshToken);
    const record = await this.sessions.get(claims.sid);

    if (!record) {
      this.audit("system", "auth.refresh", "FAILURE", "session", claims.sid, { reason: "session_not_found" });
      throw new UnauthorizedException("Session expired or not found");
    }

    this.assertSessionMatchesToken(record, refreshToken);

    const profile: AuthProfile = {
      userId: record.userId,
      fullName: this.resolveName(record.userId),
      role: record.role,
    };

    const response = await this.issueAndStoreTokens(profile, claims.sid);
    this.audit(`customer:${profile.userId}`, "auth.refresh", "SUCCESS", "session", claims.sid, { role: profile.role });
    return response;
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const claims = this.verifyRefreshToken(refreshToken);
    await this.sessions.delete(claims.sid);
    this.audit(`customer:${claims.sub}`, "auth.logout", "SUCCESS", "session", claims.sid);
    return { success: true };
  }

  async requestPasswordReset(input: { identifier: string; role: "customer" | "vendor_owner" | "courier" | "admin" }): Promise<{ success: true; resetToken?: string }> {
    const resetToken = await this.users.issuePasswordResetToken(
      input.identifier,
      input.role,
      this.env.passwordResetTtlSeconds,
    );

    this.audit("system", "auth.password_reset.request", "SUCCESS", "user", undefined, {
      role: input.role,
      found: Boolean(resetToken),
    });

    const exposeToken = (process.env.APP_ENV || process.env.NODE_ENV || "local") !== "production";
    return {
      success: true,
      ...(resetToken && exposeToken ? { resetToken } : {}),
    };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ success: true }> {
    const changed = await this.users.consumePasswordResetToken(resetToken, newPassword);
    if (!changed) {
      this.audit("system", "auth.password_reset.confirm", "FAILURE", "user", undefined, { reason: "invalid_token" });
      throw new UnauthorizedException("Invalid or expired reset token");
    }

    this.audit("system", "auth.password_reset.confirm", "SUCCESS", "user");
    return { success: true };
  }

  getProfileFromAccessToken(accessToken: string): AuthProfile {
    const claims = this.verifyAccessToken(accessToken);
    return {
      userId: claims.sub,
      fullName: this.resolveName(claims.sub),
      role: claims.role,
    };
  }

  getHomeBootstrapForUser(_userId: string): HomeBootstrapResponse {
    const vendors: HomeVendorCard[] = [
      { id: "vnd_001", name: "Saffron Street Kitchen", cuisine: "Indian", etaMinutes: 18, deliveryFeeCents: 199, rating: 4.8, heroColor: "#F97316" },
      { id: "vnd_002", name: "Roma Fire Pizza", cuisine: "Italian", etaMinutes: 22, deliveryFeeCents: 149, rating: 4.6, heroColor: "#EF4444" },
      { id: "vnd_003", name: "Tokyo Rice & Roll", cuisine: "Japanese", etaMinutes: 16, deliveryFeeCents: 249, rating: 4.7, heroColor: "#2563EB" },
    ];

    return { generatedAtIso: new Date().toISOString(), vendors };
  }

  private async issueAndStoreTokens(profile: AuthProfile, sessionId: string): Promise<AuthLoginResponse> {
    const accessToken = jwt.sign(
      { sub: profile.userId, role: profile.role, sid: sessionId, typ: "access" } satisfies AuthAccessClaims,
      this.env.jwtSecret,
      { expiresIn: this.env.accessTokenTtlSeconds },
    );

    const refreshToken = jwt.sign(
      { sub: profile.userId, role: profile.role, sid: sessionId, typ: "refresh" } satisfies AuthRefreshClaims,
      this.env.jwtSecret,
      { expiresIn: this.env.refreshTokenTtlSeconds },
    );

    const expiresAtUnix = Math.floor(Date.now() / 1000) + this.env.refreshTokenTtlSeconds;
    await this.sessions.set(
      {
        sessionId,
        userId: profile.userId,
        role: profile.role,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAtUnix,
      },
      this.env.refreshTokenTtlSeconds,
    );

    return {
      profile,
      tokens: {
        accessToken,
        refreshToken,
        expiresInSeconds: this.env.accessTokenTtlSeconds,
      },
    };
  }

  private verifyAccessToken(token: string): AuthAccessClaims {
    try {
      const decoded = jwt.verify(token, this.env.jwtSecret) as AuthAccessClaims;
      if (decoded.typ !== "access") throw new BadRequestException("Token type mismatch");
      return decoded;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  private verifyRefreshToken(token: string): AuthRefreshClaims {
    try {
      const decoded = jwt.verify(token, this.env.jwtSecret) as AuthRefreshClaims;
      if (decoded.typ !== "refresh") throw new BadRequestException("Token type mismatch");
      return decoded;
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private assertSessionMatchesToken(record: SessionRecord, refreshToken: string): void {
    if (this.hashToken(refreshToken) !== record.refreshTokenHash) {
      throw new UnauthorizedException("Refresh token has been rotated");
    }
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private resolveName(identifier: string): string {
    const cleaned = identifier.trim();
    if (cleaned.length === 0) return "Get Caramel User";
    return cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned;
  }

  private audit(
    actorKey: string,
    action: string,
    outcome: AuditOutcome,
    resourceType: string,
    resourceId?: string,
    metadata?: Record<string, string | number | boolean>,
  ): void {
    const actorRole: AuditActorRole =
      actorKey.startsWith("customer:") ? "customer" :
      actorKey.startsWith("vendor:") ? "vendor" :
      actorKey.startsWith("rider:") ? "rider" :
      actorKey.startsWith("admin:") ? "admin" : "system";

    this.auditService.record({
      actorKey,
      actorRole,
      action,
      resourceType,
      resourceId,
      outcome,
      metadata,
    });
  }
}
