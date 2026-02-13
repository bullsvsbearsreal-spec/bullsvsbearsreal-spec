import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// L1: In-memory cache (instant, lost on cold start)
let cachedData: { gainers: any[]; losers: any[] } | null = null;
let allCoinsCache: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (budget: ~48 calls/day)

// Cache exchange symbols separately (refreshed every 5 min)
let exchangeSymbolsCache: Set<string> = new Set();
let exchangeSymbolsCacheTime = 0;
const EXCHANGE_SYMBOLS_TTL = 5 * 60 * 1000;

const CMC_API_KEY = process.env.CMC_API_KEY || '';
const DB_CACHE_KEY = 'top-movers';
const DB_CACHE_TTL = 1800; // 30 min

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode');
  const isHeatmap = mode === 'heatmap';

  // L1: In-memory
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    if (isHeatmap && allCoinsCache) {
      return NextResponse.json({ coins: allCoinsCache });
    }
    return NextResponse.json(cachedData);
  }

  // L2: DB cache
  if (isDBConfigured()) {
    try {
      if (isHeatmap) {
        const dbCoins = await getCache<any[]>('heatmap-coins');
        if (dbCoins) {
          allCoinsCache = dbCoins;
          cacheTime = Date.now();
          return NextResponse.json({ coins: dbCoins });
        }
      }
      const dbData = await getCache<typeof cachedData>(DB_CACHE_KEY);
      if (dbData) {
        cachedData = dbData;
        cacheTime = Date.now();
        if (isHeatmap) {
          // DB had top-movers but not heatmap — fall through to fetch
        } else {
          return NextResponse.json(cachedData);
        }
      }
    } catch { /* proceed to fetch */ }
  }

  try {
    // Fetch CMC top 500 and InfoHub exchange symbols in parallel
    const origin = request.nextUrl.origin;
    const [cmcRes, exchangeSymbols] = await Promise.all([
      fetch(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=500&sort=market_cap&convert=USD',
        {
          headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      ),
      getExchangeSymbols(origin),
    ]);

    if (!cmcRes.ok) throw new Error(`CMC failed: ${cmcRes.status}`);
    const json = await cmcRes.json();
    const coins = (json.data || [])
      .filter((c: any) =>
        c.quote?.USD?.percent_change_24h != null &&
        (exchangeSymbols.size === 0 || exchangeSymbols.has(c.symbol?.toUpperCase()))
      )
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
    allCoinsCache = sorted;
    cacheTime = Date.now();

    // Also cache the full top-500 symbol list for getTop500Symbols() to reuse
    if (isDBConfigured()) {
      const allSymbols = (json.data || []).map((c: any) => c.symbol?.toUpperCase()).filter(Boolean);
      setCache(DB_CACHE_KEY, cachedData, DB_CACHE_TTL).catch(() => {});
      setCache('top500-symbols', allSymbols, DB_CACHE_TTL).catch(() => {});
      setCache('heatmap-coins', sorted, DB_CACHE_TTL).catch(() => {});
    }

    if (isHeatmap) {
      return NextResponse.json({ coins: sorted });
    }
    return NextResponse.json(cachedData);
  } catch (error) {
    console.error('Top movers CMC error:', error);
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ gainers: [], losers: [] });
  }
}

// Fetch unique symbols from InfoHub exchange tickers
async function getExchangeSymbols(origin: string): Promise<Set<string>> {
  if (exchangeSymbolsCache.size > 0 && Date.now() - exchangeSymbolsCacheTime < EXCHANGE_SYMBOLS_TTL) {
    return exchangeSymbolsCache;
  }
  try {
    const res = await fetch(`${origin}/api/tickers`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return exchangeSymbolsCache;
    const tickers: any[] = await res.json();
    const symbols = new Set<string>(
      tickers.map((t: any) => (t.symbol || '').toUpperCase()).filter(Boolean)
    );
    if (symbols.size > 50) {
      exchangeSymbolsCache = symbols;
      exchangeSymbolsCacheTime = Date.now();
    }
    return symbols;
  } catch {
    return exchangeSymbolsCache;
  }
}
