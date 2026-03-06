/**
 * Core open interest data fetching + processing logic.
 * Extracted from /api/openinterest/route.ts so both the internal route
 * and /api/v1/openinterest can call it directly (no self-referential HTTP).
 */

import { fetchWithTimeout, getTop500Symbols, isTop500Symbol, normalizeSymbol } from './fetch';
import { fetchAllExchangesWithHealth } from './exchange-fetchers';
import { oiFetchers } from '../openinterest/exchanges';

// ---------------------------------------------------------------------------
// In-memory cache (2-minute TTL)
// ---------------------------------------------------------------------------

export interface OIResult {
  data: any[];
  health: any[];
  meta: {
    totalExchanges: number;
    activeExchanges: number;
    totalEntries: number;
    timestamp: number;
  };
}

let l1Cache: { body: OIResult; timestamp: number } | null = null;
const L1_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Fetch and process open interest data.
 * Returns { result, cacheStatus } or null on complete failure.
 * Uses in-memory cache (2-min TTL).
 */
export async function getOIData(): Promise<{ result: OIResult; cacheStatus: string } | null> {
  // Return cached data if fresh
  if (l1Cache && Date.now() - l1Cache.timestamp < L1_TTL) {
    return { result: l1Cache.body, cacheStatus: 'HIT' };
  }

  try {
    const [{ data, health }, top500] = await Promise.all([
      fetchAllExchangesWithHealth(oiFetchers, fetchWithTimeout),
      getTop500Symbols(),
    ]);

    // Normalize symbols for token rebrands (RNDR→RENDER, MATIC→POL)
    data.forEach((r: any) => { r.symbol = normalizeSymbol(r.symbol); });

    // Allow symbols listed on 2+ exchanges even if not top 500
    const exchangeCountMap = new Map<string, Set<string>>();
    data.forEach(r => {
      const sym = r.symbol.toUpperCase();
      if (!exchangeCountMap.has(sym)) exchangeCountMap.set(sym, new Set());
      exchangeCountMap.get(sym)!.add(r.exchange);
    });
    const multiExchangeSymbols = new Set<string>();
    exchangeCountMap.forEach((exchanges, sym) => {
      if (exchanges.size >= 2) multiExchangeSymbols.add(sym);
    });

    const filtered = data.filter(r =>
      isTop500Symbol(r.symbol, top500) || multiExchangeSymbols.has(r.symbol.toUpperCase()),
    );

    const result: OIResult = {
      data: filtered,
      health,
      meta: {
        totalExchanges: oiFetchers.length,
        activeExchanges: health.filter(h => h.status === 'ok').length,
        totalEntries: filtered.length,
        timestamp: Date.now(),
      },
    };

    // Update cache
    l1Cache = { body: result, timestamp: Date.now() };

    return { result, cacheStatus: 'MISS' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('OI core error:', msg);

    // Return stale cache if available
    if (l1Cache) {
      return { result: l1Cache.body, cacheStatus: 'STALE' };
    }

    return null;
  }
}
