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

// ---------------------------------------------------------------------------
// OI snapshot history for change % calculations
// Stores per-symbol total OI at periodic intervals (kept in-memory, ~10 snapshots)
// ---------------------------------------------------------------------------
interface OISnapshot { ts: number; data: Map<string, number> }
const oiSnapshots: OISnapshot[] = [];
const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // 5 min between snapshots
const MAX_SNAPSHOTS = 300; // ~25 hours of 5-min snapshots

function storeOISnapshot(data: any[]) {
  const now = Date.now();
  const last = oiSnapshots[oiSnapshots.length - 1];
  if (last && now - last.ts < SNAPSHOT_INTERVAL) return; // too soon
  const map = new Map<string, number>();
  for (const entry of data) {
    const sym = entry.symbol as string;
    map.set(sym, (map.get(sym) || 0) + (entry.openInterestValue || 0));
  }
  oiSnapshots.push({ ts: now, data: map });
  if (oiSnapshots.length > MAX_SNAPSHOTS) oiSnapshots.shift();
}

function findNearestSnapshot(targetAge: number): OISnapshot | null {
  const targetTs = Date.now() - targetAge;
  let best: OISnapshot | null = null;
  let bestDiff = Infinity;
  for (const snap of oiSnapshots) {
    const diff = Math.abs(snap.ts - targetTs);
    if (diff < bestDiff) { bestDiff = diff; best = snap; }
  }
  // Only use if within 50% of target age (e.g. for 1h, accept 30min-1.5h)
  if (best && bestDiff < targetAge * 0.5) return best;
  return null;
}

/** Get OI change % for a symbol relative to a past snapshot */
export function getOIChanges(): {
  changes: Map<string, { pct1h?: number; pct4h?: number; pct24h?: number }>;
  snapshotCount: number;
} {
  const changes = new Map<string, { pct1h?: number; pct4h?: number; pct24h?: number }>();
  if (!l1Cache) return { changes, snapshotCount: oiSnapshots.length };

  // Current total OI per symbol
  const current = new Map<string, number>();
  for (const entry of l1Cache.body.data) {
    const sym = entry.symbol as string;
    current.set(sym, (current.get(sym) || 0) + (entry.openInterestValue || 0));
  }

  const snap1h = findNearestSnapshot(60 * 60 * 1000);
  const snap4h = findNearestSnapshot(4 * 60 * 60 * 1000);
  const snap24h = findNearestSnapshot(24 * 60 * 60 * 1000);

  current.forEach((curOI, sym) => {
    if (curOI <= 0) return;
    const change: { pct1h?: number; pct4h?: number; pct24h?: number } = {};
    if (snap1h) {
      const prev = snap1h.data.get(sym);
      if (prev && prev > 0) change.pct1h = ((curOI - prev) / prev) * 100;
    }
    if (snap4h) {
      const prev = snap4h.data.get(sym);
      if (prev && prev > 0) change.pct4h = ((curOI - prev) / prev) * 100;
    }
    if (snap24h) {
      const prev = snap24h.data.get(sym);
      if (prev && prev > 0) change.pct24h = ((curOI - prev) / prev) * 100;
    }
    if (change.pct1h !== undefined || change.pct4h !== undefined || change.pct24h !== undefined) {
      changes.set(sym, change);
    }
  });

  return { changes, snapshotCount: oiSnapshots.length };
}

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
      if (!r.symbol) return;
      const sym = r.symbol.toUpperCase();
      if (!exchangeCountMap.has(sym)) exchangeCountMap.set(sym, new Set());
      exchangeCountMap.get(sym)!.add(r.exchange);
    });
    const multiExchangeSymbols = new Set<string>();
    exchangeCountMap.forEach((exchanges, sym) => {
      if (exchanges.size >= 2) multiExchangeSymbols.add(sym);
    });

    const filtered = data.filter(r =>
      r.symbol && (isTop500Symbol(r.symbol, top500) || multiExchangeSymbols.has(r.symbol.toUpperCase())),
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

    // Update cache + store snapshot for change tracking
    l1Cache = { body: result, timestamp: Date.now() };
    storeOISnapshot(filtered);

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
