import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { fetchWithTimeout } from '../_shared/fetch';
import { tickerFetchers } from '../tickers/exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
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

// CF edge-cache header used on every response path. CMC top-500 data only
// changes at 5-minute granularity, so a 90s edge cache is plenty fresh and
// massively reduces origin load for global users.
const PUBLIC_CACHE = 'public, s-maxage=90, stale-while-revalidate=300';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode');
  const isHeatmap = mode === 'heatmap';

  // L1: In-memory
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    if (isHeatmap) {
      if (allCoinsCache) {
        return NextResponse.json({ coins: allCoinsCache }, {
          headers: { 'X-Cache': 'L1', 'Cache-Control': PUBLIC_CACHE },
        });
      }
      // Reconstruct heatmap from gainers+losers if allCoinsCache missing
      const combined = [...(cachedData.gainers || []), ...(cachedData.losers || [])];
      if (combined.length > 0) {
        return NextResponse.json({ coins: combined }, {
          headers: { 'X-Cache': 'L1', 'Cache-Control': PUBLIC_CACHE },
        });
      }
    }
    return NextResponse.json(cachedData, {
      headers: { 'X-Cache': 'L1', 'Cache-Control': PUBLIC_CACHE },
    });
  }

  // L2: DB cache
  if (isDBConfigured()) {
    try {
      if (isHeatmap) {
        const dbCoins = await getCache<any[]>('heatmap-coins');
        if (dbCoins) {
          allCoinsCache = dbCoins;
          cacheTime = Date.now();
          return NextResponse.json({ coins: dbCoins }, {
            headers: { 'X-Cache': 'L2', 'Cache-Control': PUBLIC_CACHE },
          });
        }
      }
      const dbData = await getCache<typeof cachedData>(DB_CACHE_KEY);
      if (dbData) {
        cachedData = dbData;
        cacheTime = Date.now();
        if (isHeatmap) {
          // DB had top-movers but not heatmap — fall through to fetch
        } else {
          return NextResponse.json(cachedData, {
            headers: { 'X-Cache': 'L2', 'Cache-Control': PUBLIC_CACHE },
          });
        }
      }
    } catch { /* proceed to fetch */ }
  }

  try {
    // Fetch CMC top 500 and InfoHub exchange symbols in parallel
    const [cmcRes, exchangeSymbols] = await Promise.all([
      fetch(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=500&sort=market_cap&convert=USD',
        {
          headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      ),
      getExchangeSymbols(),
    ]);

    if (!cmcRes.ok) throw new Error(`CMC failed: ${cmcRes.status}`);
    const json = await cmcRes.json();
    const coins = (json.data || [])
      .filter((c: any) => {
        const change = c.quote?.USD?.percent_change_24h;
        const vol = c.quote?.USD?.volume_24h || 0;
        const mcap = c.quote?.USD?.market_cap || 0;
        const sym = c.symbol || '';
        // Quality filters: must have change, volume, market cap, ASCII symbol, reasonable change %
        return (
          change != null &&
          vol >= 500_000 &&           // Min $500K volume (skip dead/fake coins)
          mcap >= 10_000_000 &&       // Min $10M market cap
          Math.abs(change) <= 500 &&  // Max ±500% change (skip pump/dump & data errors)
          /^[A-Z0-9]+$/.test(sym) &&  // ASCII-only symbols (skip Chinese/emoji names)
          (exchangeSymbols.size === 0 || exchangeSymbols.has(sym.toUpperCase()))
        );
      })
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

    const fresh = {
      gainers: sorted.slice(0, 10),
      losers: sorted.slice(-10).reverse(),
    };

    // Only pin caches when we actually got movers. Was: cached
    // `{gainers: [], losers: []}` for the L1 TTL when CMC returned 200
    // with empty data (filter rejected everything for some reason — quality
    // filters at line 100-114 are strict). DB cache + heatmap-coins would
    // then both be empty for the cache duration.
    if (sorted.length > 0) {
      cachedData = fresh;
      allCoinsCache = sorted;
      cacheTime = Date.now();

      if (isDBConfigured()) {
        const allSymbols = (json.data || []).map((c: any) => c.symbol?.toUpperCase()).filter(Boolean);
        setCache(DB_CACHE_KEY, fresh, DB_CACHE_TTL).catch(e => console.warn('[top-movers] cache write failed:', e));
        setCache('top500-symbols', allSymbols, DB_CACHE_TTL).catch(e => console.warn('[top-movers] cache symbols failed:', e));
        setCache('heatmap-coins', sorted, DB_CACHE_TTL).catch(e => console.warn('[top-movers] cache heatmap failed:', e));
      }
    }

    const cacheHeaders = {
      'X-Cache': 'MISS',
      'Cache-Control': sorted.length > 0 ? PUBLIC_CACHE : 'no-store',
    };
    if (isHeatmap) {
      return NextResponse.json({ coins: sorted }, { headers: cacheHeaders });
    }
    return NextResponse.json(fresh, { headers: cacheHeaders });
  } catch (error) {
    console.warn('Top movers CMC failed, trying CoinGecko fallback:', error instanceof Error ? error.message : error);

    // Fallback: try CoinGecko if CMC fails
    try {
      const cgRes = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false&price_change_percentage=24h',
        { signal: AbortSignal.timeout(10000) }
      );
      if (cgRes.ok) {
        const cgData: any[] = await cgRes.json();
        const coins = cgData
          .filter((c: any) => c.price_change_percentage_24h_in_currency != null || c.price_change_percentage_24h != null)
          .map((c: any) => ({
            symbol: (c.symbol || '').toUpperCase(),
            name: c.name,
            slug: c.id,
            cmcId: 0,
            price: c.current_price || 0,
            change24h: c.price_change_percentage_24h || 0,
            marketCap: c.market_cap || 0,
            volume24h: c.total_volume || 0,
          }))
          .filter((c: any) => /^[A-Z0-9]+$/.test(c.symbol) && Math.abs(c.change24h) <= 500);

        const sorted = [...coins].sort((a: any, b: any) => b.change24h - a.change24h);
        const fresh = { gainers: sorted.slice(0, 10), losers: sorted.slice(-10).reverse() };

        // Same gate as the CMC path above — don't pin empty results.
        if (sorted.length > 0) {
          cachedData = fresh;
          allCoinsCache = sorted;
          cacheTime = Date.now();
        }

        const headers = {
          'X-Cache': 'MISS-CG',
          'Cache-Control': sorted.length > 0 ? PUBLIC_CACHE : 'no-store',
        };
        if (isHeatmap) return NextResponse.json({ coins: sorted }, { headers });
        return NextResponse.json(fresh, { headers });
      }
    } catch (cgErr) {
      console.error('Top movers CoinGecko fallback also failed:', cgErr);
    }

    // Final fallback: use cached data if available — short edge cache so the
    // world doesn't freeze on stale data when upstreams come back.
    const STALE = { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=120' };
    if (isHeatmap && allCoinsCache) {
      return NextResponse.json({ coins: allCoinsCache }, { headers: STALE });
    }
    if (cachedData) {
      if (isHeatmap) {
        return NextResponse.json(
          { coins: [...(cachedData.gainers || []), ...(cachedData.losers || [])] },
          { headers: STALE },
        );
      }
      return NextResponse.json(cachedData, { headers: STALE });
    }
    // Truly empty — don't cache the empty body.
    const NOCACHE = { 'Cache-Control': 'no-store' };
    if (isHeatmap) return NextResponse.json({ coins: [] }, { headers: NOCACHE });
    return NextResponse.json({ gainers: [], losers: [] }, { headers: NOCACHE });
  }
}

// Fetch unique symbols from InfoHub exchange tickers
async function getExchangeSymbols(): Promise<Set<string>> {
  if (exchangeSymbolsCache.size > 0 && Date.now() - exchangeSymbolsCacheTime < EXCHANGE_SYMBOLS_TTL) {
    return exchangeSymbolsCache;
  }
  try {
    const { data: tickers } = await fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout);
    const symbols = new Set<string>(
      (tickers as any[]).map((t: any) => (t.symbol || '').toUpperCase()).filter(Boolean)
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
