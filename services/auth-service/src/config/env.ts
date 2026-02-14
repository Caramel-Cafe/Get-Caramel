export interface AuthEnv {
  port: number;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  passwordResetTtlSeconds: number;
  redisUrl?: string;
  adminInviteCode?: string;
}

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAuthEnv(): AuthEnv {
  return {
    port: asNumber(process.env.AUTH_SERVICE_PORT, 4001),
    jwtSecret: process.env.AUTH_JWT_SECRET || "change-me-in-production",
    accessTokenTtlSeconds: asNumber(process.env.AUTH_ACCESS_TTL_SEC, 900),
    refreshTokenTtlSeconds: asNumber(process.env.AUTH_REFRESH_TTL_SEC, 60 * 60 * 24 * 7),
    passwordResetTtlSeconds: asNumber(process.env.AUTH_PASSWORD_RESET_TTL_SEC, 60 * 15),
    redisUrl: process.env.REDIS_URL,
    adminInviteCode: process.env.AUTH_ADMIN_INVITE_CODE,
  };
}
