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

// Aggregate ticker data - use highest volume exchange price
export async function fetchAllTickers(): Promise<TickerData[]> {
  // Check cache first
  const cached = getCached<TickerData[]>('tickers');
  if (cached) return cached;

  const results = await Promise.allSettled([
    binanceAPI.getTickers().then(data => data.map(t => ({ ...t, exchange: 'Binance' }))),
    bybitAPI.getTickers().then(data => data.map(t => ({ ...t, exchange: 'Bybit' }))),
    okxAPI.getTickers().then(data => data.map(t => ({ ...t, exchange: 'OKX' }))),
    bitgetAPI.getTickers().then(data => data.map(t => ({ ...t, exchange: 'Bitget' }))),
    hyperliquidAPI.getTickers(),
    dydxAPI.getTickers(),
  ]);

  // Collect all successful results
  const allTickers: (TickerData & { exchange: string })[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allTickers.push(...result.value);
    }
  });

  // Aggregate by symbol - use highest volume exchange as primary
  const symbolMap = new Map<string, TickerData & { exchange: string }>();
  allTickers.forEach((ticker) => {
    const existing = symbolMap.get(ticker.symbol);
    if (!existing || ticker.quoteVolume24h > existing.quoteVolume24h) {
      symbolMap.set(ticker.symbol, ticker);
    }
  });

  const result = Array.from(symbolMap.values()).sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
  setCache('tickers', result);
  return result;
}

// Fetch funding rates from all exchanges
export async function fetchAllFundingRates(): Promise<FundingRateData[]> {
  const cached = getCached<FundingRateData[]>('fundingRates');
  if (cached) return cached;

  const results = await Promise.allSettled([
    binanceAPI.getFundingRates(),
    bybitAPI.getFundingRates(),
    okxAPI.getFundingRates(),
    bitgetAPI.getFundingRates(),
    hyperliquidAPI.getFundingRates(),
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

// Fetch open interest from all exchanges
export async function fetchAllOpenInterest(): Promise<OpenInterestData[]> {
  const cached = getCached<OpenInterestData[]>('openInterest');
  if (cached) return cached;

  const results = await Promise.allSettled([
    binanceAPI.getOpenInterest(),
    bybitAPI.getOpenInterest(),
    okxAPI.getOpenInterest(),
    bitgetAPI.getOpenInterest(),
    hyperliquidAPI.getOpenInterest(),
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

// Export individual exchange APIs for direct access
export { binanceAPI, bybitAPI, okxAPI, bitgetAPI, hyperliquidAPI, dydxAPI };