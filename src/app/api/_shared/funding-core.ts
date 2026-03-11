/**
 * Core funding data fetching + processing logic.
 * Extracted from /api/funding/route.ts so both the internal route
 * and /api/v1/funding can call it directly (no self-referential HTTP).
 */

import { fetchWithTimeout, getTop500Symbols, isTop500Symbol, normalizeSymbol } from './fetch';
import { fetchAllExchangesWithHealth } from './exchange-fetchers';
import { dedupedFetch } from './inflight';
import { fundingFetchers } from '../funding/exchanges';
import { classifySymbol, KNOWN_STOCKS, KNOWN_FOREX, FOREX_BASES } from '../funding/normalize';
import type { AssetClassFilter } from '@/lib/validation/schemas';

// ---------------------------------------------------------------------------
// Two-layer cache: raw exchange data (expensive) + per-assetClass responses
// ---------------------------------------------------------------------------

interface CachedRawData {
  dataWithPrices: any[];
  health: any[];
  top500: Set<string>;
  multiExchangeSymbols: Set<string>;
  timestamp: number;
}

let rawDataCache: CachedRawData | null = null;
const RAW_TTL = 2 * 60 * 1000; // 2 minutes

const responseCache = new Map<string, { body: FundingResult; timestamp: number }>();
const RESPONSE_CACHE_MAX = 10; // Max asset class variants to cache

export interface FundingResult {
  data: any[];
  health: any[];
  meta: {
    totalExchanges: number;
    activeExchanges: number;
    totalEntries: number;
    assetClass: AssetClassFilter;
    timestamp: number;
    normalization: { basis: string; note: string };
  };
}

// Filter processed data by asset class
function filterByAssetClass(
  dataWithPrices: any[],
  top500: Set<string>,
  multiExchangeSymbols: Set<string>,
  assetClass: AssetClassFilter,
) {
  const isAllowed = (symbol: string) =>
    isTop500Symbol(symbol, top500) || multiExchangeSymbols.has(symbol.toUpperCase());

  if (assetClass === 'all') {
    return dataWithPrices.filter(r => {
      if (!r.assetClass || r.assetClass === 'crypto') {
        return r.type === 'dex' || isAllowed(r.symbol);
      }
      return true;
    });
  } else if (assetClass === 'crypto') {
    return dataWithPrices.filter(r => {
      const ac = r.assetClass || 'crypto';
      return ac === 'crypto' && (r.type === 'dex' || isAllowed(r.symbol));
    });
  } else {
    return dataWithPrices.filter(r => r.assetClass === assetClass);
  }
}

function buildResult(filtered: any[], health: any[], assetClass: AssetClassFilter): FundingResult {
  return {
    data: filtered,
    health,
    meta: {
      totalExchanges: fundingFetchers.length,
      activeExchanges: health.filter((h: any) => h.status === 'ok').length,
      totalEntries: filtered.length,
      assetClass,
      timestamp: Date.now(),
      normalization: {
        basis: 'native',
        note: 'Rates in native interval percentage — check fundingInterval field (1h/4h/8h). 8h: Binance, Bybit, OKX, Bitget, MEXC, BingX, Phemex, KuCoin, Deribit, HTX, Bitfinex, WhiteBIT, CoinEx, Aster, gTrade. 4h: Kraken, edgeX. 1h: Hyperliquid, dYdX, Aevo, Coinbase, Drift, GMX, Extended, Lighter. Bitunix/Variational vary per market. predictedRate only present when natively provided by the exchange.',
      },
    },
  };
}

/**
 * Fetch and process funding data for a given asset class.
 * Returns { data, health, meta } or null on complete failure.
 * Uses 2-layer in-memory cache (2-min TTL).
 */
export async function getFundingData(
  assetClass: AssetClassFilter,
): Promise<{ result: FundingResult; cacheStatus: string } | null> {
  // Layer 2: Return cached filtered response if fresh
  const cacheKey = `funding_${assetClass}`;
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse && Date.now() - cachedResponse.timestamp < RAW_TTL) {
    return { result: cachedResponse.body, cacheStatus: 'HIT' };
  }

  // Layer 1: Check if raw data is fresh — just re-filter (instant)
  if (rawDataCache && Date.now() - rawDataCache.timestamp < RAW_TTL) {
    const filtered = filterByAssetClass(rawDataCache.dataWithPrices, rawDataCache.top500, rawDataCache.multiExchangeSymbols, assetClass);
    const result = buildResult(filtered, rawDataCache.health, assetClass);
    responseCache.set(cacheKey, { body: result, timestamp: Date.now() });
    return { result, cacheStatus: 'FILTERED' };
  }

  // Cache miss — fetch all exchanges (the expensive part: ~5-10s)
  let data: any[], health: any[], top500: Set<string>;
  try {
    const [exchangeResult, top500Result] = await dedupedFetch('funding-raw', () =>
      Promise.all([
        fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout),
        getTop500Symbols(),
      ]),
    );
    data = exchangeResult.data;
    health = exchangeResult.health;
    top500 = top500Result;
  } catch (err) {
    // If fetch fails, return stale cache if available
    if (cachedResponse) {
      return { result: cachedResponse.body, cacheStatus: 'STALE' };
    }
    if (rawDataCache) {
      const filtered = filterByAssetClass(rawDataCache.dataWithPrices, rawDataCache.top500, rawDataCache.multiExchangeSymbols, assetClass);
      const result = buildResult(filtered, rawDataCache.health, assetClass);
      return { result, cacheStatus: 'STALE-RAW' };
    }
    return null; // Complete failure
  }

  // ── Post-processing pipeline ──

  // Normalize symbols for token rebrands (RNDR→RENDER, MATIC→POL)
  data.forEach(entry => { entry.symbol = normalizeSymbol(entry.symbol); });

  // Classify asset class for entries that don't have one set
  data.forEach(entry => {
    if (entry.assetClass && entry.assetClass !== 'crypto') return;
    const sym = entry.symbol;

    // Handle MEXC *STOCK suffix (MSTRSTOCK → MSTR as stocks)
    if (sym.endsWith('STOCK')) {
      const base = sym.slice(0, -5);
      if (KNOWN_STOCKS.has(base)) {
        entry.symbol = base;
        entry.assetClass = 'stocks';
        return;
      }
    }

    // Check bare forex base symbols (EUR, GBP, JPY)
    if (FOREX_BASES.has(sym)) {
      entry.symbol = sym + 'USD';
      entry.assetClass = 'forex';
      return;
    }

    // Generic classification
    const classified = classifySymbol(sym);
    if (classified.assetClass !== 'crypto') {
      entry.assetClass = classified.assetClass;
      entry.symbol = classified.symbol;
    }
  });

  // Fix mark prices: backfill from other exchanges
  const realPriceMap = new Map<string, number>();
  data.forEach(entry => {
    if (entry.markPrice && entry.markPrice > 0) {
      if (!realPriceMap.has(entry.symbol)) realPriceMap.set(entry.symbol, entry.markPrice);
    }
  });
  const BAD_PRICE_EXCHANGES = new Set(['gTrade']);
  data.forEach(entry => {
    const needsFix = BAD_PRICE_EXCHANGES.has(entry.exchange) || !entry.markPrice || entry.markPrice === 0;
    if (!needsFix) return;
    const realPrice = realPriceMap.get(entry.symbol);
    if (realPrice) entry.markPrice = realPrice;
  });

  // Backfill indexPrice for exchanges that return 0
  const indexPriceMap = new Map<string, number>();
  data.forEach(entry => {
    if (entry.indexPrice && entry.indexPrice > 0) {
      if (!indexPriceMap.has(entry.symbol)) indexPriceMap.set(entry.symbol, entry.indexPrice);
    }
  });
  data.forEach(entry => {
    if (!entry.indexPrice || entry.indexPrice === 0) {
      const realIndex = indexPriceMap.get(entry.symbol);
      if (realIndex) entry.indexPrice = realIndex;
    }
  });

  // Remove entries without valid mark price (DEX exempt)
  const dataWithPrices = data.filter(entry =>
    entry.type === 'dex' || (entry.markPrice && entry.markPrice > 0),
  );

  // Only keep native predicted rates from exchanges that actually provide them (OKX, CoinEx, Binance, Bybit, etc.)
  // Previously we computed implied predicted rates from mark-index spread, but those were inaccurate.

  // Build set of crypto symbols listed on 2+ exchanges
  const exchangeCountMap = new Map<string, Set<string>>();
  dataWithPrices.forEach(r => {
    if (!r.symbol) return;
    if (!r.assetClass || r.assetClass === 'crypto') {
      const sym = r.symbol.toUpperCase();
      if (!exchangeCountMap.has(sym)) exchangeCountMap.set(sym, new Set());
      exchangeCountMap.get(sym)!.add(r.exchange);
    }
  });
  const multiExchangeSymbols = new Set<string>();
  exchangeCountMap.forEach((exchanges, sym) => {
    if (exchanges.size >= 2) multiExchangeSymbols.add(sym);
  });

  // Update raw data cache — clear stale response entries
  rawDataCache = { dataWithPrices, health, top500, multiExchangeSymbols, timestamp: Date.now() };
  responseCache.clear();

  // Filter and build result
  const filtered = filterByAssetClass(dataWithPrices, top500, multiExchangeSymbols, assetClass);
  const result = buildResult(filtered, health, assetClass);

  // Update response cache
  responseCache.set(cacheKey, { body: result, timestamp: Date.now() });

  return { result, cacheStatus: 'MISS' };
}
