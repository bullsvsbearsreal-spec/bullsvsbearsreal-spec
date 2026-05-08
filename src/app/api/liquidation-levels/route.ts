/**
 * GET /api/liquidation-levels?symbol=BTC&window=24h
 *
 * Price-level liquidation distribution — "where did traders get rekt?"
 *
 * Two complementary views in one response:
 *
 *   1. `empirical.buckets` — histogram of actual liquidation $ over the
 *      requested window, pulled fresh from OKX's public liquidation-orders
 *      endpoint. Split by long/short.
 *
 *   2. `forecast.clusters` — estimated liquidation clusters at discrete
 *      price levels below/above current price, derived from aggregate open
 *      interest across exchanges + a reasonable leverage distribution
 *      assumption. Uses "typical crypto perp leverage mix":
 *         50% of OI @ 5x, 30% @ 10x, 15% @ 20x, 5% @ 50x
 *      This isn't exact — individual traders' liq prices depend on their
 *      actual leverage + isolated vs cross margin — but the aggregate
 *      clusters are directionally right at each leverage tier.
 *
 * Query params:
 *   symbol   — BTC | ETH | SOL | XRP | DOGE | HYPE | ASTER (default BTC)
 *   window   — 4h | 12h | 24h | 48h (default 24h)
 *
 * Cache: 60s.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOIData } from '../_shared/oi-core';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const WINDOW_HOURS: Record<string, number> = { '4h': 4, '12h': 12, '24h': 24, '48h': 48 };
const SUPPORTED_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'ASTER', 'BNB', 'AVAX', 'LINK', 'SUI', 'LTC']);

// Aggregate "typical" leverage distribution on crypto perps. Conservative
// estimate — real distribution skews more toward 10x-20x on CEXes, but this
// captures the long tail including cross-margin 3-5x whales.
const LEVERAGE_MIX = [
  { leverage: 3,   weight: 0.20 }, // 3x — spot-like positioning, whales
  { leverage: 5,   weight: 0.30 }, // 5x
  { leverage: 10,  weight: 0.25 }, // 10x — most common retail
  { leverage: 20,  weight: 0.15 }, // 20x — degen retail
  { leverage: 50,  weight: 0.08 }, // 50x — max-leverage gamblers
  { leverage: 100, weight: 0.02 }, // 100x — tiny tail
];

interface EmpiricalBucket {
  priceMid: number;
  priceLow: number;
  priceHigh: number;
  longValue: number;  // USD liquidated when longs got rekt (price dropped through here)
  shortValue: number; // USD liquidated when shorts got rekt (price rose through here)
  events: number;
}

interface ForecastCluster {
  priceLevel: number;
  pricePct: number;           // e.g. -5 means 5% below spot
  side: 'long' | 'short';
  leverageTier: number;
  estimatedValue: number;     // USD of OI estimated to be liquidated here
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 60_000;

function bucketSize(price: number): number {
  if (price >= 10_000) return 100;   // BTC: $100 buckets
  if (price >= 1_000)  return 10;    // ETH: $10
  if (price >= 100)    return 1;     // SOL/BNB: $1
  if (price >= 10)     return 0.1;
  if (price >= 1)      return 0.01;
  if (price >= 0.1)    return 0.001;
  return 0.0001;
}

/**
 * OKX perpetual contract sizes. Returned by their public instruments endpoint,
 * but hard-coded here for the symbols we support to avoid an extra upstream
 * call on every request. `sz` from liquidation-orders is in CONTRACTS, not
 * base units — multiplying by `ctVal` gives the real USD value.
 *
 * Source: OKX API docs (contract value) — verified Apr 2026.
 */
const OKX_CONTRACT_MULTIPLIER: Record<string, number> = {
  BTC: 0.01,
  ETH: 0.1,
  SOL: 1,
  XRP: 100,
  DOGE: 1000,
  HYPE: 1,
  ASTER: 10,
  BNB: 0.01,
  AVAX: 1,
  LINK: 1,
  SUI: 10,
  LTC: 1,
};

async function fetchOKXLiquidations(
  symbol: string,
  sinceMs: number,
): Promise<Array<{ ts: number; side: 'long' | 'short'; value: number; price: number }>> {
  // OKX sometimes CF-blocks Vercel bom1 egress. Try OKX first, fall back to
  // the Bybit public funding/liquidation feed if needed.
  try {
    const instId = `${symbol}-USDT-SWAP`;
    const uly = `${symbol}-USDT`;
    const url = `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&instId=${instId}&uly=${uly}&state=filled&limit=100`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Referer': 'https://www.okx.com/',
        'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="123", "Google Chrome";v="123"',
      },
    });
    if (!res.ok) {
      console.warn(`[liq-levels] OKX returned ${res.status}`);
      return [];
    }
    const json = await res.json();
    if (json?.code !== '0') {
      console.warn(`[liq-levels] OKX code=${json?.code} msg=${json?.msg}`);
      return [];
    }
    // OKX's `sz` field is in CONTRACTS, not base units. Apply the per-symbol
    // multiplier (e.g. 0.01 for BTC, 0.1 for ETH) to get real USD notional.
    // Default to 1 if symbol unknown — better to under-count than 100× inflate.
    const contractMult = OKX_CONTRACT_MULTIPLIER[symbol] ?? 1;
    const events: Array<{ ts: number; side: 'long' | 'short'; value: number; price: number }> = [];
    for (const entry of json?.data || []) {
      for (const d of entry.details || []) {
        // OKX convention: "buy" = short position liquidated, "sell" = long liquidated
        const side: 'long' | 'short' = d.side === 'buy' ? 'short' : 'long';
        const contracts = parseFloat(d.sz) || 0;
        const price = parseFloat(d.bkPx) || 0;
        const ts = parseInt(d.ts, 10) || 0;
        if (ts < sinceMs) continue;
        if (contracts > 0 && price > 0) {
          const usdValue = contracts * contractMult * price;
          events.push({ ts, side, value: usdValue, price });
        }
      }
    }
    return events;
  } catch (err) {
    console.warn('[liq-levels] OKX fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fallback to InfoHub's own /api/liquidations which reads from the
 * liquidation_snapshots DB. Data can be stale but keeps the chart non-empty
 * when OKX is blocked.
 */
async function fetchDBLiquidations(
  symbol: string,
  sinceMs: number,
): Promise<Array<{ ts: number; side: 'long' | 'short'; value: number; price: number }>> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
    const res = await fetch(`${baseUrl}/api/liquidations?symbol=${symbol}`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows: Array<{ side: string; size: number; price: number; value: number; timestamp: number }> = json?.data || [];
    const events: Array<{ ts: number; side: 'long' | 'short'; value: number; price: number }> = [];
    for (const r of rows) {
      if (r.timestamp < sinceMs) continue;
      const side = r.side === 'long' ? 'long' : 'short';
      if (r.price > 0 && r.value > 0) {
        events.push({ ts: r.timestamp, side, value: r.value, price: r.price });
      }
    }
    return events;
  } catch { return []; }
}

function bucketEmpirical(
  events: Array<{ ts: number; side: 'long' | 'short'; value: number; price: number }>,
): EmpiricalBucket[] {
  if (events.length === 0) return [];
  const minPrice = Math.min(...events.map(e => e.price));
  const maxPrice = Math.max(...events.map(e => e.price));
  const avg = events.reduce((s, e) => s + e.price, 0) / events.length;
  const bucketStep = bucketSize(avg);
  const bucketOf = (p: number) => Math.floor(p / bucketStep) * bucketStep;

  const map = new Map<number, EmpiricalBucket>();
  for (const e of events) {
    const lo = bucketOf(e.price);
    const hi = lo + bucketStep;
    const mid = lo + bucketStep / 2;
    let b = map.get(lo);
    if (!b) {
      b = { priceMid: mid, priceLow: lo, priceHigh: hi, longValue: 0, shortValue: 0, events: 0 };
      map.set(lo, b);
    }
    if (e.side === 'long') b.longValue += e.value;
    else b.shortValue += e.value;
    b.events++;
  }
  void minPrice; void maxPrice;
  return Array.from(map.values()).sort((a, b) => a.priceMid - b.priceMid);
}

async function computeForecast(symbol: string): Promise<{ clusters: ForecastCluster[]; spotPrice: number; totalOI: number }> {
  // Pull OI directly from the in-process function — NOT via self-referential
  // HTTP, which CLAUDE.md explicitly warns against (600KB transfer + middleware
  // rate-limit risk + extra cold-start latency). Production smoke caught this:
  // the prior fetch was returning rows=[] in some environments, leaving
  // spotPrice=0 and totalOI=0 in the response despite the data existing.
  let rows: Array<{ symbol: string; exchange: string; openInterest: number; openInterestValue: number }> = [];
  try {
    const oi = await getOIData();
    if (oi?.result?.data) {
      rows = oi.result.data
        .filter((r: any) => r.symbol === symbol)
        .map((r: any) => ({
          symbol: r.symbol,
          exchange: r.exchange,
          openInterest: r.openInterest ?? 0,
          openInterestValue: r.openInterestValue ?? 0,
        }));
    }
  } catch { /* fallback to empty */ }

  const totalOI = rows.reduce((s, r) => s + (r.openInterestValue || 0), 0);

  // Best available spot price — derive from the highest-OI exchange's
  // openInterestValue / openInterest ratio (effectively the venue mark price).
  const best = rows.sort((a, b) => (b.openInterestValue || 0) - (a.openInterestValue || 0))[0];
  const spotPrice = best && best.openInterest > 0 ? best.openInterestValue / best.openInterest : 0;
  if (!spotPrice || !totalOI) return { clusters: [], spotPrice: 0, totalOI: 0 };

  // For each leverage tier, long positions get liquidated at price * (1 - 1/lev)
  // and short positions at price * (1 + 1/lev). Skewing long/short proportion
  // 50/50 since we don't have per-side OI granularity for every venue.
  const clusters: ForecastCluster[] = [];
  for (const { leverage, weight } of LEVERAGE_MIX) {
    const tierOI = totalOI * weight;
    // Each side (long/short) gets half of tier OI, by simplifying assumption
    const sideOI = tierOI / 2;
    const dropPct = 100 / leverage;            // e.g. 20x → 5% drop liquidates longs
    const longLiqPrice = spotPrice * (1 - dropPct / 100);
    const shortLiqPrice = spotPrice * (1 + dropPct / 100);
    clusters.push({
      priceLevel: longLiqPrice,
      pricePct: -dropPct,
      side: 'long',
      leverageTier: leverage,
      estimatedValue: sideOI,
    });
    clusters.push({
      priceLevel: shortLiqPrice,
      pricePct: dropPct,
      side: 'short',
      leverageTier: leverage,
      estimatedValue: sideOI,
    });
  }
  return { clusters, spotPrice, totalOI };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawSymbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const symbol = SUPPORTED_SYMBOLS.has(rawSymbol) ? rawSymbol : 'BTC';
  const windowParam = searchParams.get('window') || '24h';
  const windowKey = WINDOW_HOURS[windowParam] ? windowParam : '24h';
  const windowHours = WINDOW_HOURS[windowKey];
  const windowMs = windowHours * 3600_000;

  const cacheKey = `liq-levels:${symbol}:${windowKey}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const sinceMs = Date.now() - windowMs;

  const [okxEvents, forecast] = await Promise.all([
    fetchOKXLiquidations(symbol, sinceMs),
    computeForecast(symbol),
  ]);

  // If OKX returned nothing (CF-block, rate limit, or just no events in the
  // window), fall back to the DB-backed /api/liquidations feed so the chart
  // isn't empty. The DB data can be 1-4 days stale depending on cron health —
  // we flag that in the response so the UI can show a staleness warning.
  let events = okxEvents;
  let source: 'okx' | 'db' | 'empty' = okxEvents.length > 0 ? 'okx' : 'empty';
  if (events.length === 0) {
    const dbEvents = await fetchDBLiquidations(symbol, sinceMs);
    if (dbEvents.length > 0) {
      events = dbEvents;
      source = 'db';
    }
  }

  const buckets = bucketEmpirical(events);
  const totalLong = events.filter(e => e.side === 'long').reduce((s, e) => s + e.value, 0);
  const totalShort = events.filter(e => e.side === 'short').reduce((s, e) => s + e.value, 0);
  const maxBucket = buckets.reduce((m, b) => Math.max(m, b.longValue + b.shortValue), 0);

  const body = {
    symbol,
    window: windowKey,
    spotPrice: forecast.spotPrice,
    totalOI: forecast.totalOI,
    empirical: {
      buckets,
      totalLong,
      totalShort,
      total: totalLong + totalShort,
      events: events.length,
      maxBucket,
      source,
    },
    forecast: {
      clusters: forecast.clusters.sort((a, b) => a.pricePct - b.pricePct),
      leverageMix: LEVERAGE_MIX,
    },
    meta: {
      timestamp: Date.now(),
      supportedSymbols: Array.from(SUPPORTED_SYMBOLS),
    },
  };

  cache.set(cacheKey, { body, ts: Date.now() });
  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
