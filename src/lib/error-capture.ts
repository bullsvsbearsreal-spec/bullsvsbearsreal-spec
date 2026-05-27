/**
 * Server-error capture for the admin "Server Errors" panel.
 *
 * Writes every 5xx + caught exception into admin_monitoring with the
 * metric prefix `server_error:`, then checks for a spike — if >=5
 * errors fire within the last 60s, pings @InfoHubRadarBot so the
 * operator gets a louder warning than scrolling through audit
 * entries.
 *
 * Usage — wrap a route handler with `withErrorCapture()`:
 *
 *   export const GET = withErrorCapture(async (req) => {
 *     // ... handler body, may throw ...
 *   }, '/api/admin/foo');
 *
 * The wrapper catches, records, and rethrows so Next.js still renders
 * its 500 page. recordServerError() can also be called directly when
 * a handler wants to log a logical error without throwing (e.g. a
 * downstream returned a bad shape).
 */

import { getSQL, isDBConfigured } from '@/lib/db';

const SPIKE_THRESHOLD = 5;       // errors
const SPIKE_WINDOW_MS = 60_000;  // 1 minute
const PING_COOLDOWN_MS = 5 * 60_000; // don't re-ping within 5 min of last fire

let lastPingAt = 0;

async function recentErrorCount(): Promise<number> {
  try {
    const db = getSQL();
    const [row] = await db`
      SELECT COUNT(*)::int AS n
        FROM admin_monitoring
       WHERE metric LIKE 'server_error:%'
         AND recorded_at > NOW() - INTERVAL '1 minute'
    `;
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

async function maybeFireSpikePing(errorCount: number) {
  if (errorCount < SPIKE_THRESHOLD) return;
  const now = Date.now();
  if (now - lastPingAt < PING_COOLDOWN_MS) return;
  lastPingAt = now;

  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.ADMIN_TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const text =
    `<b>🚨 Server-error spike</b>\n\n` +
    `<b>${errorCount}+</b> 5xx in the last minute on info-hub.io.\n\n` +
    `<a href="https://info-hub.io/admin-panel#ops">Open Ops tab →</a>`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn('[error-capture] spike ping failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * Write a single server-error event into admin_monitoring + maybe ping.
 * Fire-and-forget — never throws back at the caller.
 *
 * Metric prefix is `server_error:` so it lives in the same table as
 * audit events but doesn't get picked up by the audit-log filter
 * (which matches `audit_%`).
 */
export function recordServerError(route: string, err: unknown): void {
  if (!isDBConfigured()) return;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack ? err.stack.slice(0, 1000) : null;
  const safe = route.replace(/[^a-zA-Z0-9/_\-:]/g, '_').slice(0, 80);
  const metric = `server_error:${safe}`;
  const payload = JSON.stringify({
    route,
    message: message.slice(0, 500),
    stack,
    ts: new Date().toISOString(),
  });

  (async () => {
    try {
      const db = getSQL();
      await db`INSERT INTO admin_monitoring (metric, value, details) VALUES (${metric}, ${0}, ${payload})`;
      const n = await recentErrorCount();
      await maybeFireSpikePing(n);
    } catch (e) {
      console.warn('[error-capture] record failed:', e instanceof Error ? e.message : e);
    }
  })();
}

/**
 * Wrap a Next.js route handler with try/catch that records + rethrows.
 * Use on any /api/* route where we want to capture failures. The
 * specific routes wrapped today are admin/stats, admin/users,
 * admin/funnel, admin/revenue, admin/api-analytics, admin/alert-health
 * — high-signal admin reads. We don't wrap every public endpoint
 * because most already have their own try/catch and adding the spike
 * detector to a 1000 req/min route would just spam Telegram.
 */
export function withErrorCapture<Args extends any[], R>(
  handler: (...args: Args) => Promise<R>,
  route: string,
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      recordServerError(route, e);
      throw e;
    }
  };
}
