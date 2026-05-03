/**
 * GET /api/rekt-leaderboard
 *
 * Proxy to bounce.tech's public liquidation leaderboard. They track the
 * most-liquidated wallets on Hyperliquid (by notional + count + a combined
 * score). We mirror the feed, normalize the shape, and enrich with human
 * notional totals so the page can render without extra math.
 *
 * Upstream endpoint:
 *   GET https://api.bounce.tech/liquidations?limit=50
 *
 * Query params:
 *   limit  — 1..200 (default 50)
 *   page   — 1-indexed (default 1)
 *   sort   — 'notional' | 'count' | 'score' | 'rank' (default: notional)
 *
 * Cache: 5 min (underlying data refreshes slower than that).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const BOUNCE_URL = 'https://api.bounce.tech/liquidations';

interface BounceItem {
  address: string;
  totalLiquidationNotional: number;
  totalLiquidationCount: number;
  score: number;
  rank: number;
}

export interface RektRow {
  rank: number;
  address: string;
  totalNotional: number;
  count: number;
  score: number;
  avgLiquidation: number;  // totalNotional / count
}

interface RektResponse {
  data: RektRow[];
  summary: {
    totalRekt: number;        // aggregate notional across returned rows
    totalWallets: number;
    totalLiquidations: number;
    biggestLoser: string | null;
    biggestLoserNotional: number;
    biggestScore: number;
  };
  meta: {
    source: 'bounce.tech';
    timestamp: number;
    page: number;
    totalPages: number | null;
    returned: number;
  };
}

const cache = new Map<string, { body: RektResponse; ts: number }>();
const CACHE_TTL = 300_000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sortRaw = (searchParams.get('sort') || 'notional').toLowerCase();
  const sort = (['notional', 'count', 'score', 'rank'].includes(sortRaw) ? sortRaw : 'notional') as
    'notional' | 'count' | 'score' | 'rank';

  const cacheKey = `rekt:${limit}:${page}:${sort}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const url = `${BOUNCE_URL}?limit=${limit}&page=${page}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `bounce.tech ${res.status}`, data: [] }, { status: 502 });
    }
    const json = await res.json();
    if (json?.status && json.status !== 'success') {
      return NextResponse.json({ error: json.error || 'bounce.tech error', data: [] }, { status: 502 });
    }

    const raw: BounceItem[] = json?.data?.items ?? [];
    const totalPages: number | null = typeof json?.data?.totalPages === 'number' ? json.data.totalPages : null;

    let rows: RektRow[] = raw
      .filter(r => r && r.address && Number.isFinite(r.totalLiquidationNotional))
      .map(r => {
        const count = r.totalLiquidationCount || 0;
        const notional = r.totalLiquidationNotional || 0;
        return {
          rank: r.rank ?? 0,
          address: r.address.toLowerCase(),
          totalNotional: notional,
          count,
          score: r.score ?? 0,
          avgLiquidation: count > 0 ? notional / count : 0,
        };
      });

    if (sort === 'count')        rows.sort((a, b) => b.count - a.count);
    else if (sort === 'score')   rows.sort((a, b) => b.score - a.score);
    else if (sort === 'rank')    rows.sort((a, b) => a.rank - b.rank);
    else                         rows.sort((a, b) => b.totalNotional - a.totalNotional);

    const totalRekt = rows.reduce((s, r) => s + r.totalNotional, 0);
    const totalLiq = rows.reduce((s, r) => s + r.count, 0);
    const top = rows[0];

    const body: RektResponse = {
      data: rows,
      summary: {
        totalRekt,
        totalWallets: rows.length,
        totalLiquidations: totalLiq,
        biggestLoser: top?.address ?? null,
        biggestLoserNotional: top?.totalNotional ?? 0,
        biggestScore: rows.reduce((m, r) => Math.max(m, r.score), 0),
      },
      meta: {
        source: 'bounce.tech',
        timestamp: Date.now(),
        page,
        totalPages,
        returned: rows.length,
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[rekt-leaderboard] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
