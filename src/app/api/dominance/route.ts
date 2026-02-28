/**
 * GET /api/dominance
 *
 * Proxies CoinGecko /api/v3/global for market dominance data.
 * Returns BTC/ETH dominance, total market cap, volume, active cryptos.
 * Cached for 5 minutes via edge cache + DB cache fallback.
 */

import { NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const CACHE_KEY = 'dominance_global';
const CACHE_TTL = 600; // 10 min DB cache (longer than the 5 min edge cache)

export async function GET() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 }, // 5 min edge cache
    });

    if (!res.ok) {
      // CoinGecko down — try DB cache fallback
      if (isDBConfigured()) {
        const cached = await getCache(CACHE_KEY);
        if (cached) return NextResponse.json({ ...cached, cached: true });
      }
      return NextResponse.json(
        { error: `CoinGecko returned ${res.status}` },
        { status: 502 },
      );
    }

    const json = await res.json();
    const d = json.data;

    if (!d) {
      // Invalid response — try DB cache fallback
      if (isDBConfigured()) {
        const cached = await getCache(CACHE_KEY);
        if (cached) return NextResponse.json({ ...cached, cached: true });
      }
      return NextResponse.json({ error: 'Invalid response from CoinGecko' }, { status: 502 });
    }

    const result = {
      btcDominance: d.market_cap_percentage?.btc ?? null,
      ethDominance: d.market_cap_percentage?.eth ?? null,
      totalMarketCap: d.total_market_cap?.usd ?? null,
      totalVolume24h: d.total_volume?.usd ?? null,
      activeCryptos: d.active_cryptocurrencies ?? null,
      markets: d.markets ?? null,
      marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? null,
      updatedAt: d.updated_at ? d.updated_at * 1000 : Date.now(),
      // Top 10 market cap percentages
      dominanceBreakdown: d.market_cap_percentage ?? {},
    };

    // Store in DB cache for fallback
    if (isDBConfigured()) {
      setCache(CACHE_KEY, result, CACHE_TTL).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (e) {
    // Network error — try DB cache fallback
    if (isDBConfigured()) {
      const cached = await getCache(CACHE_KEY);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch dominance data' },
      { status: 500 },
    );
  }
}
