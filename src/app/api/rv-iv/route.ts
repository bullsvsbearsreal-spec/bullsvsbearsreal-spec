/**
 * GET /api/rv-iv?asset=BTC|ETH
 *
 * Realized vs Implied volatility tracker.
 *
 * Realized vol (RV): rolling-window annualized standard deviation of log
 * returns from CoinGecko daily closes. We compute 7d, 14d, 30d windows.
 *
 * Implied vol (IV): ATM IV from Deribit, averaged across nearby strikes
 * for the front-month expiry. We pull 30d, 60d, 90d expiries.
 *
 * Premium = IV - RV (in vol points). Persistent positive premium = options
 * priced above realized — option sellers favoured. Negative premium = under-
 * priced — option buyers favoured. Mean-reverts historically.
 *
 * Free CoinGecko + Deribit. L1 cached 15 min.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface CGMarketChart { prices: Array<[number, number]> }
interface DeribitInstrument { instrument_name: string; expiration_timestamp: number; strike: number; option_type: 'call' | 'put' }
interface DeribitSummary { instrument_name: string; mark_iv: number; underlying_price: number }

interface ApiResponse {
  asset: 'BTC' | 'ETH';
  rv: { window7d: number | null; window14d: number | null; window30d: number | null };
  iv: { atm30d: number | null; atm60d: number | null; atm90d: number | null };
  /** Headline number: 30d IV − 30d RV in vol points. */
  premium30d: number | null;
  underlyingPrice: number | null;
  ts: number;
}

const TIMEOUT = 10_000;
const l1Cache = new Map<string, { body: ApiResponse; ts: number }>();
const L1_TTL = 15 * 60 * 1000;

async function fetchPrices(asset: 'BTC' | 'ETH'): Promise<Array<{ time: number; close: number }>> {
  const id = asset === 'BTC' ? 'bitcoin' : 'ethereum';

  // Primary: CoinGecko market_chart. Free tier rate-limits aggressively from
  // datacenter IPs; if it 429s or times out, fall back to Binance daily klines.
  try {
    const res = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=60&interval=daily`,
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (res.ok) {
      const json = await res.json() as CGMarketChart;
      const prices = (json.prices ?? []).map(([ms, close]) => ({ time: ms, close })).sort((a, b) => a.time - b.time);
      if (prices.length >= 30) return prices;
    } else {
      console.warn(`[rv-iv] CoinGecko ${asset} returned HTTP ${res.status}, falling back to Binance`);
    }
  } catch (e) {
    console.warn(`[rv-iv] CoinGecko ${asset} fetch error: ${e instanceof Error ? e.message : String(e)}, falling back to Binance`);
  }

  // Fallback: Binance USDT spot klines, daily, 60 candles.
  try {
    const symbol = `${asset}USDT`;
    const res = await fetchWithTimeout(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=60`,
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) return [];
    const arr = await res.json() as Array<[number, string, string, string, string, ...unknown[]]>;
    if (!Array.isArray(arr)) return [];
    return arr.map(k => ({ time: k[0], close: Number(k[4]) || 0 }))
      .filter(p => p.close > 0)
      .sort((a, b) => a.time - b.time);
  } catch (e) {
    console.warn(`[rv-iv] Binance fallback failed: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/** Annualised realised vol (std dev of log returns × sqrt(365)). */
function realisedVol(prices: Array<{ close: number }>, windowDays: number): number | null {
  if (prices.length < windowDays + 1) return null;
  const slice = prices.slice(-windowDays - 1);
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const a = slice[i - 1].close;
    const b = slice[i].close;
    if (a > 0 && b > 0) returns.push(Math.log(b / a));
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((s, x) => s + x, 0) / returns.length;
  const variance = returns.reduce((s, x) => s + (x - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(365) * 100;  // % annualised
}

async function fetchDeribitIv(asset: 'BTC' | 'ETH'): Promise<{ atm30d: number | null; atm60d: number | null; atm90d: number | null; underlying: number | null }> {
  try {
    const [instrumentsRes, summariesRes] = await Promise.all([
      fetchWithTimeout(
        `https://www.deribit.com/api/v2/public/get_instruments?currency=${asset}&kind=option&expired=false`,
        {},
        TIMEOUT,
      ),
      fetchWithTimeout(
        `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${asset}&kind=option`,
        {},
        TIMEOUT,
      ),
    ]);
    if (!instrumentsRes.ok || !summariesRes.ok) return { atm30d: null, atm60d: null, atm90d: null, underlying: null };
    const insts = (await instrumentsRes.json() as { result?: DeribitInstrument[] }).result ?? [];
    const sums = (await summariesRes.json() as { result?: DeribitSummary[] }).result ?? [];

    const meta = new Map<string, DeribitInstrument>();
    for (const i of insts) meta.set(i.instrument_name, i);
    const underlying = sums.find(s => Number.isFinite(s.underlying_price))?.underlying_price ?? null;
    if (!underlying || underlying <= 0) return { atm30d: null, atm60d: null, atm90d: null, underlying };

    const now = Date.now();
    const buckets: Record<'30d' | '60d' | '90d', Array<{ strike: number; iv: number; daysToExpiry: number }>> = {
      '30d': [], '60d': [], '90d': [],
    };
    for (const s of sums) {
      const m = meta.get(s.instrument_name);
      if (!m) continue;
      const days = Math.round((m.expiration_timestamp - now) / 86_400_000);
      if (!Number.isFinite(s.mark_iv) || s.mark_iv <= 0) continue;
      const strikePct = m.strike / underlying;
      // ATM band: strike within ±5% of spot
      if (strikePct < 0.95 || strikePct > 1.05) continue;
      const entry = { strike: m.strike, iv: s.mark_iv, daysToExpiry: days };
      // Bucket by closest target window
      if (days >= 14 && days <= 45) buckets['30d'].push(entry);
      else if (days >= 46 && days <= 75) buckets['60d'].push(entry);
      else if (days >= 76 && days <= 110) buckets['90d'].push(entry);
    }
    const avg = (arr: typeof buckets['30d']) => arr.length === 0 ? null : arr.reduce((s, x) => s + x.iv, 0) / arr.length;
    return {
      atm30d: avg(buckets['30d']),
      atm60d: avg(buckets['60d']),
      atm90d: avg(buckets['90d']),
      underlying,
    };
  } catch {
    return { atm30d: null, atm60d: null, atm90d: null, underlying: null };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const asset = (searchParams.get('asset') || 'BTC').toUpperCase() as 'BTC' | 'ETH';
  if (asset !== 'BTC' && asset !== 'ETH') {
    return NextResponse.json({ error: 'asset must be BTC or ETH' }, { status: 400 });
  }
  const cacheKey = `rviv_${asset}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  }

  const [prices, ivData] = await Promise.all([
    fetchPrices(asset),
    fetchDeribitIv(asset),
  ]);

  const rv7 = realisedVol(prices, 7);
  const rv14 = realisedVol(prices, 14);
  const rv30 = realisedVol(prices, 30);

  const premium30d = (ivData.atm30d != null && rv30 != null) ? ivData.atm30d - rv30 : null;

  const body: ApiResponse = {
    asset,
    rv: { window7d: rv7, window14d: rv14, window30d: rv30 },
    iv: ivData,
    premium30d,
    underlyingPrice: ivData.underlying,
    ts: Date.now(),
  };

  l1Cache.set(cacheKey, { body, ts: Date.now() });

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
  });
}
