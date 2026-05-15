/**
 * GET /api/momentum
 *
 * Momentum setup screener. Pulls tickers + funding + OI from the existing
 * aggregated endpoints and surfaces coins where multiple momentum signals
 * converge:
 *   • 24h price change > X%  (price momentum)
 *   • 24h volume relative to median (volume surge)
 *   • funding rate direction-aligned with move (squeeze setup)
 *   • OI change direction-aligned (new money coming in)
 *
 * Scoring is a simple weighted sum → 0-100. Cache 90s.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizePercent } from '@/lib/utils/sanitizePercent';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface TickerRow {
  symbol: string;
  exchange: string;
  lastPrice?: number;
  priceChangePercent24h?: number;
  changePercent24h?: number;
  quoteVolume24h?: number;
  volume24h?: number;
}
interface FundingRow {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingInterval?: '1h' | '4h' | '8h';
}
interface OIRow {
  symbol: string;
  exchange: string;
  openInterestValue?: number;
  openInterestUsd?: number;
}

export interface MomentumRow {
  symbol: string;
  lastPrice: number;
  change24hPct: number;
  volume24hUsd: number;
  aggregateOiUsd: number;
  oiWeightedFunding8h: number;   // % per 8h, sign-aligned with biggest move
  venueCount: number;            // ticker venues
  score: number;                 // 0-100 composite
  setup: string;                 // short label describing the setup
}

interface MomentumResponse {
  data: MomentumRow[];
  summary: {
    longBiased: number;   // count of rows with score >= 60 and positive change
    shortBiased: number;  // count of rows with score >= 60 and negative change
    medianVolume: number;
  };
  meta: { timestamp: number; minScore: number; returned: number };
}

const cache = new Map<string, { body: MomentumResponse; ts: number }>();
const CACHE_TTL = 90_000;

function normTo8h(rate: number, interval?: string): number {
  if (!interval || interval === '8h') return rate;
  if (interval === '4h') return rate * 2;
  if (interval === '1h') return rate * 8;
  return rate;
}

async function fetchJson<T = any>(url: string, timeoutMs = 10_000): Promise<T | null> {
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const minScore = Math.max(0, Math.min(100, parseInt(searchParams.get('min_score') || '40', 10) || 40));
  const limit = Math.max(10, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));

  const cacheKey = `momentum:${minScore}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, {
      // Match the MISS-path Cache-Control so CF can still edge-cache HITs.
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=180' },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';

  const [tickersRes, fundingRes, oiRes] = await Promise.all([
    fetchJson<{ data?: TickerRow[] }>(`${baseUrl}/api/tickers`),
    fetchJson<{ data?: FundingRow[] }>(`${baseUrl}/api/funding?assetClass=crypto`),
    fetchJson<{ data?: OIRow[] }>(`${baseUrl}/api/openinterest`),
  ]);

  const tickers = tickersRes?.data ?? [];
  const fundings = fundingRes?.data ?? [];
  const ois = oiRes?.data ?? [];

  if (!tickers.length) {
    return NextResponse.json({ error: 'no ticker data upstream', data: [] }, { status: 502 });
  }

  // Aggregate ticker stats per symbol (median price, max 24h change across venues, summed volume)
  interface Agg {
    symbol: string;
    venueCount: number;
    priceSum: number;
    priceCount: number;
    maxAbsChange: number;
    signedChange: number;   // from venue with max |change|
    volumeSum: number;
  }
  const bySym = new Map<string, Agg>();
  for (const t of tickers) {
    if (!t.symbol) continue;
    const price = Number(t.lastPrice) || 0;
    // Defence-in-depth: BingX (and occasionally other venues) emit garbage
    // priceChangePercent in the 280,000%+ range when their openPrice is 0
    // for newly-listed pairs. The max-abs-change selection below would let
    // one bad venue dominate the display for the entire symbol. Cap any
    // single-venue percent at +/-1000% before considering it.
    const change = sanitizePercent(t.priceChangePercent24h ?? t.changePercent24h);
    const vol = Number(t.quoteVolume24h ?? t.volume24h) || 0;
    let agg = bySym.get(t.symbol);
    if (!agg) {
      agg = { symbol: t.symbol, venueCount: 0, priceSum: 0, priceCount: 0, maxAbsChange: 0, signedChange: 0, volumeSum: 0 };
      bySym.set(t.symbol, agg);
    }
    agg.venueCount += 1;
    if (price > 0) { agg.priceSum += price; agg.priceCount += 1; }
    agg.volumeSum += vol;
    if (Math.abs(change) > agg.maxAbsChange) {
      agg.maxAbsChange = Math.abs(change);
      agg.signedChange = change;
    }
  }

  // Aggregate OI per symbol
  const oiBySym = new Map<string, number>();
  for (const o of ois) {
    const usd = o.openInterestValue ?? o.openInterestUsd ?? 0;
    if (!o.symbol || !Number.isFinite(usd) || usd <= 0) continue;
    oiBySym.set(o.symbol, (oiBySym.get(o.symbol) ?? 0) + usd);
  }

  // OI-weighted funding per symbol
  interface FundAgg { num: number; den: number; avg: number; count: number; }
  const fundBySym = new Map<string, FundAgg>();
  for (const f of fundings) {
    if (!f.symbol || !Number.isFinite(f.fundingRate)) continue;
    const rate8h = normTo8h(f.fundingRate, f.fundingInterval);
    let fa = fundBySym.get(f.symbol);
    if (!fa) { fa = { num: 0, den: 0, avg: 0, count: 0 }; fundBySym.set(f.symbol, fa); }
    fa.avg = (fa.avg * fa.count + rate8h) / (fa.count + 1);
    fa.count += 1;
  }

  // Median volume for surge detection
  const allVols = Array.from(bySym.values()).map(a => a.volumeSum).filter(v => v > 0).sort((a, b) => a - b);
  const medianVolume = allVols.length ? allVols[Math.floor(allVols.length / 2)] : 0;

  // Score each symbol
  const rows: MomentumRow[] = [];
  bySym.forEach(a => {
    // Drop illiquid micros + stables (heuristic: no quote vol or matches stable ticker)
    if (a.volumeSum < 1_000_000) return;
    if (/^(USDT|USDC|DAI|BUSD|TUSD|USDP|FDUSD|PYUSD|USDE)$/i.test(a.symbol)) return;

    const avgPrice = a.priceCount > 0 ? a.priceSum / a.priceCount : 0;
    const change = a.signedChange;
    const absChange = Math.abs(change);
    const volRatio = medianVolume > 0 ? a.volumeSum / medianVolume : 0;
    const oiUsd = oiBySym.get(a.symbol) ?? 0;
    const funding = fundBySym.get(a.symbol)?.avg ?? 0;
    // Direction aligned? funding usually chases price; if both sign same, squeeze brewing.
    const fundingAligned = Math.sign(funding) === Math.sign(change) && change !== 0;

    // Composite score
    // - 40 pts for |change|, full at 15%, half at 7.5%
    const changeScore = Math.min(40, absChange * (40 / 15));
    // - 25 pts for volume surge, full at 3x median
    const volScore = Math.min(25, volRatio * (25 / 3));
    // - 20 pts if funding aligned with move
    const fundScore = fundingAligned ? Math.min(20, Math.abs(funding) * 400) : 0;
    // - 15 pts if OI > $10M
    const oiScore = oiUsd >= 10_000_000 ? 15 : (oiUsd >= 1_000_000 ? 8 : 0);

    const score = Math.round(changeScore + volScore + fundScore + oiScore);
    if (score < minScore) return;

    const parts: string[] = [];
    if (absChange >= 10) parts.push('big move');
    if (volRatio >= 3) parts.push('volume surge');
    if (fundingAligned && Math.abs(funding) >= 0.01) parts.push('funding alignment');
    if (oiUsd >= 10_000_000 && absChange >= 5) parts.push('real OI');
    if (!parts.length) parts.push('momentum');
    const direction = change > 0 ? 'long' : 'short';

    rows.push({
      symbol: a.symbol,
      lastPrice: avgPrice,
      change24hPct: change,
      volume24hUsd: a.volumeSum,
      aggregateOiUsd: oiUsd,
      oiWeightedFunding8h: funding,
      venueCount: a.venueCount,
      score,
      setup: `${direction} · ${parts.join(', ')}`,
    });
  });

  rows.sort((a, b) => b.score - a.score);
  const trimmed = rows.slice(0, limit);

  const longBiased = rows.filter(r => r.score >= 60 && r.change24hPct > 0).length;
  const shortBiased = rows.filter(r => r.score >= 60 && r.change24hPct < 0).length;

  const body: MomentumResponse = {
    data: trimmed,
    summary: { longBiased, shortBiased, medianVolume },
    meta: { timestamp: Date.now(), minScore, returned: trimmed.length },
  };

  // Don't pin an all-empty body — if every upstream (tickers / funding /
  // OI) was down for this tick we'd otherwise serve "no momentum
  // setups anywhere" for 90s even after upstreams recover. The empty
  // case is still returned to the caller (with no-store on the
  // Cache-Control) so they see fresh-but-empty rather than a stale
  // zero from the L1 cache.
  if (trimmed.length > 0) {
    cache.set(cacheKey, { body, ts: Date.now() });
  }
  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': trimmed.length > 0
        ? 'public, s-maxage=90, stale-while-revalidate=180'
        : 'no-store',
    },
  });
}
