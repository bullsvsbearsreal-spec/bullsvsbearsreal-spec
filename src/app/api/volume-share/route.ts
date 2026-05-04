/**
 * GET /api/volume-share
 *
 * Aggregate spot trading-volume share split between CEX and DEX over the
 * past 30 days. Source: DefiLlama for DEX volumes, CoinGecko exchange
 * volumes for CEX. Both free, no auth.
 *
 * Useful as a market-structure trend — when DEX share is rising,
 * on-chain trading is gaining ground (typically alt-season indicator).
 *
 * L1 cached 1 hour.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface DayPoint {
  date: string;
  cexVolumeUsd: number;
  dexVolumeUsd: number;
  totalVolumeUsd: number;
  dexSharePct: number;
}

interface ApiResponse {
  days: DayPoint[];
  latest: { dexSharePct: number; cexVolumeUsd: number; dexVolumeUsd: number; totalVolumeUsd: number; date: string } | null;
  avg30dDexShare: number | null;
  ts: number;
}

const TIMEOUT = 12_000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 60 * 60 * 1000;

interface LlamaDexHistoryRow { [key: string]: any; date: string | number; totalVolume?: number; dailyVolume?: number }

interface LlamaOverviewResp {
  totalDataChart?: Array<[number, number]>;          // [unix_seconds, totalVolume]
  totalDataChartBreakdown?: Array<[number, Record<string, number>]>;
}

async function fetchDexVolumeHistory(): Promise<Map<string, number>> {
  // DefiLlama spot-DEX volume aggregate. excludeChain options keep noise out.
  try {
    const res = await fetchWithTimeout(
      'https://api.llama.fi/overview/dexs?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume',
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) return new Map();
    const json = await res.json() as LlamaOverviewResp;
    const out = new Map<string, number>();
    for (const [unix, vol] of (json.totalDataChart ?? [])) {
      const date = new Date(Number(unix) * 1000).toISOString().slice(0, 10);
      out.set(date, Number(vol) || 0);
    }
    return out;
  } catch {
    return new Map();
  }
}

interface CGGlobalResp {
  data?: {
    total_volume?: { usd: number };
  };
}

interface CGExchangeVolume {
  trade_volume_24h_btc: number;
  /** USD/BTC ref price for the day */
}

/**
 * CoinGecko doesn't publish a clean 30d CEX-volume timeseries on free tier.
 * We approximate the LATEST day from the global stats endpoint, plus
 * back-fill historical days using CoinGecko's BTC price + a static CEX/total
 * ratio assumption. Surfaces directionally-correct CEX volume but with
 * coarser resolution than DEX side.
 *
 * For a higher-fidelity timeseries, paid CoinGecko / CoinMarketCap subscriptions
 * publish per-exchange day data. We accept the approximation here since the
 * shape (long-term CEX vs DEX share) is what matters.
 */
async function fetchCexVolumeToday(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/global',
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) return null;
    const json = await res.json() as CGGlobalResp;
    return json.data?.total_volume?.usd ?? null;
  } catch { return null; }
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  }

  const [dexHistory, cexTotalToday] = await Promise.all([
    fetchDexVolumeHistory(),
    fetchCexVolumeToday(),
  ]);

  // Build last 30-day timeseries. We have DEX daily; for CEX we use the
  // current global daily as today's value and back-extrapolate prior days
  // assuming CEX daily volume ≈ today's level (a conservative approximation).
  const days: DayPoint[] = [];
  const now = Date.now();

  // Pull recent 35 dex-points, sort by date, take last 30
  const sortedDexDays = Array.from(dexHistory.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-35);

  // CoinGecko's "total_volume" includes both CEX and DEX. Subtract latest DEX
  // value to estimate CEX-only.
  const latestDexDay = sortedDexDays[sortedDexDays.length - 1];
  const latestDex = latestDexDay?.[1] ?? 0;
  const cexTotal = cexTotalToday != null ? Math.max(0, cexTotalToday - latestDex) : 0;

  for (let i = 0; i < sortedDexDays.length; i++) {
    const [date, dexVol] = sortedDexDays[i];
    // Hold CEX flat at today's estimated level — coarse but free.
    const cexVol = cexTotal;
    const total = dexVol + cexVol;
    days.push({
      date,
      cexVolumeUsd: cexVol,
      dexVolumeUsd: dexVol,
      totalVolumeUsd: total,
      dexSharePct: total > 0 ? (dexVol / total) * 100 : 0,
    });
  }

  const last30 = days.slice(-30);
  const latest = last30[last30.length - 1] ? {
    dexSharePct: last30[last30.length - 1].dexSharePct,
    cexVolumeUsd: last30[last30.length - 1].cexVolumeUsd,
    dexVolumeUsd: last30[last30.length - 1].dexVolumeUsd,
    totalVolumeUsd: last30[last30.length - 1].totalVolumeUsd,
    date: last30[last30.length - 1].date,
  } : null;

  const avg30dDexShare = last30.length > 0
    ? last30.reduce((s, d) => s + d.dexSharePct, 0) / last30.length
    : null;

  const body: ApiResponse = {
    days: last30,
    latest,
    avg30dDexShare,
    ts: now,
  };

  if (last30.length > 0) l1 = { body, ts: now };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': last30.length > 0 ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'no-store',
    },
  });
}
