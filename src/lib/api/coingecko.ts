// CoinMarketCap API integration for coin data
// Replaces CoinGecko — same exported interfaces for backwards compatibility

const CMC_API = 'https://pro-api.coinmarketcap.com';
const CMC_API_KEY = process.env.CMC_API_KEY || '';

const cmcHeaders: Record<string, string> = {
  'X-CMC_PRO_API_KEY': CMC_API_KEY,
  'Accept': 'application/json',
};

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_in_7d?: {
    price: number[];
  };
}

export interface CoinSearchResult {
  id: string;
  name: string;
  api_symbol: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
  large: string;
}

export interface TrendingCoin {
  item: {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    small: string;
    large: string;
    slug: string;
    price_btc: number;
    score: number;
    data: {
      price: number;
      price_change_percentage_24h: {
        usd: number;
      };
      market_cap: string;
      total_volume: string;
      sparkline: string;
    };
  };
}

// Cache with configurable TTLs
const cache = new Map<string, { data: any; timestamp: number }>();

function getCached<T>(key: string, ttl: number): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Cache TTLs (aggressive to stay under 333 calls/day)
const TTL = {
  SEARCH_MAP: 2 * 60 * 60 * 1000, // 2 hours
  COIN_DATA: 10 * 60 * 1000,       // 10 minutes
  TOP_COINS: 10 * 60 * 1000,       // 10 minutes
  GLOBAL: 10 * 60 * 1000,          // 10 minutes
  TRENDING: 30 * 60 * 1000,        // 30 minutes
};

// Helper: CMC coin image URL
function cmcImage(cmcId: number, size: number = 128): string {
  return `https://s2.coinmarketcap.com/static/img/coins/${size}x${size}/${cmcId}.png`;
}

// Convert CMC listing to CoinData interface
function cmcToCoinData(coin: any): CoinData {
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
    high_24h: 0, // CMC doesn't provide 24h high/low in listings
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
    sparkline_in_7d: undefined, // CMC doesn't provide sparklines
  };
}

// Coin map cache for search (id, name, symbol, slug, rank)
let coinMapCache: { data: any[]; timestamp: number } | null = null;

async function getCoinMap(): Promise<any[]> {
  if (coinMapCache && Date.now() - coinMapCache.timestamp < TTL.SEARCH_MAP) {
    return coinMapCache.data;
  }

  try {
    const response = await fetch(
      `${CMC_API}/v1/cryptocurrency/map?listing_status=active&limit=5000&sort=cmc_rank`,
      { headers: cmcHeaders, signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`CMC map failed: ${response.status}`);
    const json = await response.json();
    const data = json.data || [];
    coinMapCache = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    console.error('CMC map error:', error);
    return coinMapCache?.data || [];
  }
}

// Search coins by query — uses cached coin map, filters client-side
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  if (!query || query.length < 1) return [];

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached<CoinSearchResult[]>(cacheKey, 60000);
  if (cached) return cached;

  try {
    const map = await getCoinMap();
    const q = query.toLowerCase();
    const matches = map
      .filter((c: any) =>
        c.symbol?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q)
      )
      .sort((a: any, b: any) => (a.rank || 9999) - (b.rank || 9999))
      .slice(0, 10)
      .map((c: any): CoinSearchResult => ({
        id: c.slug,
        name: c.name,
        api_symbol: c.symbol?.toLowerCase() || '',
        symbol: c.symbol || '',
        market_cap_rank: c.rank || null,
        thumb: cmcImage(c.id, 64),
        large: cmcImage(c.id, 128),
      }));

    setCache(cacheKey, matches);
    return matches;
  } catch (error) {
    console.error('CMC search error:', error);
    return [];
  }
}

// Get top coins by market cap
export async function getTopCoins(limit: number = 100): Promise<CoinData[]> {
  const cacheKey = `top:${limit}`;
  const cached = getCached<CoinData[]>(cacheKey, TTL.TOP_COINS);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CMC_API}/v1/cryptocurrency/listings/latest?limit=${limit}&sort=market_cap&convert=USD`,
      { headers: cmcHeaders, signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`CMC listings failed: ${response.status}`);
    const json = await response.json();
    const coins = (json.data || []).map(cmcToCoinData);
    setCache(cacheKey, coins);
    return coins;
  } catch (error) {
    console.error('CMC top coins error:', error);
    return [];
  }
}

// Get specific coin data by slug (e.g., "bitcoin", "ethereum")
export async function getCoinData(coinId: string): Promise<CoinData | null> {
  const cacheKey = `coin:${coinId}`;
  const cached = getCached<CoinData>(cacheKey, TTL.COIN_DATA);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CMC_API}/v2/cryptocurrency/quotes/latest?slug=${coinId}&convert=USD`,
      { headers: cmcHeaders, signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`CMC coin data failed: ${response.status}`);
    const json = await response.json();

    // CMC returns { data: { "1": {...} } } keyed by CMC ID
    const entries = Object.values(json.data || {});
    if (entries.length > 0) {
      const coinData = cmcToCoinData(entries[0]);
      setCache(cacheKey, coinData);
      return coinData;
    }
    return null;
  } catch (error) {
    console.error('CMC coin data error:', error);
    return null;
  }
}

// Get trending coins (most visited on CMC)
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const cacheKey = 'trending';
  const cached = getCached<TrendingCoin[]>(cacheKey, TTL.TRENDING);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CMC_API}/v1/cryptocurrency/trending/most-visited?limit=10&convert=USD`,
      { headers: cmcHeaders, signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`CMC trending failed: ${response.status}`);
    const json = await response.json();

    const trending: TrendingCoin[] = (json.data || []).map((c: any, i: number) => {
      const q = c.quote?.USD || {};
      return {
        item: {
          id: c.slug,
          coin_id: c.id,
          name: c.name,
          symbol: c.symbol,
          market_cap_rank: c.cmc_rank || 0,
          thumb: cmcImage(c.id, 64),
          small: cmcImage(c.id, 64),
          large: cmcImage(c.id, 128),
          slug: c.slug,
          price_btc: 0,
          score: i,
          data: {
            price: q.price || 0,
            price_change_percentage_24h: { usd: q.percent_change_24h || 0 },
            market_cap: String(q.market_cap || 0),
            total_volume: String(q.volume_24h || 0),
            sparkline: '',
          },
        },
      };
    });

    setCache(cacheKey, trending);
    return trending;
  } catch (error) {
    console.error('CMC trending error:', error);
    return [];
  }
}

// Get global market data — returns format compatible with old CoinGecko shape
export async function getGlobalData(): Promise<any> {
  const cacheKey = 'global';
  const cached = getCached<any>(cacheKey, TTL.GLOBAL);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CMC_API}/v1/global-metrics/quotes/latest?convert=USD`,
      { headers: cmcHeaders, signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`CMC global failed: ${response.status}`);
    const json = await response.json();
    const d = json.data || {};
    const q = d.quote?.USD || {};

    // Return in CoinGecko-compatible shape so aggregator.ts doesn't break
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

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('CMC global data error:', error);
    return null;
  }
}

// Format large numbers
export function formatNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

// Format price with appropriate decimals
// Handles very small prices like PEPE, SHIB, BONK, MOG
export function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  if (price >= 0.00000001) return `$${price.toFixed(10)}`;
  return `$${price.toExponential(4)}`;
}

// Format percentage
export function formatPercent(percent: number | undefined): string {
  if (percent === undefined || percent === null) return '0.00%';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}
