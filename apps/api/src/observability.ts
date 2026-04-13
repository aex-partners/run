import * as Sentry from "@sentry/node";

let initialised = false;

/**
 * Initialise Sentry at process start. No-op when SENTRY_DSN is unset; that
 * way a missing secret in local dev doesn't break the boot, but any deployed
 * env that sets the DSN gets automatic exception capture + worker failure
 * alerts without needing to touch every call site.
 */
export function initObservability(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[observability] SENTRY_DSN unset, running without Sentry");
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? "development",
    release: process.env.RAILWAY_DEPLOYMENT_ID ?? undefined,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  });
  initialised = true;
  console.log("[observability] Sentry initialised");
}

export function captureError(
  err: unknown,
  context?: { kind?: string; jobId?: string; userId?: string; extra?: Record<string, unknown> },
): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context?.kind ?? "error"}]`, message, context?.extra ?? "");
  if (!initialised) return;
  Sentry.withScope((scope) => {
    if (context?.kind) scope.setTag("kind", context.kind);
    if (context?.jobId) scope.setTag("jobId", context.jobId);
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.extra) scope.setContext("extra", context.extra);
    Sentry.captureException(err);
  });
}

export function isSentryEnabled(): boolean {
  return initialised;
}
