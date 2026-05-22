/**
 * Funding rate history stored in localStorage.
 * Snapshots are saved every 5 minutes (deduped by rounding timestamp).
 * Only top-100 symbols by exchange count are stored to stay within localStorage limits.
 * Data older than 30 days is automatically pruned.
 *
 * Funding interval handling
 * -------------------------
 * Each snapshot value may be either:
 *   - a bare number (the legacy format — interval is unknown, fall back to
 *     per-exchange default via `intervalHoursFor`)
 *   - a [rate, intervalHours] tuple (current format — exact interval stored
 *     alongside the rate so accumulation can scale correctly for non-8h venues)
 *
 * The accumulator multiplies each per-period contribution by
 * `(8 / intervalHours)` so a 1h venue (HL, dYdX, Aevo, Coinbase) compounds
 * 8x within the 8h period bucket, a 4h venue 2x, and an 8h venue 1x.
 * Without this scaling, 1h venues' accumulated funding shows ~12% of the
 * true cost over 30 days (which was christian's complaint).
 */

import { intervalHoursFor } from '@/lib/funding-intervals';

const STORAGE_PREFIX = 'ih_fr_';
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_SYMBOLS = 100;
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const PERIOD_BUCKET_HOURS = 8; // also the multiplier numerator below

interface FundingEntry {
  symbol: string;
  exchange: string;
  fundingRate: number;
  /** Native settlement interval in hours. When omitted the accumulator
   *  falls back to `intervalHoursFor(exchange)` at read time. */
  fundingIntervalHours?: number;
}

/** Tuple form persisted in localStorage: [rate, intervalHours]. */
type SnapshotValue = number | [number, number];

/** Decode a snapshot value into (rate, intervalHours). Tolerates the legacy
 *  bare-number shape — interval comes back as undefined in that case. */
function unpackSnapshotValue(v: unknown): { rate: number; intervalH?: number } | null {
  if (typeof v === 'number' && Number.isFinite(v)) return { rate: v };
  if (Array.isArray(v) && v.length >= 1 && typeof v[0] === 'number' && Number.isFinite(v[0])) {
    const h = typeof v[1] === 'number' && Number.isFinite(v[1]) && v[1] > 0 ? v[1] : undefined;
    return { rate: v[0], intervalH: h };
  }
  return null;
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
  try { if (localStorage.getItem(key)) return; } catch { return; }

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

  // Build compact snapshot: "SYM|EX" → rate, or "SYM|EX" → [rate, intervalH]
  // when interval is known. The tuple form keeps the historical bare-number
  // format readable (it still round-trips through JSON the same way) but
  // lets the accumulator scale non-8h venues correctly.
  const compact: Record<string, SnapshotValue> = {};
  rates.forEach(r => {
    if (!topSymbols.has(r.symbol)) return;
    const rate = parseFloat(r.fundingRate.toFixed(6));
    if (r.fundingIntervalHours != null && Number.isFinite(r.fundingIntervalHours) && r.fundingIntervalHours > 0) {
      compact[`${r.symbol}|${r.exchange}`] = [rate, r.fundingIntervalHours];
    } else {
      compact[`${r.symbol}|${r.exchange}`] = rate;
    }
  });

  try {
    localStorage.setItem(key, JSON.stringify({ t: roundTo5Min(now), r: compact }));
    // Invalidate accumulated funding cache so new data is picked up immediately
    _accBatchCache = null;
  } catch {
    // localStorage full — prune aggressively
    pruneOldSnapshots(14 * 24 * 60 * 60 * 1000); // Keep only 14 days
    try {
      localStorage.setItem(key, JSON.stringify({ t: roundTo5Min(now), r: compact }));
      _accBatchCache = null;
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
 *
 * Sparkline / chart consumers only care about the rate at each timestamp,
 * not the venue's settlement interval — so the returned shape stays
 * `{ t, rate }`. Use `getAccumulatedFunding*` if you need interval-aware sums.
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
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.t < cutoff) continue;

      const unpacked = unpackSnapshotValue(data.r[lookupKey]);
      if (unpacked) {
        points.push({ t: data.t, rate: unpacked.rate });
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
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.t < cutoff) continue;

      for (const [k, v] of Object.entries(data.r)) {
        if (!k.startsWith(`${symbol}|`)) continue;
        const unpacked = unpackSnapshotValue(v);
        if (!unpacked) continue;
        if (!pointsMap.has(data.t)) pointsMap.set(data.t, []);
        pointsMap.get(data.t)!.push(unpacked.rate);
      }
    } catch {
      // skip
    }
  }

  return Array.from(pointsMap.entries())
    .map(([t, rates]) => ({
      t,
      rate: rates.reduce((a, b) => a + b, 0) / (rates.length || 1),
    }))
    .sort((a, b) => a.t - b.t);
}

/**
 * Calculate accumulated funding over a time period.
 *
 * Groups snapshots into 8h period buckets, averages per bucket, then
 * multiplies each contribution by `(8 / intervalHours)` so non-8h venues
 * scale correctly:
 *   - 1h venue (HL, dYdX, Aevo, Coinbase): ×8 per bucket (8 settlements)
 *   - 4h venue (Kraken):                   ×2 per bucket (2 settlements)
 *   - 8h venue (most majors):              ×1 per bucket (baseline)
 *
 * Interval is read from the snapshot tuple when available; otherwise falls
 * back to `intervalHoursFor(exchange)` so legacy bare-number snapshots
 * still get the per-exchange default applied.
 */
export function getAccumulatedFunding(symbol: string, exchange: string, days: number): number {
  if (typeof window === 'undefined') return 0;

  // Scan localStorage once to collect (timestamp, rate, intervalH) tuples
  // for this pair. We need the interval per point so a venue that adopted
  // a different interval mid-history (rare but possible) is averaged
  // honestly within each bucket.
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const lookupKey = `${symbol}|${exchange}`;
  const exchangeDefault = intervalHoursFor(exchange);

  // periodStart → array of (rate, intervalH) so we can average each bucket
  // with interval-weighted scaling.
  const periodMap = new Map<number, { rate: number; intervalH: number }[]>();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.t < cutoff) continue;

      const unpacked = unpackSnapshotValue(data.r[lookupKey]);
      if (!unpacked) continue;

      const periodStart = Math.floor(data.t / EIGHT_HOURS_MS) * EIGHT_HOURS_MS;
      const intervalH = unpacked.intervalH ?? exchangeDefault;
      if (!periodMap.has(periodStart)) periodMap.set(periodStart, []);
      periodMap.get(periodStart)!.push({ rate: unpacked.rate, intervalH });
    } catch {
      // skip
    }
  }

  // For each bucket: avg the rates, divide by the avg interval, multiply
  // by the bucket size (8h). That's the per-bucket compounded contribution.
  let accumulated = 0;
  periodMap.forEach(entries => {
    if (entries.length === 0) return;
    const avgRate = entries.reduce((sum, e) => sum + e.rate, 0) / entries.length;
    const avgIntervalH = entries.reduce((sum, e) => sum + e.intervalH, 0) / entries.length;
    if (avgIntervalH <= 0) return;
    accumulated += avgRate * (PERIOD_BUCKET_HOURS / avgIntervalH);
  });

  return accumulated;
}

// In-memory cache for accumulated funding to avoid rescanning localStorage every 30s
let _accBatchCache: { result: Map<string, AccumulatedFunding>; ts: number } | null = null;
const ACC_BATCH_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Efficient batch calculation of accumulated funding for multiple pairs.
 * Scans localStorage once and computes 1D/7D/30D accumulated for each pair.
 * Results are cached in memory for 5 minutes.
 */
export function getAccumulatedFundingBatch(
  pairs: { symbol: string; exchange: string }[]
): Map<string, AccumulatedFunding> {
  if (typeof window === 'undefined') return new Map();
  if (pairs.length === 0) return new Map();

  // Return cached result if fresh AND all requested pairs are present in cache
  if (_accBatchCache && Date.now() - _accBatchCache.ts < ACC_BATCH_TTL) {
    const allCached = pairs.every(p => _accBatchCache!.result.has(`${p.symbol}|${p.exchange}`));
    if (allCached) return _accBatchCache.result;
  }

  const now = Date.now();
  const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
  const cutoff1d = now - 1 * 24 * 60 * 60 * 1000;

  // Build lookup set + per-pair exchange-default interval (used when the
  // snapshot doesn't carry the interval inline — legacy bare-number rows).
  const pairKeys = new Set(pairs.map(p => `${p.symbol}|${p.exchange}`));
  const exchangeDefaults = new Map<string, number>();
  pairs.forEach(p => {
    const k = `${p.symbol}|${p.exchange}`;
    if (!exchangeDefaults.has(k)) exchangeDefaults.set(k, intervalHoursFor(p.exchange));
  });

  // Collect all history points per pair, grouped by 8h period.
  // Each entry carries the interval so we can scale buckets independently
  // even if a venue's interval changed mid-window.
  const pairPeriods = new Map<string, Map<number, { rate: number; intervalH: number }[]>>();
  pairKeys.forEach(pk => pairPeriods.set(pk, new Map()));

  // Single scan of localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.t < cutoff30d) continue;

      for (const [k, v] of Object.entries(data.r)) {
        if (!pairKeys.has(k)) continue;
        const unpacked = unpackSnapshotValue(v);
        if (!unpacked) continue;
        const periodStart = Math.floor(data.t / EIGHT_HOURS_MS) * EIGHT_HOURS_MS;
        const periods = pairPeriods.get(k)!;
        if (!periods.has(periodStart)) periods.set(periodStart, []);
        const intervalH = unpacked.intervalH ?? exchangeDefaults.get(k) ?? 8;
        periods.get(periodStart)!.push({ rate: unpacked.rate, intervalH });
      }
    } catch {
      // skip corrupt entries
    }
  }

  // Calculate accumulated for each pair across 1D/7D/30D windows.
  // Per-bucket contribution = avgRate × (8h / avgIntervalH), so a 1h venue
  // contributes 8× its avg rate inside the 8h bucket, an 8h venue 1×, etc.
  const result = new Map<string, AccumulatedFunding>();

  pairPeriods.forEach((periods, pairKey) => {
    let d1 = 0, d7 = 0, d30 = 0;

    periods.forEach((entries, periodStart) => {
      if (entries.length === 0) return;
      const avgRate = entries.reduce((sum, e) => sum + e.rate, 0) / entries.length;
      const avgIntervalH = entries.reduce((sum, e) => sum + e.intervalH, 0) / entries.length;
      if (avgIntervalH <= 0) return;
      const contribution = avgRate * (PERIOD_BUCKET_HOURS / avgIntervalH);
      d30 += contribution;
      if (periodStart >= cutoff7d) d7 += contribution;
      if (periodStart >= cutoff1d) d1 += contribution;
    });

    if (d1 !== 0 || d7 !== 0 || d30 !== 0) {
      result.set(pairKey, { d1, d7, d30 });
    }
  });

  // Merge new results into existing cache so different callers requesting
  // different pair sets don't overwrite each other's cached data
  if (_accBatchCache && Date.now() - _accBatchCache.ts < ACC_BATCH_TTL) {
    result.forEach((v, k) => _accBatchCache!.result.set(k, v));
    _accBatchCache.ts = Date.now();
  } else {
    _accBatchCache = { result, ts: Date.now() };
  }
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

  keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
}

// ─── DB-backed functions (prefer over localStorage when DB is available) ────

/**
 * Fetch funding history from the database API.
 * Falls back to localStorage if DB is not available or returns empty.
 */
export async function fetchFundingHistoryFromDB(
  symbol: string,
  exchange?: string,
  days: number = 30
): Promise<HistoryPoint[]> {
  try {
    const params = new URLSearchParams({ symbol, days: String(days) });
    if (exchange) params.set('exchange', exchange);

    const res = await fetch(`/api/history/funding?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.points && json.points.length > 0) {
      return json.points;
    }
  } catch {
    // DB unavailable — fall through to localStorage
  }

  // Fallback to localStorage
  if (exchange) {
    return getFundingHistory(symbol, exchange, days);
  }
  return getSymbolHistory(symbol, days);
}

/**
 * Fetch accumulated funding from DB, falling back to localStorage.
 *
 * Uses the same 8h-bucket-with-interval-scaling math as
 * `getAccumulatedFundingBatch`. The DB endpoint only returns raw points,
 * not the per-point interval, so we apply the per-exchange default via
 * `intervalHoursFor`. That's accurate for the >99% case where a venue
 * sticks to one interval — and is the same approximation /api/history
 * uses on the server side, so the two paths agree.
 */
export async function fetchAccumulatedFromDB(
  symbol: string,
  exchange: string
): Promise<AccumulatedFunding> {
  try {
    const res = await fetch(
      `/api/history/funding?symbol=${symbol}&exchange=${exchange}&days=30`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const points: HistoryPoint[] = json.points || [];

    if (points.length > 0) {
      const now = Date.now();
      const cutoff1d = now - 1 * 24 * 60 * 60 * 1000;
      const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
      const intervalH = intervalHoursFor(exchange);
      const periodMultiplier = intervalH > 0 ? PERIOD_BUCKET_HOURS / intervalH : 1;

      // Group into 8h periods and sum (with venue-aware scaling)
      const periodMap = new Map<number, number[]>();
      points.forEach(p => {
        const periodStart = Math.floor(p.t / EIGHT_HOURS_MS) * EIGHT_HOURS_MS;
        if (!periodMap.has(periodStart)) periodMap.set(periodStart, []);
        periodMap.get(periodStart)!.push(p.rate);
      });

      let d1 = 0, d7 = 0, d30 = 0;
      periodMap.forEach((rates, periodStart) => {
        const avgRate = rates.reduce((sum, r) => sum + r, 0) / (rates.length || 1);
        const contribution = avgRate * periodMultiplier;
        d30 += contribution;
        if (periodStart >= cutoff7d) d7 += contribution;
        if (periodStart >= cutoff1d) d1 += contribution;
      });

      return { d1, d7, d30 };
    }
  } catch {
    // DB unavailable
  }

  // Fallback to localStorage
  return {
    d1: getAccumulatedFunding(symbol, exchange, 1),
    d7: getAccumulatedFunding(symbol, exchange, 7),
    d30: getAccumulatedFunding(symbol, exchange, 30),
  };
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
