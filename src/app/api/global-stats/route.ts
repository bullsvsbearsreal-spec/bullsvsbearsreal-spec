import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const CMC_API_KEY = process.env.CMC_API_KEY || '';

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' };
const DB_CACHE_KEY = 'global_stats';
const DB_CACHE_TTL = 600; // 10 min DB cache

// In-memory fallback so we never return 502 after one success
let lastGood: any = null;

export async function GET() {
  // Try CMC first (if key exists)
  if (CMC_API_KEY) {
    try {
      const res = await fetchWithTimeout(
        'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=USD',
        {
          headers: {
            'X-CMC_PRO_API_KEY': CMC_API_KEY,
            Accept: 'application/json',
          },
        },
      );

      if (res.ok) {
        const json = await res.json();
        const d = json.data || {};
        const q = d.quote?.USD || {};

        const result = {
          total_market_cap: { usd: q.total_market_cap || 0 },
          total_volume: { usd: q.total_volume_24h || 0 },
          market_cap_percentage: {
            btc: d.btc_dominance || 0,
            eth: d.eth_dominance || 0,
          },
          market_cap_change_percentage_24h_usd: q.total_market_cap_yesterday_percentage_change || 0,
          active_cryptocurrencies: d.active_cryptocurrencies || 0,
        };

        lastGood = result;
        if (isDBConfigured()) setCache(DB_CACHE_KEY, result, DB_CACHE_TTL).catch(() => {});
        return NextResponse.json(result, { headers: CACHE_HEADERS });
      }
    } catch {
      // Fall through to CoinGecko
    }
  }

  // Fallback: CoinGecko free API (no key needed)
  try {
    const res = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/global',
      { headers: { Accept: 'application/json' } },
      8000,
    );

    if (res.ok) {
      const json = await res.json();
      const d = json.data || {};

      const result = {
        total_market_cap: { usd: d.total_market_cap?.usd || 0 },
        total_volume: { usd: d.total_volume?.usd || 0 },
        market_cap_percentage: {
          btc: d.market_cap_percentage?.btc || 0,
          eth: d.market_cap_percentage?.eth || 0,
        },
        market_cap_change_percentage_24h_usd: d.market_cap_change_percentage_24h_usd || 0,
        active_cryptocurrencies: d.active_cryptocurrencies || 0,
      };

      lastGood = result;
      if (isDBConfigured()) setCache(DB_CACHE_KEY, result, DB_CACHE_TTL).catch(() => {});
      return NextResponse.json(result, { headers: CACHE_HEADERS });
    }
  } catch {
    // Fall through to cached/static fallback
  }

  // Return last known good data if we have it (L1: memory)
  if (lastGood) {
    return NextResponse.json(lastGood, { headers: CACHE_HEADERS });
  }

  // L2: DB cache fallback (survives cold starts)
  if (isDBConfigured()) {
    const cached = await getCache(DB_CACHE_KEY);
    if (cached) return NextResponse.json({ ...cached, cached: true }, { headers: CACHE_HEADERS });
  }

  // All sources exhausted — signal unavailable instead of fake zeros
  return NextResponse.json({
    total_market_cap: { usd: 0 },
    total_volume: { usd: 0 },
    market_cap_percentage: { btc: 0, eth: 0 },
    market_cap_change_percentage_24h_usd: 0,
    active_cryptocurrencies: 0,
    unavailable: true,
  }, { headers: CACHE_HEADERS });
}
