/**
 * Cron entry point for the auto-tweet runner. Wired to a systemd
 * timer on the droplet — see CLAUDE.md for cron setup.
 *
 * Schedule recommendation: every 5 minutes (catches fresh liq
 * cascades within a window; funding extremes / OI spikes only
 * change slowly so 5 min is plenty for those).
 *
 * Auth: standard Bearer CRON_SECRET like every other cron route.
 *
 * Dry-run by default — no tweets actually go out unless the four
 * TWITTER_* env vars are set. The DB still stores every composed
 * tweet so the admin panel can show "what would have been tweeted".
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '../_auth';
import { initDB, isDBConfigured, upsertWorkerHeartbeat } from '@/lib/db';
import { runAutoTweetTick } from '@/lib/auto-tweet/runner';

export const runtime = 'nodejs';
export const preferredRegion = 'fra1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  if (!isDBConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'database not configured' },
      { status: 503 },
    );
  }

  try {
    await initDB();
    const stats = await runAutoTweetTick();
    // Heartbeat so admin pipeline panel can show auto-tweet health.
    // Was: zero visibility — Twitter API auth expiry, rate-limits, or
    // schema drift on the funding/oi loaders would silently break tweets
    // for days while the cron returned HTTP 200 from the route monitor.
    await upsertWorkerHeartbeat(
      'cron:auto-tweet',
      stats.ok ? 'ok' : 'degraded',
      {
        detected: stats.detected,
        posted: stats.posted,
        dryRun: stats.dryRun,
        skipped: stats.skipped,
        errors: stats.errors.length,
        durationMs: stats.durationMs,
      },
    ).catch(e => console.error('[cron/auto-tweet] heartbeat error:', e));
    return NextResponse.json(stats);
  } catch (e) {
    console.error('[cron/auto-tweet] error:', e);
    await upsertWorkerHeartbeat('cron:auto-tweet', 'degraded', {
      error: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
    }).catch(() => { /* heartbeat best-effort */ });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
