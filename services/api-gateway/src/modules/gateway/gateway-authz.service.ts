import { AuthAccessClaims, UserRole } from "@get-caramel/types";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";

type AuthContext = {
  userId?: string;
  role?: UserRole;
};

type Rule = {
  methods: string[];
  pattern: RegExp;
  public?: boolean;
  allowedRoles?: UserRole[];
};

@Injectable()
export class GatewayAuthzService {
  private readonly jwtSecret = process.env.AUTH_JWT_SECRET || "change-me-in-production";

  authorize(method: string, pathWithQuery: string, headers: Record<string, string | undefined>): AuthContext {
    const normalizedMethod = method.toUpperCase();
    const path = this.cleanPath(pathWithQuery);
    const rule = this.findRule(normalizedMethod, path);
    if (!rule) throw new ForbiddenException("Route is not allowed");

    if (rule.public) return {};

    const token = this.extractBearer(headers.authorization);
    const claims = this.verifyAccessToken(token);
    if (!rule.allowedRoles || rule.allowedRoles.length === 0) {
      return { userId: claims.sub, role: claims.role };
    }
    if (!rule.allowedRoles.includes(claims.role)) {
      throw new ForbiddenException("Role is not allowed for this route");
    }
    return { userId: claims.sub, role: claims.role };
  }

  private cleanPath(pathWithQuery: string): string {
    const path = pathWithQuery.split("?")[0];
    return path.replace(/^\/api\/?/, "");
  }

  private findRule(method: string, path: string): Rule | undefined {
    return this.rules().find((rule) =>
      (rule.methods.includes("*") || rule.methods.includes(method)) && rule.pattern.test(path));
  }

  private extractBearer(authorization?: string): string {
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    return authorization.slice("Bearer ".length).trim();
  }

  private verifyAccessToken(token: string): AuthAccessClaims {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthAccessClaims;
      if (decoded.typ !== "access") {
        throw new UnauthorizedException("Token type mismatch");
      }
      return decoded;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  private rules(): Rule[] {
    return [
      { methods: ["GET"], pattern: /^health$/, public: true },
      { methods: ["POST"], pattern: /^auth\/login$/, public: true },
      { methods: ["POST"], pattern: /^auth\/register$/, public: true },
      { methods: ["POST"], pattern: /^auth\/register-admin$/, public: true },
      { methods: ["POST"], pattern: /^auth\/request-password-reset$/, public: true },
      { methods: ["POST"], pattern: /^auth\/reset-password$/, public: true },
      { methods: ["POST"], pattern: /^auth\/refresh$/, public: true },
      { methods: ["POST"], pattern: /^auth\/logout$/, public: true },
      { methods: ["GET"], pattern: /^auth\/me$/, allowedRoles: ["customer", "vendor_owner", "courier", "admin"] },
      { methods: ["GET"], pattern: /^auth\/bootstrap-home$/, allowedRoles: ["customer", "admin"] },

      { methods: ["GET"], pattern: /^catalog\/vendors$/, allowedRoles: ["customer", "vendor_owner", "courier", "admin"] },
      { methods: ["GET"], pattern: /^catalog\/vendors\/search$/, allowedRoles: ["customer", "vendor_owner", "courier", "admin"] },
      { methods: ["GET"], pattern: /^catalog\/vendors\/nearby$/, allowedRoles: ["customer", "vendor_owner", "courier", "admin"] },
      { methods: ["GET"], pattern: /^catalog\/vendors\/[^/]+\/menu$/, allowedRoles: ["customer", "vendor_owner", "courier", "admin"] },
      { methods: ["POST"], pattern: /^catalog\/vendors$/, allowedRoles: ["vendor_owner", "admin"] },
      { methods: ["POST"], pattern: /^catalog\/vendors\/menu$/, allowedRoles: ["vendor_owner", "admin"] },

      { methods: ["GET"], pattern: /^orders\/discovery$/, allowedRoles: ["customer", "admin"] },
      { methods: ["*"], pattern: /^orders\/cart\/.+$/, allowedRoles: ["customer", "admin"] },
      { methods: ["POST"], pattern: /^orders\/cart\/items$/, allowedRoles: ["customer", "admin"] },
      { methods: ["POST"], pattern: /^orders\/checkout$/, allowedRoles: ["customer", "admin"] },
      { methods: ["*"], pattern: /^orders\/customer\/.+$/, allowedRoles: ["customer", "admin"] },
      { methods: ["*"], pattern: /^orders\/vendor\/.+$/, allowedRoles: ["vendor_owner", "admin"] },
      { methods: ["*"], pattern: /^orders\/dispatch\/.+$/, allowedRoles: ["courier", "admin"] },
      { methods: ["*"], pattern: /^orders\/rider\/.+$/, allowedRoles: ["courier", "admin"] },
      { methods: ["POST"], pattern: /^orders\/reviews$/, allowedRoles: ["customer", "admin"] },
      { methods: ["POST"], pattern: /^orders\/support\/tickets$/, allowedRoles: ["customer", "admin"] },
      { methods: ["*"], pattern: /^orders\/admin\/.+$/, allowedRoles: ["admin"] },

      { methods: ["GET"], pattern: /^notifications\/customer\/.+$/, allowedRoles: ["customer", "admin"] },
      { methods: ["GET"], pattern: /^notifications\/vendor\/.+$/, allowedRoles: ["vendor_owner", "admin"] },
      { methods: ["GET"], pattern: /^notifications\/rider\/.+$/, allowedRoles: ["courier", "admin"] },
      { methods: ["GET"], pattern: /^notifications\/admin$/, allowedRoles: ["admin"] },
      { methods: ["GET"], pattern: /^notifications\/push\/logs\/.+$/, allowedRoles: ["customer", "vendor_owner", "courier", "admin"] },
      { methods: ["GET"], pattern: /^notifications\/push\/queue\/.+$/, allowedRoles: ["admin"] },
      { methods: ["POST"], pattern: /^notifications\/push\/register$/, allowedRoles: ["customer", "vendor_owner", "courier", "admin"] },

      { methods: ["POST"], pattern: /^payments\/intents$/, allowedRoles: ["customer", "admin"] },
      { methods: ["POST"], pattern: /^payments\/confirm$/, allowedRoles: ["customer", "admin"] },
      { methods: ["POST"], pattern: /^payments\/webhook$/, public: true },
      { methods: ["GET"], pattern: /^payments\/order\/.+$/, allowedRoles: ["customer", "vendor_owner", "admin"] },
      { methods: ["GET"], pattern: /^payments\/customer\/.+$/, allowedRoles: ["customer", "admin"] },
      { methods: ["GET"], pattern: /^wallets\/.+$/, allowedRoles: ["customer", "admin"] },
      { methods: ["POST"], pattern: /^wallets\/topup$/, allowedRoles: ["customer", "admin"] },
      { methods: ["POST"], pattern: /^payouts\/run$/, allowedRoles: ["admin"] },
      { methods: ["GET"], pattern: /^payouts\/overview$/, allowedRoles: ["admin"] },
      { methods: ["GET"], pattern: /^payouts\/queue\/.+$/, allowedRoles: ["admin"] },
      { methods: ["GET"], pattern: /^payouts\/vendor\/.+$/, allowedRoles: ["vendor_owner", "admin"] },
      { methods: ["GET"], pattern: /^invoices\/vendor\/.+$/, allowedRoles: ["vendor_owner", "admin"] },
      { methods: ["GET"], pattern: /^invoices\/order\/.+$/, allowedRoles: ["customer", "vendor_owner", "admin"] },

      { methods: ["POST"], pattern: /^delivery\/couriers\/[^/]+\/location$/, allowedRoles: ["courier", "admin"] },
      { methods: ["GET"], pattern: /^delivery\/couriers\/[^/]+\/location$/, allowedRoles: ["courier", "admin"] },
      { methods: ["POST"], pattern: /^delivery\/couriers\/[^/]+\/load$/, allowedRoles: ["courier", "admin"] },
      { methods: ["POST"], pattern: /^delivery\/dispatch\/preview$/, allowedRoles: ["admin", "vendor_owner"] },
      { methods: ["GET"], pattern: /^delivery\/dispatch\/preview$/, allowedRoles: ["admin", "vendor_owner"] },
    ];
  }
}
