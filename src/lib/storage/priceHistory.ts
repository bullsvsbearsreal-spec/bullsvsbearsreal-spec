/**
 * Price history stored in localStorage for correlation analysis.
 * Snapshots are saved every 5 minutes (deduped by rounding timestamp).
 * Data older than 7 days is automatically pruned.
 * Max 2016 entries (7 days * 24h * 12 snapshots/h).
 */

const STORAGE_KEY = 'ih_price_history';
const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // 5 min
const MAX_AGE = 7 * 24 * 60 * 1000; // 7 days max retention
const MAX_ENTRIES = 2016; // 7 days * 24h * 60/5

interface PriceSnapshot {
  timestamp: number;
  prices: Record<string, number>;
}

function roundTo5Min(ts: number): number {
  return Math.floor(ts / SNAPSHOT_INTERVAL) * SNAPSHOT_INTERVAL;
}

function loadSnapshots(): PriceSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PriceSnapshot[];
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: PriceSnapshot[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // localStorage full — prune aggressively and retry
    const pruned = snapshots.slice(-Math.floor(MAX_ENTRIES / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      // Still full — give up silently
    }
  }
}

/**
 * Save a price snapshot to localStorage.
 * Deduplicates by 5-minute intervals. Prunes entries older than 7 days.
 */
export function savePriceSnapshot(prices: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  if (!prices || Object.keys(prices).length === 0) return;

  const now = Date.now();
  const roundedTs = roundTo5Min(now);
  let snapshots = loadSnapshots();

  // Skip if we already have a snapshot for this 5-min slot
  if (snapshots.length > 0 && snapshots[snapshots.length - 1].timestamp === roundedTs) {
    return;
  }

  // Add new snapshot
  snapshots.push({ timestamp: roundedTs, prices });

  // Prune old entries (older than 7 days)
  const cutoff = now - MAX_AGE;
  snapshots = snapshots.filter(s => s.timestamp >= cutoff);

  // Enforce max entries limit
  if (snapshots.length > MAX_ENTRIES) {
    snapshots = snapshots.slice(-MAX_ENTRIES);
  }

  saveSnapshots(snapshots);
}

/**
 * Return price arrays aligned by timestamp for given symbols over the last N hours.
 * Only includes timestamps where ALL requested symbols have data.
 */
export function getPriceHistory(
  symbols: string[],
  hours: number
): { symbol: string; prices: number[] }[] {
  if (typeof window === 'undefined') return [];
  if (symbols.length === 0) return [];

  const snapshots = loadSnapshots();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  // Filter to relevant timeframe and sort by timestamp
  const relevant = snapshots
    .filter(s => s.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (relevant.length === 0) return [];

  // Only include timestamps where ALL symbols have data
  const aligned = relevant.filter(s =>
    symbols.every(sym => s.prices[sym] !== undefined && s.prices[sym] > 0)
  );

  if (aligned.length === 0) return [];

  return symbols.map(symbol => ({
    symbol,
    prices: aligned.map(s => s.prices[symbol]),
  }));
}

/**
 * Return all symbols that have history data.
 */
export function getAvailableSymbols(): string[] {
  if (typeof window === 'undefined') return [];

  const snapshots = loadSnapshots();
  const symbolSet = new Set<string>();

  snapshots.forEach(s => {
    Object.keys(s.prices).forEach(sym => symbolSet.add(sym));
  });

  return Array.from(symbolSet).sort();
}

/**
 * Get storage statistics for debugging.
 */
export function getPriceHistoryStats(): {
  count: number;
  oldest: number | null;
  newest: number | null;
  symbolCount: number;
  sizeKB: number;
} {
  if (typeof window === 'undefined') {
    return { count: 0, oldest: null, newest: null, symbolCount: 0, sizeKB: 0 };
  }

  const snapshots = loadSnapshots();
  const raw = localStorage.getItem(STORAGE_KEY) || '';
  const symbols = new Set<string>();
  snapshots.forEach(s => Object.keys(s.prices).forEach(sym => symbols.add(sym)));

  return {
    count: snapshots.length,
    oldest: snapshots.length > 0 ? snapshots[0].timestamp : null,
    newest: snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp : null,
    symbolCount: symbols.size,
    sizeKB: Math.round(raw.length / 1024),
  };
}
