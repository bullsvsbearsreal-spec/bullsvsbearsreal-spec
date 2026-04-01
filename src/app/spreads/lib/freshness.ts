// ─── Centralized Freshness Constants ──────────────────────────────────────
// Single source of truth for all staleness/freshness thresholds across components.

/** Price is "fresh" — green indicator, fully opaque */
export const FRESH_MS = 3_000;

/** Price is "warm" — neutral indicator, normal opacity */
export const WARM_MS = 10_000;

/** Price is "stale" — red indicator, dimmed opacity */
export const STALE_MS = 30_000;

/** Price is "dead" — considered disconnected */
export const DEAD_MS = 60_000;

/** Heartbeat interval from aggregator WebSocket */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** Max time without heartbeat before considering WS disconnected */
export const HEARTBEAT_TIMEOUT_MS = 15_000;

export type FreshnessLevel = 'fresh' | 'warm' | 'stale' | 'dead';

export function getFreshness(ageMs: number): FreshnessLevel {
  if (ageMs <= FRESH_MS) return 'fresh';
  if (ageMs <= WARM_MS) return 'warm';
  if (ageMs <= STALE_MS) return 'stale';
  return 'dead';
}

export function getFreshnessColor(level: FreshnessLevel): string {
  switch (level) {
    case 'fresh': return 'text-green-400';
    case 'warm': return 'text-neutral-500';
    case 'stale': return 'text-red-400/60';
    case 'dead': return 'text-red-500/40';
  }
}

export function getFreshnessDotColor(level: FreshnessLevel): string {
  switch (level) {
    case 'fresh': return 'bg-green-400';
    case 'warm': return 'bg-neutral-600';
    case 'stale': return 'bg-red-400';
    case 'dead': return 'bg-red-500/50';
  }
}

export function getFreshnessOpacity(level: FreshnessLevel): string {
  switch (level) {
    case 'fresh': return '';
    case 'warm': return '';
    case 'stale': return 'opacity-35';
    case 'dead': return 'opacity-20';
  }
}
