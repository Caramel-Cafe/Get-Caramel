type EnvMap = Record<string, string | undefined>;

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
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return;
  const payload = {
    event_id: `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 32),
    level: "error",
    platform: "javascript",
    message,
    environment: (((globalThis as { process?: { env?: EnvMap } }).process?.env) || {}).EXPO_PUBLIC_APP_ENV || "local",
    release: "local",
    timestamp: Math.floor(Date.now() / 1000),
    exception: {
      values: [
        {
          type: "Error",
          value: message,
          stacktrace: stack ? { frames: [{ filename: "mobile", function: "global", lineno: 0, colno: 0, vars: { stack } }] } : undefined,
        },
      ],
    },
  };
  await fetch(`${parsed.endpoint}?sentry_version=7&sentry_key=${parsed.publicKey}&sentry_client=get-caramel-mobile/1.0`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

let initialized = false;

export function initMobileSentry(): void {
  try {
    if (initialized) return;
    initialized = true;

    const env = ((globalThis as { process?: { env?: EnvMap } }).process?.env) || {};
    const dsn = env.EXPO_PUBLIC_SENTRY_DSN_MOBILE;
    if (!dsn) return;

    const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void; setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void } }).ErrorUtils;
    if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
      const original = errorUtils.getGlobalHandler();
      errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        void sendError(dsn, isFatal ? `FATAL ${message}` : message, stack);
        original(error, isFatal);
      });
    }

    const target = globalThis as unknown as { onunhandledrejection?: ((event: { reason?: unknown }) => void) | null };
    const prior = target.onunhandledrejection;
    target.onunhandledrejection = (event: { reason?: unknown }) => {
      const reasonValue = event?.reason;
      const reason = reasonValue instanceof Error ? `${reasonValue.name}: ${reasonValue.message}` : String(reasonValue);
      const stack = reasonValue instanceof Error ? reasonValue.stack : undefined;
      void sendError(dsn, reason, stack);
      prior?.(event);
    };
  } catch {
    // Never block app startup on observability setup.
  }
}
