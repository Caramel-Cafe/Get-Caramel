import { UserRole } from "@get-caramel/types";

export interface SessionRecord {
  sessionId: string;
  userId: string;
  role: UserRole;
  refreshTokenHash: string;
  expiresAtUnix: number;
}
