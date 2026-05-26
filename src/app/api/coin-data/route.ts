import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const CMC_API_KEY = process.env.CMC_API_KEY || '';

// L1 in-memory cache keyed on slug. CMC quotes change every ~5min and
// each call costs an API credit, so caching aggressively saves money
// AND latency. Map<slug, entry> avoids the single-slot trash bug when
// users browse multiple coin pages.
interface CoinCacheEntry { body: unknown; ts: number }
const coinCache = new Map<string, CoinCacheEntry>();
const COIN_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
    high_24h: null,
    low_24h: null,
    price_change_24h: q.price ? q.price * (q.percent_change_24h || 0) / 100 : 0,
    price_change_percentage_24h: q.percent_change_24h || 0,
    price_change_percentage_7d_in_currency: q.percent_change_7d || 0,
    price_change_percentage_30d_in_currency: q.percent_change_30d || 0,
    market_cap_change_24h: null,
    market_cap_change_percentage_24h: null,
    circulating_supply: coin.circulating_supply || 0,
    total_supply: coin.total_supply || null,
    max_supply: coin.max_supply || null,
    ath: null,
    ath_change_percentage: null,
    ath_date: null,
    atl: null,
    atl_change_percentage: null,
    atl_date: null,
    last_updated: coin.last_updated || q.last_updated || '',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  // `symbol` is a convenience alias — callers (like /position-copy-form
  // which only knows "BTC", not "bitcoin") shouldn't have to maintain
  // their own slug map. CMC's quotes endpoint accepts both query
  // params, so we just forward whichever was provided.
  const symbol = searchParams.get('symbol');

  if (!slug && !symbol) {
    return NextResponse.json(
      { error: 'Provide ?slug=bitcoin or ?symbol=BTC' },
      { status: 400 },
    );
  }

  // Cache by whichever identifier we have. slug and symbol can map to
  // different CMC IDs in edge cases (multiple coins share a symbol),
  // so keep them in distinct cache namespaces to avoid cross-pollution.
  const cacheKey = slug ? `slug:${slug}` : `symbol:${symbol!.toUpperCase()}`;

  // L1 cache hit
  const hit = coinCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < COIN_TTL_MS) {
    return NextResponse.json(hit.body, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  // CMC accepts EITHER `slug=bitcoin` OR `symbol=BTC` on the same
  // endpoint. Build the param we have.
  const cmcParam = slug
    ? `slug=${encodeURIComponent(slug)}`
    : `symbol=${encodeURIComponent(symbol!.toUpperCase())}`;

  try {
    const res = await fetchWithTimeout(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?${cmcParam}&convert=USD`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': CMC_API_KEY,
          Accept: 'application/json',
        },
      },
    );

    if (!res.ok) throw new Error(`CMC coin data failed: ${res.status}`);
    const json = await res.json();

    // CMC's `data` field shape differs by query type. For ?symbol=BTC
    // it returns `{ BTC: [{ ... }] }` (an array per symbol because some
    // symbols are ambiguous). For ?slug=bitcoin it returns
    // `{ "1": { ... } }` keyed by numeric CMC id. Flatten both.
    const raw = Object.values(json.data || {});
    const entries = raw.flatMap(v => Array.isArray(v) ? v : [v]);
    if (entries.length > 0) {
      const coinData = cmcToCoinData(entries[0]);
      coinCache.set(cacheKey, { body: coinData, ts: Date.now() });
      // Soft cap on cache size — drop oldest when over 500 slugs
      if (coinCache.size > 500) {
        const oldest = coinCache.keys().next().value;
        if (oldest) coinCache.delete(oldest);
      }
      return NextResponse.json(coinData, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    return NextResponse.json(null, { status: 404 });
  } catch (error) {
    console.error('Coin data API error:', error);
    return NextResponse.json(null, { status: 502 });
  }
}
