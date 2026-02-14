"use client";

import { useEffect } from "react";

function parseSentryDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    const publicKey = url.username;
    if (!projectId || !publicKey) return null;
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    return { endpoint, publicKey };
  } catch {
    return null;
  }
}

async function sendError(dsn: string, message: string, stack?: string): Promise<void> {
  try {
    const parsed = parseSentryDsn(dsn);
    if (!parsed) return;
    const eventId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 32);
    const payload = {
      event_id: eventId,
      level: "error",
      platform: "javascript",
      message,
      environment: process.env.NEXT_PUBLIC_APP_ENV || "local",
      release: process.env.NEXT_PUBLIC_RELEASE_SHA || "local",
      timestamp: Math.floor(Date.now() / 1000),
      exception: {
        values: [
          {
            type: "Error",
            value: message,
            stacktrace: stack ? { frames: [{ filename: "web", function: "global", lineno: 0, colno: 0, vars: { stack } }] } : undefined,
          },
        ],
      },
    };
    await fetch(`${parsed.endpoint}?sentry_version=7&sentry_key=${parsed.publicKey}&sentry_client=get-caramel-web/1.0`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Never break UI due observability transport failures.
  }
}

export function SentryClientBootstrap(): null {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;
    if (!dsn) return;
    const onError = (event: ErrorEvent) => {
      void sendError(dsn, event.message || "window.error", event.error?.stack || undefined);
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? `${event.reason.name}: ${event.reason.message}` : String(event.reason);
      const stack = event.reason instanceof Error ? event.reason.stack : undefined;
      void sendError(dsn, reason, stack);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  return null;
}
