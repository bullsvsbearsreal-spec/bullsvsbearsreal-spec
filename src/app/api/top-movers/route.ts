import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Cache for 10 minutes
let cachedData: { gainers: any[]; losers: any[] } | null = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (budget: ~48 calls/day)

const CMC_API_KEY = process.env.CMC_API_KEY || '';

export async function GET() {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedData);
  }

  try {
    const res = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=500&sort=market_cap&convert=USD',
      {
        headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) throw new Error(`CMC failed: ${res.status}`);
    const json = await res.json();
    const coins = (json.data || [])
      .filter((c: any) => c.quote?.USD?.percent_change_24h != null && c.quote?.USD?.market_cap > 40_000_000)
      .map((c: any) => ({
        symbol: c.symbol,
        name: c.name,
        slug: c.slug,
        cmcId: c.id,
        price: c.quote.USD.price,
        change24h: c.quote.USD.percent_change_24h,
        marketCap: c.quote.USD.market_cap,
        volume24h: c.quote.USD.volume_24h,
      }));

    const sorted = [...coins].sort((a: any, b: any) => b.change24h - a.change24h);

    cachedData = {
      gainers: sorted.slice(0, 10),
      losers: sorted.slice(-10).reverse(),
    };
    cacheTime = Date.now();
    return NextResponse.json(cachedData);
  } catch (error) {
    console.error('Top movers CMC error:', error);
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ gainers: [], losers: [] });
  }
}
