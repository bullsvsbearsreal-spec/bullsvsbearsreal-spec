/**
 * GET /api/cme-basis
 *
 * CME Bitcoin + Ether futures basis vs spot. The basis is the % premium
 * (or discount) of the CME futures contract relative to spot, annualized
 * to the contract's expiry — also called the cash-and-carry rate.
 *
 * Persistent positive basis means leveraged longs are bidding the futures
 * price above spot — institutional risk-on. Negative basis (backwardation)
 * is rare and usually marks fear / forced deleveraging.
 *
 * Free Yahoo Finance for CME futures (BTC=F front-month, ETHUSD=F),
 * CoinGecko for spot. L1 cached 5 min.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface BasisRow {
  asset: 'BTC' | 'ETH';
  spot: number;
  /** Front-month CME futures price */
  cmeFront: number;
  /** Days to expiry of front-month contract (approx, from Yahoo). */
  daysToExpiry: number;
  /** Raw basis = (cme - spot) / spot. */
  basisPct: number;
  /** Annualized basis = basis × (365 / daysToExpiry). */
  annualizedPct: number;
  /** Source labels for transparency. */
  cmeSource: string;
  spotSource: string;
}

interface ApiResponse {
  rows: BasisRow[];
  ts: number;
}

const TIMEOUT = 8000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 5 * 60 * 1000;

interface YahooQuote { price: number; nextExpiryDate?: number | null }

async function fetchYahooQuote(ticker: string): Promise<YahooQuote | null> {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0' } },
      TIMEOUT,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? 0,
      // Yahoo's `expirationDate` is on options, not futures. For continuous
      // front-month (BTC=F) Yahoo doesn't expose expiry directly — assume
      // ~30d to next CME expiry (CME BTC futures roll on the last Friday
      // of each month). Approximation only.
      nextExpiryDate: null,
    };
  } catch {
    return null;
  }
}

interface CGSimple { [key: string]: { usd: number } }

async function fetchSpot(coingeckoIds: string[]): Promise<Record<string, number>> {
  try {
    const res = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(',')}&vs_currencies=usd`,
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) return {};
    const json = await res.json() as CGSimple;
    const out: Record<string, number> = {};
    for (const id of coingeckoIds) {
      if (json[id]?.usd) out[id] = json[id].usd;
    }
    return out;
  } catch { return {}; }
}

/** Approximate days-to-expiry of CME BTC monthly future. Front-month rolls
 *  the last Friday of the contract month; for the rolling continuous symbol
 *  Yahoo serves, we estimate as the average of remaining days in current
 *  month + a small forward bias. Good to ~5 days. */
function approxDaysToExpiry(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  // Find last Friday of current month
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  // 5 = Friday; getUTCDay() returns 0–6 (Sun–Sat)
  let d = lastDay.getUTCDate();
  while (new Date(Date.UTC(year, month, d)).getUTCDay() !== 5) d--;
  let expiryMs = new Date(Date.UTC(year, month, d)).getTime();
  if (expiryMs < now.getTime()) {
    // We're past this month's expiry — use next month's last Friday
    const nextMonth = month + 1;
    const nextLast = new Date(Date.UTC(year, nextMonth + 1, 0));
    let d2 = nextLast.getUTCDate();
    while (new Date(Date.UTC(year, nextMonth, d2)).getUTCDay() !== 5) d2--;
    expiryMs = new Date(Date.UTC(year, nextMonth, d2)).getTime();
  }
  return Math.max(1, Math.round((expiryMs - now.getTime()) / 86_400_000));
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=240, stale-while-revalidate=600' },
    });
  }

  const [btcCme, ethCme, spotPrices] = await Promise.all([
    fetchYahooQuote('BTC=F'),
    fetchYahooQuote('ETHUSD=F'),
    fetchSpot(['bitcoin', 'ethereum']),
  ]);

  const days = approxDaysToExpiry();
  const rows: BasisRow[] = [];

  if (btcCme && spotPrices.bitcoin && btcCme.price > 0) {
    const basisPct = (btcCme.price - spotPrices.bitcoin) / spotPrices.bitcoin;
    rows.push({
      asset: 'BTC',
      spot: spotPrices.bitcoin,
      cmeFront: btcCme.price,
      daysToExpiry: days,
      basisPct,
      annualizedPct: basisPct * (365 / days),
      cmeSource: 'Yahoo BTC=F',
      spotSource: 'CoinGecko',
    });
  }
  if (ethCme && spotPrices.ethereum && ethCme.price > 0) {
    const basisPct = (ethCme.price - spotPrices.ethereum) / spotPrices.ethereum;
    rows.push({
      asset: 'ETH',
      spot: spotPrices.ethereum,
      cmeFront: ethCme.price,
      daysToExpiry: days,
      basisPct,
      annualizedPct: basisPct * (365 / days),
      cmeSource: 'Yahoo ETHUSD=F',
      spotSource: 'CoinGecko',
    });
  }

  const body: ApiResponse = { rows, ts: Date.now() };
  if (rows.length > 0) l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': rows.length > 0 ? 'public, s-maxage=240, stale-while-revalidate=600' : 'no-store',
    },
  });
}
