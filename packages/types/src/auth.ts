export type UserRole = "customer" | "vendor_owner" | "courier" | "admin";

export interface AuthLoginRequest {
  identifier: string;
  password: string;
  role: UserRole;
}

export interface AuthRegisterRequest {
  identifier: string;
  password: string;
  role: UserRole;
  fullName: string;
}

export interface AuthRefreshRequest {
  refreshToken: string;
}

export interface AuthLogoutRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface AuthProfile {
  userId: string;
  fullName: string;
  role: UserRole;
}

export interface AuthLoginResponse {
  profile: AuthProfile;
  tokens: AuthTokens;
}

export interface AuthAccessClaims {
  sub: string;
  role: UserRole;
  sid: string;
  typ: "access";
}

export interface AuthRefreshClaims {
  sub: string;
  role: UserRole;
  sid: string;
  typ: "refresh";
}
