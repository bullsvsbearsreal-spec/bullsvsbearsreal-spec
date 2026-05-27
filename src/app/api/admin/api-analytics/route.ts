/**
 * GET /api/admin/api-analytics
 *
 * Public API consumption + rate-limit data. Sources:
 *   - api_keys             — issued keys (tier, requests_today, last_used_at)
 *   - rate_limit_events    — every 429 we've handed out (last 24h kept)
 *
 * Surfaces:
 *   · Total active keys (by tier)
 *   · Total requests today (sum across all keys)
 *   · Top API consumers (top 10 keys by requests_today)
 *   · Rate-limit hits 24h (count) + breakdown by limiter
 *   · Last-used freshness (oldest active key)
 */
import { NextResponse } from 'next/server';
import { requireAdminOrAdvisor } from '@/lib/auth';
import { initDB, isDBConfigured, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdminOrAdvisor();
  if (denied) return denied;
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const db = getSQL();

    const [keysByTier, totals, topConsumers, rateLimitHits, rateLimitByLimiter, neverUsed] = await Promise.all([
      db`SELECT tier, COUNT(*)::int AS count
           FROM api_keys
           WHERE revoked_at IS NULL
           GROUP BY tier`.catch(() => []),
      db`SELECT
           COUNT(*)::int AS total_keys,
           COALESCE(SUM(requests_today), 0)::bigint AS requests_today,
           COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '7 days')::int AS active_7d,
           COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '24 hours')::int AS active_24h
         FROM api_keys WHERE revoked_at IS NULL`.catch(() => [{}]),
      db`SELECT k.id, k.name, k.tier, k.requests_today, k.last_used_at, u.email
         FROM api_keys k
         LEFT JOIN users u ON u.id = k.user_id
         WHERE k.revoked_at IS NULL AND k.requests_today > 0
         ORDER BY k.requests_today DESC
         LIMIT 10`.catch(() => []),
      db`SELECT COUNT(*)::int AS count
         FROM rate_limit_events
         WHERE created_at > NOW() - INTERVAL '24 hours'`.catch(() => [{ count: 0 }]),
      db`SELECT limiter, COUNT(*)::int AS count
         FROM rate_limit_events
         WHERE created_at > NOW() - INTERVAL '24 hours'
         GROUP BY limiter
         ORDER BY count DESC
         LIMIT 10`.catch(() => []),
      db`SELECT COUNT(*)::int AS count
         FROM api_keys
         WHERE revoked_at IS NULL AND last_used_at IS NULL`.catch(() => [{ count: 0 }]),
    ]);

    const tierMap: Record<string, number> = { free: 0, trader: 0, pro: 0, whale: 0 };
    for (const r of keysByTier as any[]) tierMap[r.tier] = Number(r.count);

    const t = (totals as any[])[0] ?? {};

    return NextResponse.json({
      totals: {
        totalKeys:        Number(t.total_keys ?? 0),
        requestsToday:    Number(t.requests_today ?? 0),
        activeKeys24h:    Number(t.active_24h ?? 0),
        activeKeys7d:     Number(t.active_7d ?? 0),
        neverUsedKeys:    Number((neverUsed as any[])[0]?.count ?? 0),
      },
      keysByTier: [
        { tier: 'free',   count: tierMap.free   },
        { tier: 'trader', count: tierMap.trader },
        { tier: 'pro',    count: tierMap.pro    },
        { tier: 'whale',  count: tierMap.whale  },
      ],
      topConsumers: (topConsumers as any[]).map(r => ({
        id: String(r.id),
        name: r.name ?? '(unnamed key)',
        tier: r.tier ?? 'free',
        requestsToday: Number(r.requests_today ?? 0),
        lastUsedAt: r.last_used_at instanceof Date ? r.last_used_at.toISOString() : null,
        email: r.email ?? null,
      })),
      rateLimits: {
        hits24h: Number((rateLimitHits as any[])[0]?.count ?? 0),
        byLimiter: (rateLimitByLimiter as any[]).map(r => ({
          limiter: String(r.limiter),
          count: Number(r.count),
        })),
      },
    });
  } catch (e) {
    console.error('API analytics route error:', e);
    return NextResponse.json({ error: 'Failed to compute API analytics' }, { status: 500 });
  }
}
