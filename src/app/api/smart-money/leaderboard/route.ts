/**
 * GET /api/smart-money/leaderboard
 *
 * Top Hyperliquid wallets ranked by REALIZED PnL over the last N days
 * (default 90). Different from the parent /api/smart-money endpoint
 * which computes directional bias — this one ranks individual traders
 * by closing-trade performance.
 *
 * Pulls the HL leaderboard, then summarises each top wallet's recent
 * fills via userFillsByTime to compute closing-trade stats: realised
 * PnL, win rate, biggest single trade, top symbols.
 *
 * Heavy on the first cold-cache hit (top 50 × parallel fills at
 * concurrency 10 ≈ 5-15s) but cached 30 min so subsequent requests
 * are instant.
 *
 * Query params:
 *   ?topN=50          5..200, default 50
 *   ?lookbackDays=90  1..180, default 90
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildSmartMoneyFeed } from '@/lib/smart-money';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let l1: { ts: number; key: string; body: any } | null = null;
const L1_TTL = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const topN = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('topN') ?? '50', 10) || 50, 5), 200);
  const lookbackDays = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('lookbackDays') ?? '90', 10) || 90, 1), 180);
  const cacheKey = `${topN}:${lookbackDays}`;

  if (l1 && l1.key === cacheKey && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  const feed = await buildSmartMoneyFeed({ topN, lookbackDays });
  if (feed.entries.length > 0) l1 = { ts: feed.ts, key: cacheKey, body: feed };

  return NextResponse.json(feed, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': feed.entries.length > 0
        ? 'public, s-maxage=900, stale-while-revalidate=3600'
        : 'no-store',
    },
  });
}
