/**
 * GET /api/whale-liq
 *
 * Whale Liquidation Roulette feed: every open whale position on
 * Hyperliquid with liquidation price, sorted by closest-to-liq first.
 *
 * Query params:
 *   ?within=0.05   — only return positions where distance-to-liq < N (default 0.20)
 *   ?limit=100     — max rows (default 100)
 *
 * Cache: 60s in-process — feed is dramatic but doesn't need to be
 * sub-minute live. Rebuilds on miss from the warm /api/hl-whales cache
 * which itself caches 90s.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildWhaleLiqFeed } from '@/lib/whale-liq';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

let l1: { ts: number; feed: Awaited<ReturnType<typeof buildWhaleLiqFeed>> } | null = null;
const L1_TTL = 60 * 1000;

export async function GET(request: NextRequest) {
  const within = Math.min(Math.max(parseFloat(request.nextUrl.searchParams.get('within') ?? '0.20') || 0.20, 0.001), 1.0);
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10) || 100, 1), 500);

  if (!l1 || Date.now() - l1.ts > L1_TTL) {
    const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    const feed = await buildWhaleLiqFeed(origin);
    if (feed.rows.length > 0) l1 = { ts: feed.ts, feed };
  }

  if (!l1) {
    return NextResponse.json(
      { ts: Date.now(), rows: [], scanned: 0, positionsTotal: 0, withinFive: 0, withinTen: 0, note: 'Upstream temporarily empty' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const filtered = l1.feed.rows.filter(r => r.distancePct < within).slice(0, limit);
  return NextResponse.json({
    ts: l1.feed.ts,
    rows: filtered,
    scanned: l1.feed.scanned,
    positionsTotal: l1.feed.positionsTotal,
    withinFive: l1.feed.withinFive,
    withinTen: l1.feed.withinTen,
    meta: { within, limit },
  }, {
    headers: {
      'X-Cache': Date.now() - l1.ts < L1_TTL ? 'HIT' : 'MISS',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
    },
  });
}
