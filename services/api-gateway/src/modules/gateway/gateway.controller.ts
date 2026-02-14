import { All, Controller, Req, Res } from "@nestjs/common";
import { GatewayAuthzService } from "./gateway-authz.service";
import { GatewayProxyService } from "./gateway-proxy.service";
import { GatewayRateLimitService } from "./gateway-rate-limit.service";

@Controller()
export class GatewayController {
  constructor(
    private readonly proxy: GatewayProxyService,
    private readonly rateLimit: GatewayRateLimitService,
    private readonly authz: GatewayAuthzService,
  ) {}

  @All("api/*")
  async proxyApi(@Req() req: any, @Res() reply: any): Promise<void> {
    const pathWithQuery = req.url;
    const requestHeaders = this.readHeaders(req);
    const auth = this.authz.authorize(req.method, pathWithQuery, requestHeaders);
    if (auth.userId) requestHeaders["x-actor-id"] = auth.userId;
    if (auth.role) requestHeaders["x-actor-role"] = auth.role;

    const routeKey = this.proxy.routeKey(pathWithQuery);
    const clientKey = this.clientKey(req);
    const limit = await this.rateLimit.enforce(clientKey, routeKey);

    const forwarded = await this.proxy.forward({
      method: req.method,
      pathWithQuery,
      headers: requestHeaders,
      body: req.body,
    });

    reply
      .header("x-ratelimit-limit", String(limit.limit))
      .header("x-ratelimit-remaining", String(limit.remaining))
      .header("x-ratelimit-reset", String(limit.resetUnixMs))
      .header("content-type", forwarded.headers["content-type"])
      .status(forwarded.status)
      .send(forwarded.body);
  }

  private readHeaders(req: any): Record<string, string | undefined> {
    const headers: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers[key.toLowerCase()] = value[0];
      } else if (typeof value === "string") {
        headers[key.toLowerCase()] = value;
      }
    }
    return headers;
  }

  private clientKey(req: any): string {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) {
      return xff.split(",")[0].trim();
    }
    return req.ip || "unknown";
  }
}
