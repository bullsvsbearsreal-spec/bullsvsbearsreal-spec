/**
 * GET /api/bridge-flows
 *
 * Cross-chain bridge flow feed using Wormhole as the primary source.
 *
 * Query params:
 *   ?timeSpan=1d|7d|30d   default 7d
 *
 * Cache: 5 min in-process. Bridge flows move slowly, no point thrashing
 * Wormholescan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildBridgeFlowFeed } from '@/lib/bridge-flows';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

let l1: { ts: number; key: string; body: any } | null = null;
const L1_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const tsRaw = request.nextUrl.searchParams.get('timeSpan');
  const timeSpan: '1d' | '7d' | '30d' = tsRaw === '1d' || tsRaw === '30d' ? tsRaw : '7d';
  const cacheKey = timeSpan;

  if (l1 && l1.key === cacheKey && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  }

  const feed = await buildBridgeFlowFeed({ timeSpan });
  if (feed.scorecard || feed.chainPairs.length > 0) {
    l1 = { ts: feed.ts, key: cacheKey, body: feed };
  }

  return NextResponse.json(feed, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': feed.scorecard
        ? 'public, s-maxage=300, stale-while-revalidate=900'
        : 'no-store',
    },
  });
}
