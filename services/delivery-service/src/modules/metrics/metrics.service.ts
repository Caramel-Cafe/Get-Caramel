import { Injectable } from "@nestjs/common";

type RequestMetric = {
  method: string;
  route: string;
  status: number;
  durationMs: number;
  atUnixMs: number;
};

type RouteSnapshot = {
  key: string;
  requests: number;
  errors: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
};

@Injectable()
export class MetricsService {
  private readonly serviceName = process.env.SERVICE_NAME || "delivery-service";
  private readonly maxPoints = 20000;
  private readonly metrics: RequestMetric[] = [];

  record(metric: RequestMetric): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxPoints) {
      this.metrics.splice(0, this.metrics.length - this.maxPoints);
    }
  }

  snapshot(windowSeconds = 300): {
    service: string;
    windowSeconds: number;
    totalRequests: number;
    errorRequests: number;
    errorRate: number;
    p50Ms: number;
    p95Ms: number;
    routes: RouteSnapshot[];
    alerts: string[];
    generatedAtIso: string;
  } {
    const now = Date.now();
    const start = now - (windowSeconds * 1000);
    const windowed = this.metrics.filter((m) => m.atUnixMs >= start);
    const totalRequests = windowed.length;
    const errorRequests = windowed.filter((m) => m.status >= 500).length;
    const errorRate = totalRequests === 0 ? 0 : Number((errorRequests / totalRequests).toFixed(4));
    const durations = windowed.map((m) => m.durationMs);
    const p50Ms = this.percentile(durations, 50);
    const p95Ms = this.percentile(durations, 95);

    const byRoute = new Map<string, RequestMetric[]>();
    for (const point of windowed) {
      const key = `${point.method} ${point.route}`;
      const current = byRoute.get(key) || [];
      current.push(point);
      byRoute.set(key, current);
    }

    const routes: RouteSnapshot[] = Array.from(byRoute.entries())
      .map(([key, points]) => {
        const errors = points.filter((p) => p.status >= 500).length;
        return {
          key,
          requests: points.length,
          errors,
          errorRate: points.length === 0 ? 0 : Number((errors / points.length).toFixed(4)),
          p50Ms: this.percentile(points.map((p) => p.durationMs), 50),
          p95Ms: this.percentile(points.map((p) => p.durationMs), 95),
        };
      })
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20);

    const alerts: string[] = [];
    if (errorRate >= 0.05 && totalRequests >= 20) alerts.push("HIGH_ERROR_RATE");
    if (p95Ms >= 800 && totalRequests >= 20) alerts.push("HIGH_P95_LATENCY");

    return {
      service: this.serviceName,
      windowSeconds,
      totalRequests,
      errorRequests,
      errorRate,
      p50Ms,
      p95Ms,
      routes,
      alerts,
      generatedAtIso: new Date(now).toISOString(),
    };
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
  }
}
