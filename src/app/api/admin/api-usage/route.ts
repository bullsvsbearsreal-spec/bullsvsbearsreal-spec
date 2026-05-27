/**
 * GET /api/admin/api-usage
 *
 * Aggregate /api/v1/* request data from api_request_log. Returns:
 *
 *   summary    — total requests, unique users, error rate, p50/p95 latency
 *   topEndpoints — N most-called endpoints with count + error rate
 *   topUsers     — N busiest API users
 *
 * Sampled 1-in-5 in v1-auth, so multiply by ~5 to estimate true volume.
 *
 * Window: ?window=24h|7d|30d (default 24h).
 *
 * Gated by requireAdmin — owner/admin can see this. Advisors don't have
 * a use case for raw per-user API usage so we keep it strict.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

type Window = '24h' | '7d' | '30d';
function parseWindow(s: string | null): Window {
  return s === '7d' || s === '30d' ? s : '24h';
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ summary: null, topEndpoints: [], topUsers: [] });
  }

  const { searchParams } = new URL(request.url);
  const win = parseWindow(searchParams.get('window'));
  const hours = win === '7d' ? 24 * 7 : win === '30d' ? 24 * 30 : 24;

  await initDB();
  const db = getSQL();

  try {
    const [summary, topEndpoints, topUsers] = await Promise.all([
      db`
        SELECT
          COUNT(*)::int                                 AS total_requests,
          COUNT(DISTINCT user_id)::int                  AS unique_users,
          COUNT(*) FILTER (WHERE status_code >= 400)::int AS errors,
          percentile_disc(0.5)  WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
          percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_ms
        FROM api_request_log
        WHERE created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
      `,
      db`
        SELECT endpoint,
               COUNT(*)::int AS hits,
               COUNT(*) FILTER (WHERE status_code >= 400)::int AS errors,
               percentile_disc(0.5)  WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms
        FROM api_request_log
        WHERE created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
        GROUP BY endpoint
        ORDER BY hits DESC
        LIMIT 25
      `,
      db`
        SELECT l.user_id,
               u.email,
               u.billing_tier,
               COUNT(*)::int AS hits,
               COUNT(*) FILTER (WHERE l.status_code >= 400)::int AS errors,
               MAX(l.created_at)::text AS last_hit
        FROM api_request_log l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
        GROUP BY l.user_id, u.email, u.billing_tier
        ORDER BY hits DESC
        LIMIT 25
      `,
    ]);

    return NextResponse.json({
      window: win,
      sampled: true,
      sampleRate: 0.2,
      summary: (summary as any[])[0] ?? null,
      topEndpoints: (topEndpoints as any[]).map(r => ({
        endpoint: r.endpoint,
        hits: r.hits,
        errors: r.errors,
        errorPct: r.hits > 0 ? Math.round((r.errors / r.hits) * 1000) / 10 : 0,
        p50Ms: r.p50_ms,
      })),
      topUsers: (topUsers as any[]).map(r => ({
        userId: r.user_id,
        email: r.email,
        billingTier: r.billing_tier,
        hits: r.hits,
        errors: r.errors,
        errorPct: r.hits > 0 ? Math.round((r.errors / r.hits) * 1000) / 10 : 0,
        lastHit: r.last_hit,
      })),
    });
  } catch (e) {
    console.warn('api-usage agg failed:', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
}
