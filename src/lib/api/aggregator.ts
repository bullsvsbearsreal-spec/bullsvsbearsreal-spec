import { dydxAPI } from './dydx';
import { getGlobalData } from './coingecko';
import { TickerData, FundingRateData, OpenInterestData, AggregatedLiquidations } from './types';
import { isValidNumber } from '@/lib/utils/format';

// Simple in-memory cache with per-key TTL
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const DEFAULT_TTL = 10000; // 10 seconds
const FUNDING_TTL = 120000; // 2 minutes — funding rates change every 1-8h, no need to re-fetch on tab switch

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any, ttl: number = DEFAULT_TTL): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
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
    const json = await response.json();
    // API returns { data, health, meta } — extract data array
    const allTickers = Array.isArray(json) ? json : (json.data ?? json);

    // Cache server-computed total volume (sum across all exchanges, before dedup)
    if (json.meta?.totalVolume) {
      setCache('serverTotalVolume', json.meta.totalVolume, 60_000);
    }

    // Build exchange count per symbol from RAW data (before dedup) for ghost-pair filtering
    const exchangeCountMap = new Map<string, Set<string>>();
    allTickers.forEach((ticker: any) => {
      if (ticker.symbol && ticker.exchange) {
        const set = exchangeCountMap.get(ticker.symbol) || new Set();
        set.add(ticker.exchange);
        exchangeCountMap.set(ticker.symbol, set);
      }
    });
    // Cache exchange counts — used by fetchTopMovers to filter ghost pairs
    const exchangeCounts = new Map<string, number>();
    exchangeCountMap.forEach((exchanges, sym) => exchangeCounts.set(sym, exchanges.size));
    setCache('tickerExchangeCounts', exchangeCounts, 60_000);

    // Aggregate by symbol - use highest volume exchange as primary
    // Cap per-ticker volume at $100B to filter exchanges with inflated numbers (Gate.io reports trillions)
    const MAX_SANE_VOLUME = 100_000_000_000;
    const symbolMap = new Map<string, TickerData & { exchange: string }>();
    allTickers.forEach((ticker: any) => {
      const vol = ticker.quoteVolume24h || 0;
      if (vol > MAX_SANE_VOLUME) return; // Skip exchanges with inflated volume data
      const existing = symbolMap.get(ticker.symbol);
      const hasChange = ticker.priceChangePercent24h != null && ticker.priceChangePercent24h !== 0;
      const existingHasChange = existing?.priceChangePercent24h != null && existing.priceChangePercent24h !== 0;
      // Prefer tickers with real price change data; if both have it (or neither), use highest volume
      if (!existing || (hasChange && !existingHasChange) || (hasChange === existingHasChange && vol > (existing.quoteVolume24h || 0))) {
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

// Asset class type for funding rate queries
export type AssetClassFilter = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'all';

// Fetch funding rates from all exchanges via API route (to avoid CORS)
export async function fetchAllFundingRates(assetClass: AssetClassFilter = 'crypto'): Promise<FundingRateData[]> {
  const cacheKey = `fundingRates_${assetClass}`;
  const cached = getCached<FundingRateData[]>(cacheKey);
  if (cached) return cached;

  try {
    // Use the server-side API route to avoid CORS issues
    const url = assetClass === 'crypto'
      ? '/api/funding'
      : `/api/funding?assetClass=${assetClass}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch funding rates');
    }
    const json = await response.json();
    // API returns { data, health, meta } — extract data array
    const allRates = Array.isArray(json) ? json : (json.data ?? json);
    setCache(cacheKey, allRates, FUNDING_TTL);
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

    setCache(cacheKey, allRates, FUNDING_TTL);
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
    const json = await response.json();
    // API returns { data, health, meta } — extract data array
    const allOI = Array.isArray(json) ? json : (json.data ?? json);
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

// Spot prices — real spot/CEX trading prices (not perp)
export type SpotPriceEntry = { symbol: string; exchange: string; price: number; volume24h: number };

export async function fetchSpotPrices(): Promise<SpotPriceEntry[]> {
  const cached = getCached<SpotPriceEntry[]>('spotPrices');
  if (cached) return cached;

  try {
    const response = await fetch('/api/spot-prices');
    if (!response.ok) throw new Error('Failed to fetch spot prices');
    const json = await response.json();
    const data = Array.isArray(json) ? json : (json.data ?? json);
    setCache('spotPrices', data, 30_000); // match server L1 TTL
    return data;
  } catch (error) {
    console.error('Error fetching spot prices:', error);
    return [];
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

// Get the server-computed total volume (sum across all exchanges, not just best-per-symbol)
export function getServerTotalVolume(): number | null {
  return getCached<number>('serverTotalVolume');
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

  // Use pre-computed exchange counts from raw (pre-dedup) data — cached by fetchAllTickers
  const exchangeCount = getCached<Map<string, number>>('tickerExchangeCounts') || new Map<string, number>();

  const validTickers = tickers.filter(t =>
    isValidNumber(t.priceChangePercent24h) &&
    t.quoteVolume24h >= 1_000_000 && // Min $1M volume — filters ghost/delisted pairs
    Math.abs(t.priceChangePercent24h) <= 200 && // Cap at 200% — beyond is squeeze/delisting noise
    (exchangeCount.get(t.symbol) || 0) >= 2 // Must be on 2+ exchanges (filters ghost pairs)
  );
  const sorted = [...validTickers].sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);

  const result = {
    gainers: sorted.slice(0, 10),
    losers: sorted.slice(-10).reverse(),
  };

  setCache('topMovers', result);
  return result;
}

// Get OI Changes - top OI coins with 1h/4h/24h change % when available
export async function fetchOIChanges(): Promise<(OpenInterestData & { pct1h?: number; pct4h?: number; pct24h?: number })[]> {
  const cached = getCached<(OpenInterestData & { pct1h?: number; pct4h?: number; pct24h?: number })[]>('oiChanges');
  if (cached) return cached;

  // Fetch OI with change data in a single call
  try {
    const res = await fetch('/api/openinterest?changes=1');
    if (!res.ok) throw new Error('OI fetch failed');
    const json = await res.json();
    const oiData: OpenInterestData[] = json.data || [];
    const changesMap: Record<string, { pct1h?: number; pct4h?: number; pct24h?: number }> = json.oiChanges || {};

    const sorted = [...oiData].sort((a, b) => b.openInterestValue - a.openInterestValue);
    const result = sorted.slice(0, 20).map(d => ({
      ...d,
      ...changesMap[d.symbol],
    }));

    setCache('oiChanges', result);
    return result;
  } catch {
    // Fallback: use basic OI data without changes
    const oiData = await fetchAllOpenInterest();
    const sorted = [...oiData].sort((a, b) => b.openInterestValue - a.openInterestValue);
    const result = sorted.slice(0, 20);
    setCache('oiChanges', result);
    return result;
  }
}

// Get aggregated market stats for the top stats bar
export async function fetchMarketStats(): Promise<{
  totalVolume24h: number;
  totalOpenInterest: number;
  btcLongShort: { longRatio: number; shortRatio: number };
  btcDominance: number;
  altcoinSeasonIndex: number | null;
}> {
  const cached = getCached<any>('marketStats');
  if (cached) return cached;

  const [tickers, oiData, longShort, globalData] = await Promise.all([
    fetchAllTickers(),
    fetchAllOpenInterest(),
    fetchLongShortRatio('BTCUSDT'),
    getGlobalData(),
  ]);

  // Use CoinGecko/CMC global volume (spot + derivatives, whole market)
  // Falls back to server-computed derivatives volume, then client-side dedup sum
  const globalVolume = globalData?.total_volume?.usd;
  const serverVol = getServerTotalVolume();
  const totalVolume = globalVolume || serverVol || tickers.reduce((sum, t) => sum + (t.quoteVolume24h || 0), 0);

  // Use CoinGecko global derivatives OI (sum across all exchanges) as primary,
  // fall back to our own per-exchange OI aggregation
  const globalOI = globalData?.total_derivatives_oi;
  const localOI = oiData.reduce((sum, o) => sum + (o.openInterestValue || 0), 0);
  const totalOI = globalOI && globalOI > 0 ? globalOI : localOI;

  // Get BTC dominance from CoinGecko global data (more accurate)
  const btcDominance = globalData?.market_cap_percentage?.btc || 54.2;

  // Altcoin Season Index from CoinGecko (CMC 90d methodology)
  const altcoinSeasonIndex: number | null = globalData?.altcoin_season_index ?? null;

  const result = {
    totalVolume24h: totalVolume,
    totalOpenInterest: totalOI,
    btcLongShort: longShort,
    btcDominance,
    altcoinSeasonIndex,
  };

  setCache('marketStats', result);
  return result;
}

// Get funding rate comparison across exchanges for arbitrage
export interface ArbitrageItem {
  symbol: string;
  exchanges: Array<{ exchange: string; rate: number }>;
  spread: number;
  markPrices: Array<{ exchange: string; price: number }>;
  intervals: Record<string, string>;
  nextFundingTimes: Record<string, number>;
}

export async function fetchFundingArbitrage(assetClass: AssetClassFilter = 'crypto'): Promise<ArbitrageItem[]> {
  const cacheKey = `fundingArbitrage_${assetClass}`;
  const cached = getCached<ArbitrageItem[]>(cacheKey);
  if (cached) return cached;

  const fundingRates = await fetchAllFundingRates(assetClass);

  // Symbol aliases: group equivalent assets under one canonical symbol
  // e.g., XAUT (Tether Gold) and PAXG (Paxos Gold) → XAU (spot gold)
  const SYMBOL_ALIASES: Record<string, string> = {
    'XAUT': 'XAU', 'PAXG': 'XAU', 'GOLD': 'XAU',
    'SILVER': 'XAG',
  };

  // --- Filter out Bitfinex clamped rates ---
  // Bitfinex caps funding at ±0.25% (clamp_min/clamp_max). Rates hitting the
  // clamp are not market-driven and create false arb signals.
  const BITFINEX_CLAMP = 0.25;
  const filteredRates = fundingRates.filter(fr => {
    if (fr.exchange === 'Bitfinex' && Math.abs(fr.fundingRate) >= BITFINEX_CLAMP - 0.001) {
      return false; // skip clamped rates
    }
    return true;
  });

  // --- Deduplicate same exchange entries (e.g., Binance linear + COIN-M) ---
  // Keep only one entry per exchange+symbol, preferring the one without marginType
  // (linear/USDT-M) since that has more liquidity.
  const dedupeKey = (fr: { symbol: string; exchange: string }) => `${fr.exchange}|${fr.symbol}`;
  const seen = new Set<string>();
  const dedupedRates = filteredRates.filter(fr => {
    const key = dedupeKey(fr);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Group by symbol — normalize all rates to 8h basis for fair comparison
  const symbolMap = new Map<string, Array<{ exchange: string; rate: number }>>();
  const priceMap = new Map<string, Array<{ exchange: string; price: number }>>();
  const intervalTracker = new Map<string, Record<string, string>>();
  const nextFundingTimeTracker = new Map<string, Record<string, number>>();
  dedupedRates.forEach(fr => {
    const canonicalSymbol = SYMBOL_ALIASES[fr.symbol] || fr.symbol;
    const mult = fr.fundingInterval === '1h' ? 8 : fr.fundingInterval === '4h' ? 2 : 1;
    const existing = symbolMap.get(canonicalSymbol) || [];
    // For DEXes with separate long/short rates (gTrade, GMX), use only the
    // directional (asymmetric) component — strip out symmetric borrowing fees.
    // When fundingRateLong === fundingRateShort, the entire rate is borrowing
    // fees paid by both sides equally, so effective funding spread is 0.
    let effectiveRate: number;
    if (fr.fundingRateLong != null && fr.fundingRateShort != null) {
      // L/S use earning convention: positive = earning for that side.
      // (S - L)/2 extracts directional funding: positive = longs pay shorts.
      effectiveRate = (fr.fundingRateShort - fr.fundingRateLong) / 2;
    } else {
      effectiveRate = fr.fundingRate;
    }
    existing.push({ exchange: fr.exchange, rate: effectiveRate * mult });
    symbolMap.set(canonicalSymbol, existing);

    // Collect per-exchange mark prices
    if (fr.markPrice && fr.markPrice > 0) {
      const prices = priceMap.get(canonicalSymbol) || [];
      prices.push({ exchange: fr.exchange, price: fr.markPrice });
      priceMap.set(canonicalSymbol, prices);
    }

    // Track funding intervals per exchange
    if (fr.fundingInterval) {
      const intervals = intervalTracker.get(canonicalSymbol) || {};
      intervals[fr.exchange] = fr.fundingInterval;
      intervalTracker.set(canonicalSymbol, intervals);
    }

    // Track next funding time per exchange
    if (fr.nextFundingTime && fr.nextFundingTime > 0) {
      const times = nextFundingTimeTracker.get(canonicalSymbol) || {};
      times[fr.exchange] = fr.nextFundingTime;
      nextFundingTimeTracker.set(canonicalSymbol, times);
    }
  });

  // Calculate spread for each symbol (only those with 2+ exchanges)
  // Cap at 2% 8h spread — anything higher is almost certainly bad data or a junk coin
  const MAX_FUNDING_SPREAD_8H = 2.0;
  const arbitrageData: ArbitrageItem[] = Array.from(symbolMap.entries())
    .filter(([_, exchanges]) => exchanges.length >= 2)
    .map(([symbol, exchanges]) => {
      // --- Outlier filter: remove rates that deviate wildly from the median ---
      // This catches exchange-specific data errors (e.g., a stale rate from a
      // briefly disconnected exchange) that create false arb signals.
      const sortedRates = exchanges.map(e => e.rate).sort((a, b) => a - b);
      const medianRate = sortedRates[Math.floor(sortedRates.length / 2)];
      const filteredExchanges = exchanges.length >= 4
        ? exchanges.filter(e => Math.abs(e.rate - medianRate) < 1.0) // remove >1% outliers when 4+ exchanges
        : exchanges;
      if (filteredExchanges.length < 2) return null;

      const rates = filteredExchanges.map(e => e.rate);
      const maxRate = Math.max(...rates);
      const minRate = Math.min(...rates);
      const spread = maxRate - minRate;
      if (spread > MAX_FUNDING_SPREAD_8H) return null;
      return {
        symbol,
        exchanges: filteredExchanges,
        spread,
        markPrices: priceMap.get(symbol) || [],
        intervals: intervalTracker.get(symbol) || {},
        nextFundingTimes: nextFundingTimeTracker.get(symbol) || {},
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.spread - a.spread);

  setCache(cacheKey, arbitrageData);
  return arbitrageData;
}

// Fetch historical arbitrage spread data for stability/trend analysis
export interface ArbHistoricalSpread {
  avg7d: number;
  avg24h: number;
  avg6d: number;
}

export async function fetchArbHistory(symbols: string[]): Promise<Map<string, ArbHistoricalSpread>> {
  if (symbols.length === 0) return new Map();
  // Deduplicate and cap to avoid URL-too-long errors
  const unique = Array.from(new Set(symbols)).slice(0, 200);
  // Use sorted join for stable cache key — avoids collisions from truncating to 5 symbols
  const cacheKey = `arbHistory_${unique.slice().sort().join(',')}`;
  const cached = getCached<Map<string, ArbHistoricalSpread>>(cacheKey);
  if (cached) return cached;

  try {
    const map = new Map<string, ArbHistoricalSpread>();
    // Batch into chunks of 100, fetch in parallel to avoid sequential waterfall
    const BATCH = 100;
    const batches: string[][] = [];
    for (let i = 0; i < unique.length; i += BATCH) {
      batches.push(unique.slice(i, i + BATCH));
    }
    const responses = await Promise.all(
      batches.map(batch => fetch(`/api/arb-history?symbols=${batch.join(',')}`).catch(() => null))
    );
    for (const response of responses) {
      if (!response || !response.ok) continue;
      const json = await response.json();
      if (json.data) {
        Object.entries(json.data).forEach(([sym, data]) => {
          map.set(sym, data as ArbHistoricalSpread);
        });
      }
    }
    setCache(cacheKey, map, FUNDING_TTL);
    return map;
  } catch {
    return new Map();
  }
}

// Fetch exchange health status from the funding API
export interface ExchangeHealthInfo {
  name: string;
  status: 'ok' | 'error' | 'empty';
  count: number;
  latencyMs: number;
  error?: string;
}

export async function fetchExchangeHealth(): Promise<{
  funding: ExchangeHealthInfo[];
  meta: { totalExchanges: number; activeExchanges: number };
}> {
  const cached = getCached<any>('exchangeHealth');
  if (cached) return cached;

  try {
    const response = await fetch('/api/funding');
    if (!response.ok) throw new Error('Failed to fetch');
    const json = await response.json();
    if (json.health && json.meta) {
      const result = { funding: json.health, meta: json.meta };
      setCache('exchangeHealth', result);
      return result;
    }
  } catch {
    // silent
  }
  return { funding: [], meta: { totalExchanges: 0, activeExchanges: 0 } };
}

// Prediction markets — Polymarket, Kalshi, Manifold, Metaculus
export async function fetchPredictionMarkets(): Promise<import('./prediction-markets/types').PredictionMarketsResponse> {
  const cached = getCached<import('./prediction-markets/types').PredictionMarketsResponse>('predictionMarkets');
  if (cached) return cached;

  try {
    const response = await fetch('/api/prediction-markets');
    if (!response.ok) throw new Error('Failed to fetch prediction markets');
    const data = await response.json();
    setCache('predictionMarkets', data);
    return data;
  } catch {
    return {
      arbitrage: [],
      markets: { polymarket: [], kalshi: [] },
      meta: { counts: { polymarket: 0, kalshi: 0 }, matchedCount: 0, timestamp: Date.now() },
    };
  }
}

// Fetch execution costs across DEX venues
export async function fetchExecutionCosts(asset: string, size: number, direction: 'long' | 'short'): Promise<import('@/lib/execution-costs/types').ExecutionCostResponse> {
  const cacheKey = `execCost_${asset}_${size}_${direction}`;
  const cached = getCached<import('@/lib/execution-costs/types').ExecutionCostResponse>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`/api/execution-costs?asset=${encodeURIComponent(asset)}&size=${size}&direction=${direction}`);
  if (!response.ok) throw new Error('Failed to fetch execution costs');
  const data = await response.json();
  setCache(cacheKey, data, DEFAULT_TTL);
  return data;
}

// Export dydx API for direct access (used as fallback)
export { dydxAPI };