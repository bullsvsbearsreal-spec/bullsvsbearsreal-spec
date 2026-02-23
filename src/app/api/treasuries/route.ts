/**
 * GET /api/treasuries
 *
 * Bitcoin treasury data: hardcoded holder list with live BTC price
 * from Yahoo Finance. Returns holders sorted by BTC holdings descending.
 */

import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

/* --- Cache ---------------------------------------------------------------- */

const l1Cache = new Map<string, { body: any; timestamp: number }>();
const L1_TTL = 10 * 60 * 1000; // 10 minutes

/* --- Types ---------------------------------------------------------------- */

interface HolderEntry {
  name: string;
  ticker: string | null;
  type: 'company' | 'etf' | 'government' | 'miner';
  btcHoldings: number;
  country?: string;
}

/* --- Static holder data --------------------------------------------------- */

const HOLDERS: HolderEntry[] = [
  { name: 'BlackRock IBIT ETF', ticker: 'IBIT', type: 'etf', btcHoldings: 570_000 },
  { name: 'MicroStrategy', ticker: 'MSTR', type: 'company', btcHoldings: 450_000 },
  { name: 'Fidelity FBTC', ticker: 'FBTC', type: 'etf', btcHoldings: 200_000 },
  { name: 'Grayscale GBTC', ticker: 'GBTC', type: 'etf', btcHoldings: 200_000 },
  { name: 'US Government', ticker: null, type: 'government', btcHoldings: 200_000, country: 'US' },
  { name: 'Chinese Government', ticker: null, type: 'government', btcHoldings: 190_000, country: 'CN' },
  { name: 'Block.one', ticker: null, type: 'company', btcHoldings: 140_000 },
  { name: 'Tether', ticker: null, type: 'company', btcHoldings: 83_000 },
  { name: 'UK Government', ticker: null, type: 'government', btcHoldings: 61_000, country: 'GB' },
  { name: 'Marathon Digital', ticker: 'MARA', type: 'miner', btcHoldings: 45_000 },
  { name: 'Riot Platforms', ticker: 'RIOT', type: 'miner', btcHoldings: 18_000 },
  { name: 'Tesla', ticker: 'TSLA', type: 'company', btcHoldings: 10_000 },
  { name: 'Hut 8 Mining', ticker: 'HUT', type: 'miner', btcHoldings: 10_000 },
  { name: 'CleanSpark', ticker: 'CLSK', type: 'miner', btcHoldings: 10_000 },
  { name: 'Coinbase', ticker: 'COIN', type: 'company', btcHoldings: 9_500 },
  { name: 'Galaxy Digital', ticker: 'GLXY', type: 'company', btcHoldings: 8_000 },
  { name: 'El Salvador', ticker: null, type: 'government', btcHoldings: 6_000, country: 'SV' },
  { name: 'Bitdeer', ticker: 'BTDR', type: 'miner', btcHoldings: 1_000 },
];

/* --- BTC price fetch ------------------------------------------------------ */

async function fetchBTCPrice(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      'https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=1d&interval=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InfoHub/1.0)' } },
      6000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch {
    return null;
  }
}

/* --- Main handler --------------------------------------------------------- */

export async function GET() {
  const cacheKey = 'treasuries_v1';
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  }

  const price = await fetchBTCPrice();
  const btcPrice = price ?? 97_000; // fallback price if Yahoo fails

  const holders = [...HOLDERS]
    .sort((a, b) => b.btcHoldings - a.btcHoldings)
    .map((h) => ({
      ...h,
      estimatedValueUsd: h.btcHoldings * btcPrice,
    }));

  const totalBTC = holders.reduce((sum, h) => sum + h.btcHoldings, 0);
  const totalValueUsd = totalBTC * btcPrice;

  const body = {
    price: btcPrice,
    priceSource: price !== null ? 'yahoo' : 'fallback',
    totalBTC,
    totalValueUsd,
    holders,
    entityCount: holders.length,
    timestamp: Date.now(),
  };

  l1Cache.set(cacheKey, { body, timestamp: Date.now() });

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
  });
}
