import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HLPosition {
  coin: string;
  szi: string;          // size (negative = short)
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  leverage: { type: string; value: number };
  marginUsed: string;
  maxLeverage: number;
  cumFunding: {
    allTime: string;
    sinceOpen: string;
    sinceChange: string;
  };
}

interface HLClearingHouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  assetPositions: Array<{
    type: string;
    position: HLPosition;
  }>;
  time: number;
}

interface LeaderboardRow {
  ethAddress: string;
  accountValue: string;
  displayName: string | null;
  windowPerformances: Array<[
    string, // period: "day" | "week" | "month" | "allTime"
    { pnl: string; roi: string; vlm: string }
  ]>;
}

interface LeaderboardResponse {
  leaderboardRows: LeaderboardRow[];
}

export interface WhaleData {
  address: string;
  label: string;
  accountValue: number;
  totalNotional: number;
  marginUsed: number;
  withdrawable: number;
  positionCount: number;
  positions: Array<{
    coin: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    positionValue: number;
    unrealizedPnl: number;
    roe: number;
    leverage: number;
    liquidationPrice: number | null;
    marginUsed: number;
    cumulativeFunding: number;
  }>;
  lastUpdated: number;
  // Leaderboard performance data
  allTimePnl?: number;
  allTimeRoi?: number;
  dayPnl?: number;
  weekPnl?: number;
  monthPnl?: number;
  volume?: number;
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

const MEM_CACHE_TTL = 90_000;          // 1.5 minutes
const DB_CACHE_TTL = 180;              // 3 minutes
const LEADERBOARD_CACHE_TTL = 300_000; // 5 minutes
const CACHE_KEY = 'hl-whales:v2';

let memCache: { data: WhaleData[]; time: number } | null = null;
let leaderboardCache: { data: LeaderboardRow[]; time: number } | null = null;

/* ------------------------------------------------------------------ */
/*  Fetch leaderboard (top traders by account value)                   */
/* ------------------------------------------------------------------ */

async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  // Return cached leaderboard if fresh
  if (leaderboardCache && Date.now() - leaderboardCache.time < LEADERBOARD_CACHE_TTL) {
    return leaderboardCache.data;
  }

  try {
    const res = await fetch('https://stats-data.hyperliquid.xyz/Mainnet/leaderboard', {
      signal: AbortSignal.timeout(10_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      // Return stale cache on error
      if (leaderboardCache) return leaderboardCache.data;
      throw new Error(`Leaderboard API returned ${res.status}`);
    }

    const data = (await res.json()) as LeaderboardResponse;
    const rows = data.leaderboardRows || [];

    // Cache the leaderboard
    leaderboardCache = { data: rows, time: Date.now() };
    return rows;
  } catch {
    // Return stale cache on error
    if (leaderboardCache) return leaderboardCache.data;
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Extract performance data from leaderboard row                      */
/* ------------------------------------------------------------------ */

function extractPerformance(row: LeaderboardRow) {
  const perf: Record<string, { pnl: number; roi: number; vlm: number }> = {};
  for (const [period, data] of row.windowPerformances) {
    perf[period] = {
      pnl: parseFloat(data.pnl) || 0,
      roi: parseFloat(data.roi) || 0,
      vlm: parseFloat(data.vlm) || 0,
    };
  }
  return perf;
}

/* ------------------------------------------------------------------ */
/*  Fetch single whale's positions                                     */
/* ------------------------------------------------------------------ */

async function fetchWhaleState(
  address: string,
  label: string,
  leaderboardPerf?: Record<string, { pnl: number; roi: number; vlm: number }>,
): Promise<WhaleData | null> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as HLClearingHouseState;

    const accountValue = parseFloat(data.marginSummary.accountValue) || 0;
    const totalNotional = parseFloat(data.marginSummary.totalNtlPos) || 0;
    const marginUsed = parseFloat(data.marginSummary.totalMarginUsed) || 0;
    const withdrawable = parseFloat(data.withdrawable) || 0;

    // Skip wallets with zero or near-zero value
    if (accountValue < 1000) return null;

    const positions = (data.assetPositions || [])
      .map((ap) => {
        const p = ap.position;
        const size = parseFloat(p.szi) || 0;
        return {
          coin: p.coin,
          side: (size >= 0 ? 'long' : 'short') as 'long' | 'short',
          size: Math.abs(size),
          entryPrice: parseFloat(p.entryPx) || 0,
          positionValue: Math.abs(parseFloat(p.positionValue) || 0),
          unrealizedPnl: parseFloat(p.unrealizedPnl) || 0,
          roe: parseFloat(p.returnOnEquity) || 0,
          leverage: p.leverage?.value || 1,
          liquidationPrice: p.liquidationPx ? parseFloat(p.liquidationPx) : null,
          marginUsed: parseFloat(p.marginUsed) || 0,
          cumulativeFunding: parseFloat(p.cumFunding?.allTime) || 0,
        };
      })
      .filter((p) => p.positionValue > 100)   // Filter dust
      .sort((a, b) => b.positionValue - a.positionValue);

    return {
      address,
      label,
      accountValue,
      totalNotional,
      marginUsed,
      withdrawable,
      positionCount: positions.length,
      positions,
      lastUpdated: data.time || Date.now(),
      // Leaderboard performance data (if available)
      allTimePnl: leaderboardPerf?.allTime?.pnl,
      allTimeRoi: leaderboardPerf?.allTime?.roi,
      dayPnl: leaderboardPerf?.day?.pnl,
      weekPnl: leaderboardPerf?.week?.pnl,
      monthPnl: leaderboardPerf?.month?.pnl,
      volume: leaderboardPerf?.allTime?.vlm,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Fetch all whales (dynamic from leaderboard)                        */
/* ------------------------------------------------------------------ */

async function fetchAllWhales(): Promise<WhaleData[]> {
  // Step 1: Get top traders from the leaderboard
  const leaderboardRows = await fetchLeaderboard();

  if (leaderboardRows.length === 0) {
    return [];
  }

  // Step 2: Pick the top 30 by account value (leaderboard is pre-sorted)
  // Filter out very small accounts and known vault addresses
  const HLP_VAULT = '0xdfc24b077bc1425ad1dea75bcb6f8158e10df303';
  const candidates = leaderboardRows
    .filter((r) => {
      const av = parseFloat(r.accountValue) || 0;
      return av >= 100_000 && r.ethAddress.toLowerCase() !== HLP_VAULT.toLowerCase();
    })
    .slice(0, 30);

  // Step 3: Fetch positions for each in batches of 5
  const batchSize = 5;
  const results: WhaleData[] = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((row) => {
        const label = row.displayName || `Whale ${row.ethAddress.slice(0, 6)}`;
        const perf = extractPerformance(row);
        return fetchWhaleState(row.ethAddress, label, perf);
      }),
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
    // Small delay between batches to respect rate limits
    if (i + batchSize < candidates.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Sort by account value descending
  return results.sort((a, b) => b.accountValue - a.accountValue);
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const singleAddress = searchParams.get('address');

  // Single wallet lookup (for custom whale tracking)
  if (singleAddress) {
    const label = searchParams.get('label') || 'Custom';
    const whale = await fetchWhaleState(singleAddress, label);
    if (!whale) {
      return NextResponse.json(
        { error: 'Could not fetch wallet data or wallet has no positions' },
        { status: 404 },
      );
    }
    return NextResponse.json(whale, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  // All whales — check caches
  if (memCache && Date.now() - memCache.time < MEM_CACHE_TTL) {
    return NextResponse.json(memCache.data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  if (isDBConfigured()) {
    try {
      const dbData = await getCache<WhaleData[]>(CACHE_KEY);
      if (dbData) {
        memCache = { data: dbData, time: Date.now() };
        return NextResponse.json(dbData, {
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
      }
    } catch { /* miss */ }
  }

  try {
    const whales = await fetchAllWhales();

    // Cache results
    memCache = { data: whales, time: Date.now() };
    if (isDBConfigured()) {
      setCache(CACHE_KEY, whales, DB_CACHE_TTL).catch(() => {});
    }

    return NextResponse.json(whales, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    // Return stale cache on error
    if (memCache) {
      return NextResponse.json(memCache.data, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch whale data';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
