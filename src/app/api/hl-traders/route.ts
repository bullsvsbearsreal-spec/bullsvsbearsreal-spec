/**
 * GET /api/hl-traders
 *
 * Hyperliquid perp traders leaderboard. Pulls the public stats feed at
 * https://stats-data.hyperliquid.xyz/Mainnet/leaderboard (~28MB, 34k+
 * traders), keeps a 5-minute in-memory copy, and serves ranked + paginated
 * slices based on query params.
 *
 * Query params:
 *   period  — day | week | month | allTime (default: allTime)
 *   sort    — pnl (default) | volume | roi
 *   limit   — 1..500 (default 100)
 *   min_vol — minimum volume in window to be eligible (default: 10_000 USD)
 *
 * Cache: 5 min TTL on the raw feed, 1 min per-query shape cache.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const HL_LEADERBOARD_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';

type Period = 'day' | 'week' | 'month' | 'allTime';
type Sort = 'pnl' | 'volume' | 'roi';

interface RawWindowPerf {
  pnl: string;
  roi: string;
  vlm: string;
}

interface RawLeaderRow {
  ethAddress: string;
  accountValue: string;
  windowPerformances: Array<[string, RawWindowPerf]>;
  prize: number;
  displayName: string | null;
}

export interface HLTrader {
  address: string;
  displayName: string | null;
  accountValue: number;       // USD
  pnl: number;                // USD (window)
  volume: number;             // USD (window)
  roi: number;                // 0..100 pct (window)
  prize: number;              // leaderboard prize amount
}

// Cache the full fetched payload — parsing 28MB on every request is wasteful.
let rawCache: { rows: RawLeaderRow[]; ts: number } | null = null;
const RAW_TTL = 5 * 60 * 1000;

// Per-query shape cache
const shapedCache = new Map<string, { body: any; ts: number }>();
const SHAPED_TTL = 60_000;

async function getRawLeaderboard(): Promise<RawLeaderRow[]> {
  if (rawCache && Date.now() - rawCache.ts < RAW_TTL) return rawCache.rows;
  const res = await fetch(HL_LEADERBOARD_URL, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'InfoHub/2.0 (info-hub.io)',
    },
  });
  if (!res.ok) throw new Error(`HL leaderboard returned ${res.status}`);
  const json = await res.json();
  const rows: RawLeaderRow[] = json?.leaderboardRows || [];
  rawCache = { rows, ts: Date.now() };
  return rows;
}

function extractWindow(row: RawLeaderRow, period: Period): RawWindowPerf | null {
  const hit = row.windowPerformances?.find(([name]) => name === period);
  return hit ? hit[1] : null;
}

function shape(row: RawLeaderRow, period: Period): HLTrader {
  const perf = extractWindow(row, period) ?? { pnl: '0', roi: '0', vlm: '0' };
  const pnl = parseFloat(perf.pnl) || 0;
  const volume = parseFloat(perf.vlm) || 0;
  // HL's roi is stored as a decimal fraction (0.4503 = 45.03%), so multiply by 100
  const roi = (parseFloat(perf.roi) || 0) * 100;
  return {
    address: row.ethAddress,
    displayName: row.displayName,
    accountValue: parseFloat(row.accountValue) || 0,
    pnl,
    volume,
    roi,
    prize: row.prize || 0,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const periodRaw = (searchParams.get('period') || 'allTime') as Period;
  const period = (['day', 'week', 'month', 'allTime'].includes(periodRaw) ? periodRaw : 'allTime') as Period;
  const sortRaw = (searchParams.get('sort') || 'pnl').toLowerCase();
  const sort = (['pnl', 'volume', 'roi'].includes(sortRaw) ? sortRaw : 'pnl') as Sort;
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));
  const minVol = Math.max(0, parseFloat(searchParams.get('min_vol') || '10000') || 10_000);

  const cacheKey = `hl-traders:${period}:${sort}:${limit}:${minVol}`;
  const cached = shapedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SHAPED_TTL) {
    // Match MISS-path Cache-Control so CF can edge-cache HITs too.
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  }

  try {
    const raw = await getRawLeaderboard();

    // Shape + filter — the 34k+ dataset includes many inactive accounts with
    // effectively $0 window volume. Filter by minVol to keep the leaderboard
    // meaningful.
    let traders = raw.map(r => shape(r, period)).filter(t => t.volume >= minVol);

    // Sort by chosen metric
    if (sort === 'volume') traders.sort((a, b) => b.volume - a.volume);
    else if (sort === 'roi') traders.sort((a, b) => b.roi - a.roi);
    else traders.sort((a, b) => b.pnl - a.pnl);

    // Population stats computed BEFORE slicing so "winners/losers" reflects
    // actual market breadth, not the sort order of the displayed top-N.
    const populationCount = traders.length;
    const populationWinners = traders.filter(t => t.pnl > 0).length;
    const populationLosers = traders.filter(t => t.pnl < 0).length;
    const populationTotalPnl = traders.reduce((s, t) => s + t.pnl, 0);
    const populationTotalVolume = traders.reduce((s, t) => s + t.volume, 0);

    traders = traders.slice(0, limit);

    const summary = {
      traderCount: populationCount,
      displayedCount: traders.length,
      totalPnl: populationTotalPnl,
      totalVolume: populationTotalVolume,
      winners: populationWinners,
      losers: populationLosers,
      eligibleCount: populationCount,
    };

    const body = {
      data: traders,
      summary,
      meta: {
        period,
        sort,
        limit,
        minVol,
        source: 'hyperliquid-mainnet',
        totalRaw: raw.length,
        timestamp: Date.now(),
      },
    };

    shapedCache.set(cacheKey, { body, ts: Date.now() });
    if (shapedCache.size > 50) {
      const now = Date.now();
      Array.from(shapedCache.entries()).forEach(([k, v]) => {
        if (now - v.ts > SHAPED_TTL * 3) shapedCache.delete(k);
      });
    }

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[hl-traders] fetch error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
