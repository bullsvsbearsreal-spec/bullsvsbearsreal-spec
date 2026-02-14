export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const CMC_API = 'https://pro-api.coinmarketcap.com';
const CMC_API_KEY = process.env.CMC_API_KEY || '';

function cmcImage(cmcId: number, size: number = 64): string {
  return `https://s2.coinmarketcap.com/static/img/coins/${size}x${size}/${cmcId}.png`;
}

/* ─── In-memory cache for coin map (server-side) ─── */

let coinMapCache: { data: any[]; timestamp: number } | null = null;
const MAP_TTL = 2 * 60 * 60 * 1000; // 2 hours

async function getCoinMap(): Promise<any[]> {
  if (coinMapCache && Date.now() - coinMapCache.timestamp < MAP_TTL) {
    return coinMapCache.data;
  }

  const response = await fetch(
    `${CMC_API}/v1/cryptocurrency/map?listing_status=active&limit=5000&sort=cmc_rank`,
    {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) throw new Error(`CMC map ${response.status}`);
  const json = await response.json();
  const data = json.data || [];
  coinMapCache = { data, timestamp: Date.now() };
  return data;
}

/* ─── Handler ─── */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  if (!q || q.length < 1) {
    return Response.json({ results: [] });
  }

  try {
    const map = await getCoinMap();

    const matches = map
      .filter(
        (c: any) =>
          c.symbol?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.slug?.toLowerCase().includes(q),
      )
      .sort((a: any, b: any) => (a.rank || 9999) - (b.rank || 9999))
      .slice(0, 10)
      .map((c: any) => ({
        id: c.slug,
        name: c.name,
        api_symbol: c.symbol?.toLowerCase() || '',
        symbol: c.symbol || '',
        market_cap_rank: c.rank || null,
        thumb: cmcImage(c.id, 64),
        large: cmcImage(c.id, 128),
      }));

    return Response.json({ results: matches });
  } catch (err) {
    console.error('Coin search error:', err);
    return Response.json(
      { results: [], error: err instanceof Error ? err.message : 'Search failed' },
      { status: 502 },
    );
  }
}
