import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const CMC_API_KEY = process.env.CMC_API_KEY || '';

function cmcImage(cmcId: number, size: number = 128): string {
  return `https://s2.coinmarketcap.com/static/img/coins/${size}x${size}/${cmcId}.png`;
}

function cmcToCoinData(coin: any) {
  const q = coin.quote?.USD || {};
  const cmcId = coin.id;
  return {
    id: coin.slug,
    symbol: coin.symbol?.toLowerCase() || '',
    name: coin.name || '',
    image: cmcImage(cmcId),
    current_price: q.price || 0,
    market_cap: q.market_cap || 0,
    market_cap_rank: coin.cmc_rank || 0,
    fully_diluted_valuation: q.fully_diluted_market_cap || null,
    total_volume: q.volume_24h || 0,
    high_24h: 0,
    low_24h: 0,
    price_change_24h: q.price ? q.price * (q.percent_change_24h || 0) / 100 : 0,
    price_change_percentage_24h: q.percent_change_24h || 0,
    price_change_percentage_7d_in_currency: q.percent_change_7d || 0,
    price_change_percentage_30d_in_currency: q.percent_change_30d || 0,
    market_cap_change_24h: 0,
    market_cap_change_percentage_24h: 0,
    circulating_supply: coin.circulating_supply || 0,
    total_supply: coin.total_supply || null,
    max_supply: coin.max_supply || null,
    ath: 0,
    ath_change_percentage: 0,
    ath_date: '',
    atl: 0,
    atl_change_percentage: 0,
    atl_date: '',
    last_updated: coin.last_updated || q.last_updated || '',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json(null, { status: 400 });
  }

  try {
    const res = await fetchWithTimeout(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?slug=${encodeURIComponent(slug)}&convert=USD`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': CMC_API_KEY,
          Accept: 'application/json',
        },
      },
    );

    if (!res.ok) throw new Error(`CMC coin data failed: ${res.status}`);
    const json = await res.json();

    const entries = Object.values(json.data || {});
    if (entries.length > 0) {
      const coinData = cmcToCoinData(entries[0]);
      return NextResponse.json(coinData, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      });
    }

    return NextResponse.json(null, { status: 404 });
  } catch (error) {
    console.error('Coin data API error:', error);
    return NextResponse.json(null, { status: 502 });
  }
}
