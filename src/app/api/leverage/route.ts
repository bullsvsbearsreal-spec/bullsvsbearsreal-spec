/**
 * GET /api/leverage
 *
 * Aggregate leverage indicators — a single-page snapshot of how much crypto
 * positioning is driven by futures vs spot, and where the "heavy money"
 * (size-weighted) is leaning on funding.
 *
 * Components:
 *   • OI-weighted funding rate (by symbol) — Σ(funding × OI) / Σ(OI).
 *     More honest than simple-avg funding because big venues dominate.
 *   • Spot/Perp volume ratio — CoinGecko 24h spot vol vs sum of our
 *     aggregated 24h perp vol. Lower = more leverage-driven market.
 *   • Aggregate funding pressure — a signed cross-symbol OI-weighted rate.
 *
 * Reuses already-cached /api/funding and /api/openinterest + /api/tickers.
 *
 * Cache: 60s.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface FundingRow {
  symbol: string;
  exchange: string;
  fundingRate: number;          // % per interval
  fundingInterval?: '1h' | '4h' | '8h';
  /** Precise per-symbol interval in hours (e.g. 24 for Blofin's
   *  daily-settle pairs). Honored over the enum bucket when set. */
  fundingIntervalHours?: number | null;
  markPrice?: number;
}
interface OIRow {
  symbol: string;
  exchange: string;
  openInterestValue?: number;    // USD value from /api/openinterest
  openInterestUsd?: number;      // alt field name used elsewhere
}
interface TickerRow {
  symbol: string;
  exchange: string;
  quoteVolume24h?: number;       // USD volume from /api/tickers
  volume24hUsd?: number;         // alt field
}

export interface LeverageSymbolRow {
  symbol: string;
  aggregateOiUsd: number;
  venueCount: number;
  oiWeightedFunding8h: number;  // % per 8h
  simpleAvgFunding8h: number;
  spread: number;               // weighted - simple
  perpVolume24h: number;
  spotVolume24h: number;
  spotPerpRatio: number;        // spot / perp
}

interface LeverageResponse {
  data: LeverageSymbolRow[];
  summary: {
    totalOiUsd: number;
    aggregateFunding8h: number;  // cross-symbol OI-weighted funding
    perpVolume24h: number;
    spotVolume24h: number;
    spotPerpRatio: number;
    leverageBias: 'heavy_long' | 'heavy_short' | 'neutral';
    perpDominant: boolean;  // true if spot/perp < 0.7
  };
  meta: { timestamp: number; symbolsTracked: number };
}

const cache = new Map<string, { body: LeverageResponse; ts: number }>();
const CACHE_TTL = 60_000;

function normalizeFundingTo8h(
  rate: number,
  interval: '1h' | '4h' | '8h' | undefined,
  intervalH?: number | null,
): number {
  // Precise per-symbol hours win when set — Blofin (24h) emits the
  // closest enum bucket '8h' alongside fundingIntervalHours=24, and
  // without honoring the precise value this normalizer treats it as
  // already-8h and the rate is 3x-overstated in leverage rankings.
  if (intervalH != null && Number.isFinite(intervalH) && intervalH > 0) {
    return rate * (8 / intervalH);
  }
  if (!interval || interval === '8h') return rate;
  if (interval === '4h') return rate * 2;
  if (interval === '1h') return rate * 8;
  return rate;
}

async function fetchJson<T = any>(url: string, timeoutMs = 12_000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// CoinGecko /coins/markets returns `total_volume` which is the 24h SPOT volume
// for each asset. We pluck the top 50 to match our perp coverage universe.
async function getSpotVolumeMap(): Promise<Map<string, number>> {
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1';
  const rows = await fetchJson<Array<{ symbol?: string; total_volume?: number }>>(url);
  const map = new Map<string, number>();
  if (!Array.isArray(rows)) return map;
  for (const r of rows) {
    const sym = (r.symbol || '').toUpperCase();
    if (!sym) continue;
    // CoinGecko returns spot volume in USD directly
    map.set(sym, r.total_volume ?? 0);
  }
  return map;
}

export async function GET(_request: NextRequest) {
  const cacheKey = 'leverage:v1';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';

  const [fundingRes, oiRes, tickersRes, spotVolMap] = await Promise.all([
    fetchJson<{ data?: FundingRow[] }>(`${baseUrl}/api/funding?assetClass=crypto`),
    fetchJson<{ data?: OIRow[] }>(`${baseUrl}/api/openinterest`),
    fetchJson<{ data?: TickerRow[] }>(`${baseUrl}/api/tickers`),
    getSpotVolumeMap(),
  ]);

  const fundingRows = fundingRes?.data ?? [];
  const oiRows = oiRes?.data ?? [];
  const tickerRows = tickersRes?.data ?? [];

  // Index funding by symbol -> [{exchange, rate8h}]
  interface FundingBySym { exchange: string; rate8h: number; }
  const fundingBySym = new Map<string, FundingBySym[]>();
  for (const r of fundingRows) {
    if (!r.symbol || !Number.isFinite(r.fundingRate)) continue;
    const rate8h = normalizeFundingTo8h(r.fundingRate, r.fundingInterval, r.fundingIntervalHours);
    const list = fundingBySym.get(r.symbol) ?? [];
    list.push({ exchange: r.exchange, rate8h });
    fundingBySym.set(r.symbol, list);
  }

  // Index OI by symbol -> [{exchange, oiUsd}]
  interface OIBySym { exchange: string; oiUsd: number; }
  const oiBySym = new Map<string, OIBySym[]>();
  for (const r of oiRows) {
    const oiUsd = r.openInterestValue ?? r.openInterestUsd ?? 0;
    if (!r.symbol || !Number.isFinite(oiUsd) || oiUsd <= 0) continue;
    const list = oiBySym.get(r.symbol) ?? [];
    list.push({ exchange: r.exchange, oiUsd });
    oiBySym.set(r.symbol, list);
  }

  // Ticker volumes by symbol (sum across exchanges). Tickers return
  // `quoteVolume24h` in USD for most CEXes.
  const perpVolBySym = new Map<string, number>();
  for (const r of tickerRows) {
    const vol = r.quoteVolume24h ?? r.volume24hUsd ?? 0;
    if (!r.symbol || !Number.isFinite(vol)) continue;
    perpVolBySym.set(r.symbol, (perpVolBySym.get(r.symbol) ?? 0) + vol);
  }

  // Build per-symbol leverage rows for symbols with OI + funding data
  const rows: LeverageSymbolRow[] = [];
  oiBySym.forEach((oiList, symbol) => {
    const fundingList = fundingBySym.get(symbol) ?? [];
    if (!fundingList.length) return;

    // Map exchange->oi for weight lookup
    const oiByExchange = new Map<string, number>();
    let aggOi = 0;
    for (const o of oiList) {
      oiByExchange.set(o.exchange, o.oiUsd);
      aggOi += o.oiUsd;
    }
    if (aggOi <= 0) return;

    let weightedNum = 0;
    let weightTotal = 0;
    let simpleSum = 0;
    let simpleCount = 0;
    for (const f of fundingList) {
      const w = oiByExchange.get(f.exchange) ?? 0;
      if (w > 0) {
        weightedNum += f.rate8h * w;
        weightTotal += w;
      }
      simpleSum += f.rate8h;
      simpleCount += 1;
    }

    const oiWeightedFunding8h = weightTotal > 0 ? weightedNum / weightTotal : 0;
    const simpleAvgFunding8h = simpleCount > 0 ? simpleSum / simpleCount : 0;

    const perpVol = perpVolBySym.get(symbol) ?? 0;
    const spotVol = spotVolMap.get(symbol) ?? 0;

    rows.push({
      symbol,
      aggregateOiUsd: aggOi,
      venueCount: fundingList.length,
      oiWeightedFunding8h,
      simpleAvgFunding8h,
      spread: oiWeightedFunding8h - simpleAvgFunding8h,
      perpVolume24h: perpVol,
      spotVolume24h: spotVol,
      spotPerpRatio: perpVol > 0 ? spotVol / perpVol : 0,
    });
  });

  // Sort by aggregate OI desc and keep top 50
  rows.sort((a, b) => b.aggregateOiUsd - a.aggregateOiUsd);
  const topRows = rows.slice(0, 50);

  // Cross-symbol OI-weighted aggregate funding
  let aggNum = 0;
  let aggDen = 0;
  for (const r of topRows) {
    aggNum += r.oiWeightedFunding8h * r.aggregateOiUsd;
    aggDen += r.aggregateOiUsd;
  }
  const aggregateFunding8h = aggDen > 0 ? aggNum / aggDen : 0;

  // Global volume totals
  const totalPerpVol = topRows.reduce((s, r) => s + r.perpVolume24h, 0);
  const totalSpotVol = topRows.reduce((s, r) => s + r.spotVolume24h, 0);
  const globalSpotPerpRatio = totalPerpVol > 0 ? totalSpotVol / totalPerpVol : 0;

  let leverageBias: 'heavy_long' | 'heavy_short' | 'neutral' = 'neutral';
  if (aggregateFunding8h > 0.01) leverageBias = 'heavy_long';
  else if (aggregateFunding8h < -0.01) leverageBias = 'heavy_short';

  const body: LeverageResponse = {
    data: topRows,
    summary: {
      totalOiUsd: aggDen,
      aggregateFunding8h,
      perpVolume24h: totalPerpVol,
      spotVolume24h: totalSpotVol,
      spotPerpRatio: globalSpotPerpRatio,
      leverageBias,
      perpDominant: globalSpotPerpRatio > 0 && globalSpotPerpRatio < 0.7,
    },
    meta: { timestamp: Date.now(), symbolsTracked: topRows.length },
  };

  // Only pin cache when we have at least one symbol row. Was: cached an
  // empty `{data: [], summary: {totalOI: 0, ...}}` for 60s when both
  // /api/openinterest and /api/tickers came back empty during full
  // upstream outage. UI would render "no leverage data" with stale-
  // while-revalidate keeping it sticky for another 3 min.
  if (topRows.length > 0) {
    cache.set(cacheKey, { body, ts: Date.now() });
  }
  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': topRows.length > 0
        ? 'public, s-maxage=60, stale-while-revalidate=180'
        : 'no-store',
    },
  });
}
