// CoinGecko API integration for coin data
// Free API - no key required for basic endpoints

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

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

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Search coins by query
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  if (!query || query.length < 1) return [];

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached<CoinSearchResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${COINGECKO_API}/search?query=${encodeURIComponent(query)}`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) throw new Error('Search failed');

    const data = await response.json();
    const results = data.coins?.slice(0, 10) || [];
    setCache(cacheKey, results);
    return results;
  } catch (error) {
    console.error('CoinGecko search error:', error);
    return [];
  }
}

// Get top coins by market cap
export async function getTopCoins(limit: number = 100): Promise<CoinData[]> {
  const cacheKey = `top:${limit}`;
  const cached = getCached<CoinData[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=7d,30d`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) throw new Error('Failed to fetch coins');

    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('CoinGecko top coins error:', error);
    return [];
  }
}

// Get specific coin data by ID
export async function getCoinData(coinId: string): Promise<CoinData | null> {
  const cacheKey = `coin:${coinId}`;
  const cached = getCached<CoinData>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=true&price_change_percentage=7d,30d`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) throw new Error('Failed to fetch coin');

    const data = await response.json();
    if (data && data.length > 0) {
      setCache(cacheKey, data[0]);
      return data[0];
    }
    return null;
  } catch (error) {
    console.error('CoinGecko coin data error:', error);
    return null;
  }
}

// Get trending coins
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const cacheKey = 'trending';
  const cached = getCached<TrendingCoin[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${COINGECKO_API}/search/trending`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) throw new Error('Failed to fetch trending');

    const data = await response.json();
    const trending = data.coins || [];
    setCache(cacheKey, trending);
    return trending;
  } catch (error) {
    console.error('CoinGecko trending error:', error);
    return [];
  }
}

// Get global market data
export async function getGlobalData(): Promise<any> {
  const cacheKey = 'global';
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${COINGECKO_API}/global`,
      { next: { revalidate: 120 } }
    );

    if (!response.ok) throw new Error('Failed to fetch global data');

    const data = await response.json();
    setCache(cacheKey, data.data);
    return data.data;
  } catch (error) {
    console.error('CoinGecko global data error:', error);
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
  // For extremely small numbers - use scientific notation
  return `$${price.toExponential(4)}`;
}

// Format percentage
export function formatPercent(percent: number | undefined): string {
  if (percent === undefined || percent === null) return '0.00%';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}
