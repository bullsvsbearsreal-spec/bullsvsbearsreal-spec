import { binanceAPI } from './binance';
import { bybitAPI } from './bybit';
import { okxAPI } from './okx';
import { bitgetAPI } from './bitget';
import { hyperliquidAPI } from './hyperliquid';
import { dydxAPI } from './dydx';
import { TickerData, FundingRateData, OpenInterestData, AggregatedLiquidations } from './types';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

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

// Aggregated market data interface
export interface AggregatedMarketData {
  tickers: Map<string, TickerData & { exchange: string }>;
  fundingRates: FundingRateData[];
  openInterest: OpenInterestData[];
  totalVolume24h: number;
  totalOpenInterest: number;
  lastUpdate: number;
}

// Aggregate ticker data - use highest volume exchange price (via server-side API to avoid CORS)
export async function fetchAllTickers(): Promise<TickerData[]> {
  // Check cache first
  const cached = getCached<TickerData[]>('tickers');
  if (cached) return cached;

  try {
    // Use the server-side API route to avoid CORS issues
    const response = await fetch('/api/tickers');
    if (!response.ok) {
      throw new Error('Failed to fetch tickers');
    }
    const allTickers = await response.json();

    // Aggregate by symbol - use highest volume exchange as primary
    const symbolMap = new Map<string, TickerData & { exchange: string }>();
    allTickers.forEach((ticker: any) => {
      const existing = symbolMap.get(ticker.symbol);
      if (!existing || ticker.quoteVolume24h > existing.quoteVolume24h) {
        symbolMap.set(ticker.symbol, ticker);
      }
    });

    const result = Array.from(symbolMap.values()).sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
    setCache('tickers', result);
    return result;
  } catch (error) {
    console.error('Error fetching tickers:', error);
    // Fallback to direct API calls (will only work for CORS-enabled APIs like dYdX)
    const results = await Promise.allSettled([
      dydxAPI.getTickers().then(data => data.map(t => ({ ...t, exchange: t.exchange || 'dYdX' }))),
    ]);

    const allTickers: (TickerData & { exchange: string })[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allTickers.push(...(result.value as (TickerData & { exchange: string })[]));
      }
    });

    setCache('tickers', allTickers);
    return allTickers;
  }
}

// Fetch funding rates from all exchanges via API route (to avoid CORS)
export async function fetchAllFundingRates(): Promise<FundingRateData[]> {
  const cached = getCached<FundingRateData[]>('fundingRates');
  if (cached) return cached;

  try {
    // Use the server-side API route to avoid CORS issues
    const response = await fetch('/api/funding');
    if (!response.ok) {
      throw new Error('Failed to fetch funding rates');
    }
    const allRates = await response.json();
    setCache('fundingRates', allRates);
    return allRates;
  } catch (error) {
    console.error('Error fetching funding rates:', error);
    // Fallback to direct API calls (will only work for CORS-enabled APIs like dYdX)
    const results = await Promise.allSettled([
      dydxAPI.getFundingRates(),
    ]);

    const allRates: FundingRateData[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allRates.push(...result.value);
      }
    });

    setCache('fundingRates', allRates);
    return allRates;
  }
}

// Fetch open interest from all exchanges (via server-side API to avoid CORS)
export async function fetchAllOpenInterest(): Promise<OpenInterestData[]> {
  const cached = getCached<OpenInterestData[]>('openInterest');
  if (cached) return cached;

  try {
    // Use the server-side API route to avoid CORS issues
    const response = await fetch('/api/openinterest');
    if (!response.ok) {
      throw new Error('Failed to fetch open interest');
    }
    const allOI = await response.json();
    setCache('openInterest', allOI);
    return allOI;
  } catch (error) {
    console.error('Error fetching open interest:', error);
    // Fallback to direct API calls (will only work for CORS-enabled APIs like dYdX)
    const results = await Promise.allSettled([
      dydxAPI.getOpenInterest(),
    ]);

    const allOI: OpenInterestData[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allOI.push(...result.value);
      }
    });

    setCache('openInterest', allOI);
    return allOI;
  }
}

// Get aggregated open interest by symbol
export function aggregateOpenInterestBySymbol(oiData: OpenInterestData[]): Map<string, number> {
  const symbolOI = new Map<string, number>();

  oiData.forEach((item) => {
    const current = symbolOI.get(item.symbol) || 0;
    symbolOI.set(item.symbol, current + item.openInterestValue);
  });

  return symbolOI;
}

// Get aggregated open interest by exchange
export function aggregateOpenInterestByExchange(oiData: OpenInterestData[]): Map<string, number> {
  const exchangeOI = new Map<string, number>();

  oiData.forEach((item) => {
    const current = exchangeOI.get(item.exchange) || 0;
    exchangeOI.set(item.exchange, current + item.openInterestValue);
  });

  return exchangeOI;
}

// Calculate average funding rate by symbol across exchanges
export function calculateAverageFundingRates(fundingRates: FundingRateData[]): Map<string, { avgRate: number; exchanges: string[] }> {
  const symbolRates = new Map<string, { sum: number; count: number; exchanges: string[] }>();

  fundingRates.forEach((fr) => {
    const existing = symbolRates.get(fr.symbol) || { sum: 0, count: 0, exchanges: [] };
    symbolRates.set(fr.symbol, {
      sum: existing.sum + fr.fundingRate,
      count: existing.count + 1,
      exchanges: [...existing.exchanges, fr.exchange],
    });
  });

  const avgRates = new Map<string, { avgRate: number; exchanges: string[] }>();
  symbolRates.forEach((value, symbol) => {
    avgRates.set(symbol, {
      avgRate: value.sum / value.count,
      exchanges: value.exchanges,
    });
  });

  return avgRates;
}

// Get total market volume
export function calculateTotalVolume(tickers: TickerData[]): number {
  return tickers.reduce((sum, t) => sum + t.quoteVolume24h, 0);
}

// Fetch complete aggregated market data
export async function fetchAggregatedMarketData(): Promise<AggregatedMarketData> {
  const [tickers, fundingRates, openInterest] = await Promise.all([
    fetchAllTickers(),
    fetchAllFundingRates(),
    fetchAllOpenInterest(),
  ]);

  const tickerMap = new Map<string, TickerData & { exchange: string }>();
  tickers.forEach((t: any) => tickerMap.set(t.symbol, t));

  const totalVolume = calculateTotalVolume(tickers);
  const totalOI = openInterest.reduce((sum, oi) => sum + oi.openInterestValue, 0);

  return {
    tickers: tickerMap,
    fundingRates,
    openInterest,
    totalVolume24h: totalVolume,
    totalOpenInterest: totalOI,
    lastUpdate: Date.now(),
  };
}

// Clear cache utility
export function clearCache(): void {
  cache.clear();
}

// Get Long/Short Ratio (via server-side API to avoid CORS)
export async function fetchLongShortRatio(symbol: string = 'BTCUSDT'): Promise<{ longRatio: number; shortRatio: number }> {
  const cached = getCached<{ longRatio: number; shortRatio: number }>(`longShort_${symbol}`);
  if (cached) return cached;

  try {
    const response = await fetch(`/api/longshort?symbol=${symbol}`);
    if (!response.ok) {
      throw new Error('Failed to fetch long/short ratio');
    }
    const result = await response.json();
    setCache(`longShort_${symbol}`, result);
    return result;
  } catch (error) {
    console.error('Error fetching long/short ratio:', error);
    return { longRatio: 50, shortRatio: 50 }; // Default fallback
  }
}

// Get Top Gainers and Losers
export async function fetchTopMovers(): Promise<{ gainers: TickerData[]; losers: TickerData[] }> {
  const cached = getCached<{ gainers: TickerData[]; losers: TickerData[] }>('topMovers');
  if (cached) return cached;

  const tickers = await fetchAllTickers();
  const validTickers = tickers.filter(t =>
    t.priceChangePercent24h !== undefined &&
    !isNaN(t.priceChangePercent24h) &&
    isFinite(t.priceChangePercent24h)
  );
  const sorted = [...validTickers].sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);

  const result = {
    gainers: sorted.slice(0, 10),
    losers: sorted.slice(-10).reverse(),
  };

  setCache('topMovers', result);
  return result;
}

// Get OI Changes - coins with biggest OI changes (would need historical data)
export async function fetchOIChanges(): Promise<OpenInterestData[]> {
  const cached = getCached<OpenInterestData[]>('oiChanges');
  if (cached) return cached;

  const oiData = await fetchAllOpenInterest();
  // Sort by OI value (we don't have historical change data yet)
  const sorted = [...oiData].sort((a, b) => b.openInterestValue - a.openInterestValue);

  setCache('oiChanges', sorted.slice(0, 20));
  return sorted.slice(0, 20);
}

// Get aggregated market stats for the top stats bar
export async function fetchMarketStats(): Promise<{
  totalVolume24h: number;
  totalOpenInterest: number;
  btcLongShort: { longRatio: number; shortRatio: number };
  btcDominance: number;
}> {
  const cached = getCached<any>('marketStats');
  if (cached) return cached;

  const [tickers, oiData, longShort] = await Promise.all([
    fetchAllTickers(),
    fetchAllOpenInterest(),
    fetchLongShortRatio('BTCUSDT'),
  ]);

  const totalVolume = tickers.reduce((sum, t) => sum + (t.quoteVolume24h || 0), 0);
  const totalOI = oiData.reduce((sum, o) => sum + (o.openInterestValue || 0), 0);

  // Calculate BTC dominance from volume
  const btcTicker = tickers.find(t => t.symbol === 'BTC');
  const btcVolume = btcTicker?.quoteVolume24h || 0;
  const btcDominance = totalVolume > 0 ? (btcVolume / totalVolume) * 100 : 0;

  const result = {
    totalVolume24h: totalVolume,
    totalOpenInterest: totalOI,
    btcLongShort: longShort,
    btcDominance,
  };

  setCache('marketStats', result);
  return result;
}

// Get funding rate comparison across exchanges for arbitrage
export async function fetchFundingArbitrage(): Promise<Array<{
  symbol: string;
  exchanges: Array<{ exchange: string; rate: number }>;
  spread: number;
}>> {
  const cached = getCached<any>('fundingArbitrage');
  if (cached) return cached;

  const fundingRates = await fetchAllFundingRates();

  // Group by symbol
  const symbolMap = new Map<string, Array<{ exchange: string; rate: number }>>();
  fundingRates.forEach(fr => {
    const existing = symbolMap.get(fr.symbol) || [];
    existing.push({ exchange: fr.exchange, rate: fr.fundingRate });
    symbolMap.set(fr.symbol, existing);
  });

  // Calculate spread for each symbol (only those with 2+ exchanges)
  const arbitrageData = Array.from(symbolMap.entries())
    .filter(([_, exchanges]) => exchanges.length >= 2)
    .map(([symbol, exchanges]) => {
      const rates = exchanges.map(e => e.rate);
      const maxRate = Math.max(...rates);
      const minRate = Math.min(...rates);
      return {
        symbol,
        exchanges,
        spread: maxRate - minRate,
      };
    })
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 20);

  setCache('fundingArbitrage', arbitrageData);
  return arbitrageData;
}

// Export individual exchange APIs for direct access
export { binanceAPI, bybitAPI, okxAPI, bitgetAPI, hyperliquidAPI, dydxAPI };