import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) return;
  try {
    const Sentry = require("@sentry/node") as {
      init: (options: Record<string, unknown>) => void;
    };
    Sentry.init({
      dsn,
      environment: process.env.APP_ENV || process.env.NODE_ENV || "local",
      tracesSampleRate: 0.2,
      release: process.env.RELEASE_SHA || "local",
      serverName: "api-gateway",
    });
  } catch {
    // Sentry SDK is optional at runtime until dependency is installed.
  }
}

async function bootstrap(): Promise<void> {
  await initSentry();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableCors({ origin: true, credentials: true });
  await app.listen(Number(process.env.GATEWAY_PORT || 4000), "0.0.0.0");
}

bootstrap();
