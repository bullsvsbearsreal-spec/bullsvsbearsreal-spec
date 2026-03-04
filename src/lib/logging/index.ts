/**
 * Structured logging utilities for InfoHub.
 * Enriches Sentry errors with exchange-specific context and provides
 * consistent logging across all API routes and exchange fetchers.
 */

let Sentry: typeof import('@sentry/nextjs') | null = null;

// Lazy-load Sentry to avoid import issues in test environments
async function getSentry() {
  if (!Sentry) {
    try {
      Sentry = await import('@sentry/nextjs');
    } catch {
      // Sentry not available (e.g., in tests)
    }
  }
  return Sentry;
}

/** Log an exchange-level error with Sentry context */
export async function logExchangeError(
  exchange: string,
  error: unknown,
  context?: { route?: string; endpoint?: string; status?: number },
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Exchange:${exchange}] ${message}`, context);

  const sentry = await getSentry();
  if (sentry) {
    sentry.withScope((scope) => {
      scope.setTag('exchange', exchange);
      scope.setTag('error_type', 'exchange_error');
      if (context?.route) scope.setTag('api_route', context.route);
      if (context?.endpoint) scope.setExtra('endpoint', context.endpoint);
      if (context?.status) scope.setExtra('response_status', context.status);
      scope.setLevel('warning');
      sentry.captureException(error instanceof Error ? error : new Error(message));
    });
  }
}

/** Log an API route error with Sentry context */
export async function logApiError(
  route: string,
  error: unknown,
  context?: { ip?: string; params?: Record<string, string> },
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[API:${route}] ${message}`);

  const sentry = await getSentry();
  if (sentry) {
    sentry.withScope((scope) => {
      scope.setTag('api_route', route);
      scope.setTag('error_type', 'api_error');
      if (context?.ip) scope.setExtra('client_ip', context.ip);
      if (context?.params) scope.setExtra('query_params', context.params);
      sentry.captureException(error instanceof Error ? error : new Error(message));
    });
  }
}

/** Log a validation error (typically from zod) */
export async function logValidationError(
  route: string,
  issues: unknown[],
  context?: { data?: unknown },
) {
  console.warn(`[Validation:${route}] ${issues.length} issues`, issues.slice(0, 3));

  const sentry = await getSentry();
  if (sentry) {
    sentry.withScope((scope) => {
      scope.setTag('api_route', route);
      scope.setTag('error_type', 'validation_error');
      scope.setExtra('issues', issues);
      if (context?.data) scope.setExtra('sample_data', context.data);
      scope.setLevel('warning');
      sentry.captureMessage(`Validation failed: ${route} (${issues.length} issues)`);
    });
  }
}
