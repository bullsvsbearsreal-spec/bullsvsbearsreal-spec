/**
 * GET /api/hl-traders/[address]
 *
 * Hyperliquid per-trader dossier: margin summary + open positions +
 * window-level PnL snapshots (from the leaderboard feed if available).
 *
 * Cache: 30s on margin/positions, piggyback on leaderboard's 5min cache
 * for window performance stats.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
const HL_LEADERBOARD_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';

interface HLAssetPosition {
  position: {
    coin: string;
    szi: string;                // signed size in base units (+ long / - short)
    entryPx: string | null;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    leverage: { type: 'cross' | 'isolated'; value: number };
    liquidationPx: string | null;
    marginUsed: string;
    maxLeverage: number;
    cumFunding: { allTime: string; sinceOpen: string; sinceChange: string };
  };
  type: string;
}

interface HLClearinghouseState {
  marginSummary: { accountValue: string; totalNtlPos: string; totalRawUsd: string; totalMarginUsed: string };
  crossMarginSummary: { accountValue: string; totalNtlPos: string; totalRawUsd: string; totalMarginUsed: string };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: HLAssetPosition[];
  time: number;
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 30_000;

// Lightweight shared copy of the leaderboard for window performance lookup.
// Separate from the leaderboard route's in-memory cache (different module)
// so we keep it isolated but still hold at most ~28MB/5min.
let leaderboardIndex: { byAddress: Map<string, any>; ts: number } | null = null;

async function getLeaderboardIndex(): Promise<Map<string, any>> {
  if (leaderboardIndex && Date.now() - leaderboardIndex.ts < 5 * 60 * 1000) {
    return leaderboardIndex.byAddress;
  }
  try {
    const res = await fetch(HL_LEADERBOARD_URL, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return new Map();
    const json = await res.json();
    const rows: any[] = json?.leaderboardRows || [];
    const byAddress = new Map<string, any>();
    for (const r of rows) byAddress.set(r.ethAddress.toLowerCase(), r);
    leaderboardIndex = { byAddress, ts: Date.now() };
    return byAddress;
  } catch {
    return leaderboardIndex?.byAddress ?? new Map();
  }
}

async function fetchClearinghouseState(address: string): Promise<HLClearinghouseState | null> {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[hl-traders/dossier] clearinghouseState fetch error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * HL's `portfolio` request returns an array of 8 windows, each with
 * { accountValueHistory, pnlHistory, vlm }. Windows we care about:
 * `day`, `week`, `month`, `allTime` (there are also `perpDay` etc. variants).
 * Each history entry is [timestampMs, stringifiedUsd].
 *
 * We pick the `month` window for the sparkline because it's the best
 * balance of granularity (~hourly points) and scope (30 days of context).
 * Returns both account value and cumulative PnL series.
 */
interface PortfolioSeries {
  accountValue: Array<{ t: number; v: number }>;
  pnl: Array<{ t: number; v: number }>;
  vlm: number;
  window: string;
}

async function fetchPortfolio(address: string): Promise<PortfolioSeries | null> {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ type: 'portfolio', user: address }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json)) return null;

    // Prefer month → week → day → allTime
    const pref = ['month', 'week', 'day', 'allTime'];
    let picked: any = null;
    for (const name of pref) {
      const hit = json.find((entry: any) => Array.isArray(entry) && entry[0] === name);
      if (hit && hit[1]?.pnlHistory?.length) {
        picked = { name, payload: hit[1] };
        break;
      }
    }
    if (!picked) return null;

    const { name, payload } = picked;
    const parseSeries = (rows: Array<[number, string]> | undefined) =>
      (rows || []).map(([t, v]) => ({ t: Number(t), v: parseFloat(v) || 0 }));

    return {
      accountValue: parseSeries(payload.accountValueHistory),
      pnl: parseSeries(payload.pnlHistory),
      vlm: parseFloat(payload.vlm || '0') || 0,
      window: name,
    };
  } catch (err) {
    console.warn('[hl-traders/dossier] portfolio fetch error:', err instanceof Error ? err.message : err);
    return null;
  }
}

function toNum(v: string | null | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(_request: NextRequest, { params }: { params: { address: string } }) {
  const raw = params.address || '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }
  const lower = raw.toLowerCase();
  const cacheKey = `hl-trader:${lower}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const [state, lbIndex, portfolio] = await Promise.all([
    fetchClearinghouseState(lower),
    getLeaderboardIndex(),
    fetchPortfolio(lower),
  ]);

  if (!state) {
    return NextResponse.json({ error: 'Trader state unavailable' }, { status: 502 });
  }

  const lbRow = lbIndex.get(lower);
  const perfByWindow: Record<string, { pnl: number; volume: number; roi: number }> = {};
  if (lbRow?.windowPerformances) {
    for (const [name, perf] of lbRow.windowPerformances) {
      perfByWindow[name] = {
        pnl: toNum(perf.pnl),
        volume: toNum(perf.vlm),
        roi: toNum(perf.roi) * 100,
      };
    }
  }

  const openPositions = (state.assetPositions || []).map(p => {
    const szi = toNum(p.position.szi);
    const entryPx = toNum(p.position.entryPx);
    const positionValue = toNum(p.position.positionValue);
    const unrealizedPnl = toNum(p.position.unrealizedPnl);
    const roe = toNum(p.position.returnOnEquity) * 100;
    return {
      coin: p.position.coin,
      isLong: szi > 0,
      size: Math.abs(szi),
      sizeUsd: positionValue,
      entryPrice: entryPx,
      liquidationPrice: toNum(p.position.liquidationPx),
      unrealizedPnl,
      roePct: roe,
      leverage: p.position.leverage?.value ?? null,
      leverageType: p.position.leverage?.type ?? null,
      marginUsed: toNum(p.position.marginUsed),
      maxLeverage: p.position.maxLeverage ?? null,
    };
  });

  const totalUnrealized = openPositions.reduce((s, p) => s + p.unrealizedPnl, 0);

  const body = {
    address: lower,
    displayName: lbRow?.displayName ?? null,
    summary: {
      accountValue: toNum(state.marginSummary.accountValue),
      totalNotional: toNum(state.marginSummary.totalNtlPos),
      marginUsed: toNum(state.marginSummary.totalMarginUsed),
      withdrawable: toNum(state.withdrawable),
      unrealizedPnl: totalUnrealized,
      performance: perfByWindow, // { day, week, month, allTime }
    },
    openPositions,
    history: portfolio && portfolio.pnl.length > 0 ? {
      window: portfolio.window,
      pnl: portfolio.pnl,                   // [{ t: ms, v: usd }]
      accountValue: portfolio.accountValue, // [{ t: ms, v: usd }]
      vlm: portfolio.vlm,
    } : null,
    meta: { source: 'hyperliquid-mainnet', timestamp: Date.now() },
  };

  cache.set(cacheKey, { body, ts: Date.now() });
  if (cache.size > 200) {
    const now = Date.now();
    Array.from(cache.entries()).forEach(([k, v]) => {
      if (now - v.ts > CACHE_TTL * 3) cache.delete(k);
    });
  }

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
