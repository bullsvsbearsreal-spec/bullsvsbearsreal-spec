/**
 * Funding rate history stored in localStorage.
 * Snapshots are saved every 5 minutes (deduped by rounding timestamp).
 * Only top-100 symbols by exchange count are stored to stay within localStorage limits.
 * Data older than 30 days is automatically pruned.
 */

const STORAGE_PREFIX = 'ih_fr_';
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_SYMBOLS = 100;
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

interface FundingEntry {
  symbol: string;
  exchange: string;
  fundingRate: number;
}

export interface HistoryPoint {
  t: number;
  rate: number;
}

export interface AccumulatedFunding {
  d1: number;
  d7: number;
  d30: number;
}

function roundTo5Min(ts: number): number {
  return Math.floor(ts / SNAPSHOT_INTERVAL_MS) * SNAPSHOT_INTERVAL_MS;
}

function getSnapshotKey(ts: number): string {
  return `${STORAGE_PREFIX}${roundTo5Min(ts)}`;
}

/**
 * Save a funding rate snapshot to localStorage.
 * Deduplicates by 5-minute intervals. Prunes old data.
 */
export function saveFundingSnapshot(rates: FundingEntry[]): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const key = getSnapshotKey(now);

  // Skip if we already have a snapshot for this 5-min slot
  if (localStorage.getItem(key)) return;

  // Count exchanges per symbol to find top-100
  const symbolExCounts: Record<string, number> = {};
  rates.forEach(r => {
    symbolExCounts[r.symbol] = (symbolExCounts[r.symbol] || 0) + 1;
  });
  const topSymbols = new Set(
    Object.entries(symbolExCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SYMBOLS)
      .map(([sym]) => sym)
  );

  // Build compact snapshot: "SYM|EX" → rate
  const compact: Record<string, number> = {};
  rates.forEach(r => {
    if (topSymbols.has(r.symbol)) {
      compact[`${r.symbol}|${r.exchange}`] = parseFloat(r.fundingRate.toFixed(6));
    }
  });

  try {
    localStorage.setItem(key, JSON.stringify({ t: roundTo5Min(now), r: compact }));
  } catch {
    // localStorage full — prune aggressively
    pruneOldSnapshots(14 * 24 * 60 * 60 * 1000); // Keep only 14 days
    try {
      localStorage.setItem(key, JSON.stringify({ t: roundTo5Min(now), r: compact }));
    } catch {
      // Still full — give up silently
    }
  }

  // Prune old snapshots (infrequently — check every 10th save)
  if (Math.random() < 0.1) {
    pruneOldSnapshots(MAX_AGE_MS);
  }
}

/**
 * Get funding rate history for a specific symbol+exchange pair.
 */
export function getFundingHistory(symbol: string, exchange: string, days: number = 30): HistoryPoint[] {
  if (typeof window === 'undefined') return [];

  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const lookupKey = `${symbol}|${exchange}`;
  const points: HistoryPoint[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    try {
      const data = JSON.parse(localStorage.getItem(key)!);
      if (data.t < cutoff) continue;

      const rate = data.r[lookupKey];
      if (rate !== undefined) {
        points.push({ t: data.t, rate });
      }
    } catch {
      // Corrupt entry — skip
    }
  }

  return points.sort((a, b) => a.t - b.t);
}

/**
 * Get all history for a symbol across all exchanges (for sparklines).
 * Returns the average rate across all exchanges at each timestamp.
 */
export function getSymbolHistory(symbol: string, days: number = 30): HistoryPoint[] {
  if (typeof window === 'undefined') return [];

  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const pointsMap = new Map<number, number[]>(); // timestamp → rates[]

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    try {
      const data = JSON.parse(localStorage.getItem(key)!);
      if (data.t < cutoff) continue;

      for (const [k, rate] of Object.entries(data.r)) {
        if (k.startsWith(`${symbol}|`)) {
          if (!pointsMap.has(data.t)) pointsMap.set(data.t, []);
          pointsMap.get(data.t)!.push(rate as number);
        }
      }
    } catch {
      // skip
    }
  }

  return Array.from(pointsMap.entries())
    .map(([t, rates]) => ({
      t,
      rate: rates.reduce((a, b) => a + b, 0) / rates.length,
    }))
    .sort((a, b) => a.t - b.t);
}

/**
 * Calculate accumulated funding over a time period.
 * Funding settles every 8 hours (3 times per day).
 * Groups snapshots into 8h periods, takes the average rate per period, sums them.
 */
export function getAccumulatedFunding(symbol: string, exchange: string, days: number): number {
  if (typeof window === 'undefined') return 0;

  const history = getFundingHistory(symbol, exchange, days);
  if (history.length === 0) return 0;

  // Group into 8h funding periods
  const periodMap = new Map<number, number[]>();
  history.forEach(point => {
    const periodStart = Math.floor(point.t / EIGHT_HOURS_MS) * EIGHT_HOURS_MS;
    if (!periodMap.has(periodStart)) periodMap.set(periodStart, []);
    periodMap.get(periodStart)!.push(point.rate);
  });

  // Sum the average rate from each 8h period
  let accumulated = 0;
  periodMap.forEach(rates => {
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    accumulated += avgRate;
  });

  return accumulated;
}

/**
 * Efficient batch calculation of accumulated funding for multiple pairs.
 * Scans localStorage once and computes 1D/7D/30D accumulated for each pair.
 */
export function getAccumulatedFundingBatch(
  pairs: { symbol: string; exchange: string }[]
): Map<string, AccumulatedFunding> {
  if (typeof window === 'undefined') return new Map();
  if (pairs.length === 0) return new Map();

  const now = Date.now();
  const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
  const cutoff1d = now - 1 * 24 * 60 * 60 * 1000;

  // Build lookup set
  const pairKeys = new Set(pairs.map(p => `${p.symbol}|${p.exchange}`));

  // Collect all history points per pair, grouped by 8h period
  // Structure: pairKey → periodStart → rates[]
  const pairPeriods = new Map<string, Map<number, number[]>>();
  pairKeys.forEach(pk => pairPeriods.set(pk, new Map()));

  // Single scan of localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    try {
      const data = JSON.parse(localStorage.getItem(key)!);
      if (data.t < cutoff30d) continue;

      for (const [k, rate] of Object.entries(data.r)) {
        if (!pairKeys.has(k)) continue;
        const periodStart = Math.floor(data.t / EIGHT_HOURS_MS) * EIGHT_HOURS_MS;
        const periods = pairPeriods.get(k)!;
        if (!periods.has(periodStart)) periods.set(periodStart, []);
        periods.get(periodStart)!.push(rate as number);
      }
    } catch {
      // skip corrupt entries
    }
  }

  // Calculate accumulated for each pair across 1D/7D/30D windows
  const result = new Map<string, AccumulatedFunding>();

  pairPeriods.forEach((periods, pairKey) => {
    let d1 = 0, d7 = 0, d30 = 0;

    periods.forEach((rates, periodStart) => {
      const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
      d30 += avgRate;
      if (periodStart >= cutoff7d) d7 += avgRate;
      if (periodStart >= cutoff1d) d1 += avgRate;
    });

    if (d1 !== 0 || d7 !== 0 || d30 !== 0) {
      result.set(pairKey, { d1, d7, d30 });
    }
  });

  return result;
}

/**
 * Remove snapshots older than maxAge.
 */
function pruneOldSnapshots(maxAge: number): void {
  const cutoff = Date.now() - maxAge;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    // Extract timestamp from key
    const ts = parseInt(key.slice(STORAGE_PREFIX.length), 10);
    if (ts < cutoff) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Get storage statistics for debugging.
 */
export function getStorageStats(): { count: number; oldest: number | null; newest: number | null; sizeKB: number } {
  if (typeof window === 'undefined') return { count: 0, oldest: null, newest: null, sizeKB: 0 };

  let count = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  let totalSize = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    count++;
    const ts = parseInt(key.slice(STORAGE_PREFIX.length), 10);
    if (oldest === null || ts < oldest) oldest = ts;
    if (newest === null || ts > newest) newest = ts;
    totalSize += (localStorage.getItem(key) || '').length;
  }

  return { count, oldest, newest, sizeKB: Math.round(totalSize / 1024) };
}
