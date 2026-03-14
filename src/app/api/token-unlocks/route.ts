import { NextResponse } from 'next/server';
import { fetchAllUnlocks, getAllCoinIds, setLivePrices, getTokenStaticPrice } from '@/lib/api/tokenunlocks';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/* ── CoinGecko price cache ─────────────────────────────────────────── */
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let priceCache: { prices: Record<string, number>; timestamp: number } | null = null;

async function fetchLivePrices(): Promise<{ prices: Record<string, number>; source: 'coingecko' | 'static' }> {
  // Return cached if fresh
  if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_TTL) {
    return { prices: priceCache.prices, source: 'coingecko' };
  }

  try {
    const coinIds = getAllCoinIds();
    // CoinGecko free API: max 250 ids per request
    const idsParam = coinIds.join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

    const data: Record<string, { usd: number }> = await res.json();

    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      if (val?.usd) prices[id] = val.usd;
    }

    // Fill missing with static fallbacks
    for (const coinId of coinIds) {
      if (!prices[coinId]) {
        const staticPrice = getTokenStaticPrice(coinId);
        if (staticPrice) prices[coinId] = staticPrice;
      }
    }

    priceCache = { prices, timestamp: Date.now() };
    return { prices, source: 'coingecko' };
  } catch (err) {
    console.error('CoinGecko price fetch failed, using static prices:', err);

    // Build fallback from static prices
    const prices: Record<string, number> = {};
    for (const coinId of getAllCoinIds()) {
      const staticPrice = getTokenStaticPrice(coinId);
      if (staticPrice) prices[coinId] = staticPrice;
    }
    return { prices, source: 'static' };
  }
}

/* ── Handler ───────────────────────────────────────────────────────── */

export async function GET() {
  // 1. Fetch live prices from CoinGecko
  const { prices, source: priceSource } = await fetchLivePrices();

  // 2. Inject live prices into the unlock data
  setLivePrices(prices);

  // 3. Build unlock list with live-price-adjusted values
  const unlocks = await fetchAllUnlocks();

  return NextResponse.json({
    unlocks,
    meta: {
      total: unlocks.length,
      timestamp: Date.now(),
      priceSource,
      tokens: getAllCoinIds().length,
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
