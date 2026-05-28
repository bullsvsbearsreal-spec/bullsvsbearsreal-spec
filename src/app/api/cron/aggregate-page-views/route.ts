/**
 * Cron endpoint: prune old page_views + api_request_log rows.
 *
 * Runs daily (suggested 02:00 UTC). page_views keeps 90d; api_request_log
 * keeps 30d (higher volume — 1-in-5 sampled v1 traffic at ~20 rows/sec
 * caps the table around 50M rows max). The route returns a small
 * summary for the cron runner's logs.
 *
 * Both prunes share one cron timer so we don't need to add a new
 * systemd unit on the droplet (touched once, two tables prune together).
 *
 * Security: CRON_SECRET Bearer token (same as every other /api/cron/*).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, prunePageViews, pruneApiRequestLog, recordAuditEvent, upsertWorkerHeartbeat } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { verifyCronAuth } = await import('../_auth');
  const authErr = verifyCronAuth(request);
  if (authErr) return authErr;

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const startedAt = Date.now();
  // Wrap the prunes so a throw doesn't silently disappear the cron from
  // /admin-panel#ops. Previously: an unhandled throw from prunePageViews
  // or pruneApiRequestLog would bypass the heartbeat call below, so the
  // cron would look dead in the Ops board even though it was firing
  // daily on the droplet.
  try {
    const pruned = await prunePageViews(90);
    const prunedApiLog = await pruneApiRequestLog(30);
    const elapsedMs = Date.now() - startedAt;
    await recordAuditEvent('cron_aggregate_page_views', { pruned, prunedApiLog, elapsedMs }).catch(() => {});
    await upsertWorkerHeartbeat('cron:aggregate-page-views', 'ok', { pruned, prunedApiLog, elapsedMs }).catch(() => {});
    return NextResponse.json({ success: true, pruned, prunedApiLog, elapsedMs });
  } catch (e) {
    console.error('[cron:aggregate-page-views] error:', e);
    await upsertWorkerHeartbeat('cron:aggregate-page-views', 'degraded', {
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
      elapsedMs: Date.now() - startedAt,
    }).catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
