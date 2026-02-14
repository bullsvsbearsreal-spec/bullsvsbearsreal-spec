/**
 * GET /api/dominance
 *
 * Proxies CoinGecko /api/v3/global for market dominance data.
 * Returns BTC/ETH dominance, total market cap, volume, active cryptos.
 * Cached for 5 minutes via edge cache.
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 }, // 5 min cache
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko returned ${res.status}` },
        { status: 502 },
      );
    }

    const json = await res.json();
    const d = json.data;

    if (!d) {
      return NextResponse.json({ error: 'Invalid response from CoinGecko' }, { status: 502 });
    }

    return NextResponse.json({
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
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch dominance data' },
      { status: 500 },
    );
  }
}
