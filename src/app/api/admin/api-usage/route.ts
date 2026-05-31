/**
 * GET /api/admin/api-usage
 *
 * Aggregate /api/v1/* request data from api_request_log. Returns:
 *
 *   summary      — total requests, unique users, error rate, p50/p95 latency
 *   topEndpoints — N most-called endpoints with count + error rate
 *   topUsers     — N busiest API users
 *   anonymous    — UNauthenticated traffic (no/invalid key → 401): total
 *                  request count, distinct sources (by salted IP hash),
 *                  and top endpoints. A developer-conversion + abuse signal.
 *
 * Authenticated metrics are scoped to user_id IS NOT NULL; anonymous rows
 * are tallied separately so they don't skew the authenticated error rate.
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
    return NextResponse.json({ summary: null, topEndpoints: [], topUsers: [], anonymous: null });
  }

  const { searchParams } = new URL(request.url);
  const win = parseWindow(searchParams.get('window'));
  const hours = win === '7d' ? 24 * 7 : win === '30d' ? 24 * 30 : 24;

  await initDB();
  const db = getSQL();

  try {
    // Authenticated metrics are scoped to user_id IS NOT NULL so the new
    // unauthenticated 401 rows (logged in v1-auth) don't pollute the error
    // rate or create a null-email bucket in topUsers. Anonymous traffic
    // gets its own block below.
    const [summary, topEndpoints, topUsers, anonSummary, anonEndpoints] = await Promise.all([
      db`
        SELECT
          COUNT(*)::int                                 AS total_requests,
          COUNT(DISTINCT user_id)::int                  AS unique_users,
          COUNT(*) FILTER (WHERE status_code >= 400)::int AS errors,
          percentile_disc(0.5)  WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
          percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_ms
        FROM api_request_log
        WHERE created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
          AND user_id IS NOT NULL
      `,
      db`
        SELECT endpoint,
               COUNT(*)::int AS hits,
               COUNT(*) FILTER (WHERE status_code >= 400)::int AS errors,
               percentile_disc(0.5)  WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms
        FROM api_request_log
        WHERE created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
          AND user_id IS NOT NULL
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
          AND l.user_id IS NOT NULL
        GROUP BY l.user_id, u.email, u.billing_tier
        ORDER BY hits DESC
        LIMIT 25
      `,
      // Unauthenticated traffic — requests that hit /api/v1 with no key or
      // a bad/revoked key (401). distinct_sources counts salted IP hashes.
      db`
        SELECT
          COUNT(*)::int                  AS total_requests,
          COUNT(DISTINCT ip_hash)::int   AS distinct_sources
        FROM api_request_log
        WHERE created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
          AND user_id IS NULL
      `,
      db`
        SELECT endpoint,
               COUNT(*)::int                AS hits,
               COUNT(DISTINCT ip_hash)::int AS sources
        FROM api_request_log
        WHERE created_at > NOW() - (${hours}::int * INTERVAL '1 hour')
          AND user_id IS NULL
        GROUP BY endpoint
        ORDER BY hits DESC
        LIMIT 15
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
      anonymous: {
        totalRequests: (anonSummary as any[])[0]?.total_requests ?? 0,
        distinctSources: (anonSummary as any[])[0]?.distinct_sources ?? 0,
        topEndpoints: (anonEndpoints as any[]).map(r => ({
          endpoint: r.endpoint,
          hits: r.hits,
          sources: r.sources,
        })),
      },
    });
  } catch (e) {
    console.warn('api-usage agg failed:', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
}
