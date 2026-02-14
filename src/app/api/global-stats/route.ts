import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const CMC_API_KEY = process.env.CMC_API_KEY || '';

export async function GET() {
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

    if (!res.ok) throw new Error(`CMC global failed: ${res.status}`);

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

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Global stats API error:', error);
    return NextResponse.json(null, { status: 502 });
  }
}
