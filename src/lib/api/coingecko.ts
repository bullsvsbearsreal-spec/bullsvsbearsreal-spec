// CoinMarketCap API integration for coin data
// All CMC calls go through server-side /api/* proxies to avoid CORS

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

// Client-side cache with configurable TTLs
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

const TTL = {
  COIN_DATA: 10 * 60 * 1000,  // 10 minutes
  GLOBAL: 10 * 60 * 1000,     // 10 minutes
};

// Get specific coin data by slug (e.g., "bitcoin", "ethereum")
export async function getCoinData(coinId: string): Promise<CoinData | null> {
  const cacheKey = `coin:${coinId}`;
  const cached = getCached<CoinData>(cacheKey, TTL.COIN_DATA);
  if (cached) return cached;

  try {
    const response = await fetch(
      `/api/coin-data?slug=${encodeURIComponent(coinId)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`Coin data proxy failed: ${response.status}`);
    const coinData = await response.json();

    if (coinData) {
      setCache(cacheKey, coinData);
      return coinData;
    }
    return null;
  } catch (error) {
    console.error('Coin data error:', error);
    return null;
  }
}

// Get global market data
export async function getGlobalData(): Promise<any> {
  const cacheKey = 'global';
  const cached = getCached<any>(cacheKey, TTL.GLOBAL);
  if (cached) return cached;

  try {
    const response = await fetch('/api/global-stats', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Global stats proxy failed: ${response.status}`);
    const result = await response.json();

    if (result) {
      setCache(cacheKey, result);
    }
    return result;
  } catch (error) {
    console.error('Global data error:', error);
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
