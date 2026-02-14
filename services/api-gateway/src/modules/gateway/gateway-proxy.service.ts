import { Injectable, NotFoundException } from "@nestjs/common";

type Target = {
  upstreamBaseUrl: string;
  routeKey: string;
  upstreamPath: string;
};

type ForwardRequest = {
  method: string;
  pathWithQuery: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
};

type ForwardResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

@Injectable()
export class GatewayProxyService {
  private readonly authBase = process.env.AUTH_SERVICE_URL || "http://127.0.0.1:4001";
  private readonly catalogBase = process.env.CATALOG_SERVICE_URL || "http://127.0.0.1:4002";
  private readonly orderBase = process.env.ORDER_SERVICE_URL || "http://127.0.0.1:4003";
  private readonly paymentBase = process.env.PAYMENT_SERVICE_URL || "http://127.0.0.1:4004";
  private readonly deliveryBase = process.env.DELIVERY_SERVICE_URL || "http://127.0.0.1:4005";

  resolve(pathWithQuery: string): Target {
    const noQuery = pathWithQuery.split("?")[0];
    const withoutApiPrefix = noQuery.replace(/^\/api\/?/, "");
    const [firstSegment = ""] = withoutApiPrefix.split("/");

    const upstreamPath = noQuery.replace(/^\/api/, "");
    const routeKey = withoutApiPrefix;

    if (firstSegment === "auth") {
      return { upstreamBaseUrl: this.authBase, routeKey, upstreamPath };
    }
    if (firstSegment === "catalog") {
      return { upstreamBaseUrl: this.catalogBase, routeKey, upstreamPath };
    }
    if (firstSegment === "orders" || firstSegment === "notifications") {
      return { upstreamBaseUrl: this.orderBase, routeKey, upstreamPath };
    }
    if (firstSegment === "payments" || firstSegment === "payouts" || firstSegment === "invoices") {
      return { upstreamBaseUrl: this.paymentBase, routeKey, upstreamPath };
    }
    if (firstSegment === "delivery") {
      return { upstreamBaseUrl: this.deliveryBase, routeKey, upstreamPath };
    }

    throw new NotFoundException(`No upstream route for ${pathWithQuery}`);
  }

  async forward(input: ForwardRequest): Promise<ForwardResponse> {
    const target = this.resolve(input.pathWithQuery);
    const query = input.pathWithQuery.includes("?") ? `?${input.pathWithQuery.split("?")[1]}` : "";
    const upstreamUrl = `${target.upstreamBaseUrl}${target.upstreamPath}${query}`;

    const forwardedHeaders: Record<string, string> = {};
    const keep = [
      "authorization",
      "content-type",
      "x-idempotency-key",
      "x-request-id",
      "x-actor-id",
      "x-actor-role",
    ];
    for (const key of keep) {
      const value = input.headers[key];
      if (value) forwardedHeaders[key] = value;
    }

    const method = input.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    const response = await fetch(upstreamUrl, {
      method,
      headers: forwardedHeaders,
      body: hasBody && input.body !== undefined
        ? (typeof input.body === "string" ? input.body : JSON.stringify(input.body))
        : undefined,
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const raw = await response.text();
    const body = contentType.includes("application/json")
      ? this.parseJsonSafe(raw)
      : raw;

    return {
      status: response.status,
      headers: { "content-type": contentType },
      body,
    };
  }

  routeKey(pathWithQuery: string): string {
    return this.resolve(pathWithQuery).routeKey;
  }

  private parseJsonSafe(raw: string): unknown {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { raw };
    }
  }
}
