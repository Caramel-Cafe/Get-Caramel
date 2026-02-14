import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const route = String((req.routerPath || req.route?.path || req.url || "/")).split("?")[0];
        this.metrics.record({
          method: String(req.method || "UNKNOWN").toUpperCase(),
          route,
          status: Number(res?.statusCode || 500),
          durationMs: Date.now() - start,
          atUnixMs: Date.now(),
        });
      }),
    );
  }
}
