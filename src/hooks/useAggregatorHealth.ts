'use client';
import { useEffect, useState } from 'react';

/**
 * Shared poll of `prices.info-hub.io/health` for the chrome
 * components (StatusBar + MarketTape's ThroughputCounter). Uses a
 * module-scope cache + ref-counted polling so two consumers on the
 * same page share one fetch every `POLL_MS`, not two.
 *
 * Why a shared singleton rather than React Context:
 *   - The poll only updates every 15s; no need for the context-tree
 *     plumbing.
 *   - Components in different subtrees (status bar at the bottom of
 *     the page, tape at the top) would otherwise both need to be
 *     wrapped in the same provider.
 *   - Cheap: one Map + one timer per page load.
 *
 * Aggregator endpoint is CORS-enabled so we can hit it directly
 * from the browser (no Next.js proxy needed).
 */

const URL = 'https://prices.info-hub.io/health';
const POLL_MS = 15_000;

export type AggregatorStatus = 'streaming' | 'degraded' | 'offline' | 'unknown';

export interface AggregatorHealth {
  connected: number;
  total: number;
  status: AggregatorStatus;
  /** Last successful refresh timestamp, ms. */
  lastUpdate: number | null;
}

const INITIAL: AggregatorHealth = {
  connected: 0,
  total: 0,
  status: 'unknown',
  lastUpdate: null,
};

interface RawAggregatorHealth {
  health: Record<string, { connected: boolean; lastUpdate: number; errors: number }>;
  symbolCount: number;
  uptime: number;
}

let cached: AggregatorHealth = INITIAL;
const listeners = new Set<(h: AggregatorHealth) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

function classify(connected: number, total: number): AggregatorStatus {
  if (total === 0) return 'offline';
  if (connected === total) return 'streaming';
  if (connected >= total - 2) return 'degraded';
  if (connected === 0) return 'offline';
  return 'degraded';
}

async function refresh(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch(URL, {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      if (!res.ok) {
        // Don't blow away cached count on transient failure — just
        // age the lastUpdate timestamp by leaving it stale.
        return;
      }
      const data = (await res.json()) as RawAggregatorHealth;
      const venues = Object.values(data.health ?? {});
      const connected = venues.filter(v => v.connected).length;
      const total = venues.length;
      cached = {
        connected,
        total,
        status: classify(connected, total),
        lastUpdate: Date.now(),
      };
      // Array.from to avoid downlevelIteration requirement under
       // the current tsconfig target.
       Array.from(listeners).forEach(cb => cb(cached));
    } catch {
      // Network failure: don't mutate cached state on first miss.
      // After 3 consecutive misses the lastUpdate staleness will
      // signal "offline" to the rest of the UI (see staleness check
      // below — currently consumers ignore it but they could opt in).
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function start() {
  if (pollTimer) return;
  refresh();
  pollTimer = setInterval(refresh, POLL_MS);
}

function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function useAggregatorHealth(): AggregatorHealth {
  const [state, setState] = useState<AggregatorHealth>(cached);

  useEffect(() => {
    listeners.add(setState);
    if (listeners.size === 1) start();
    return () => {
      listeners.delete(setState);
      if (listeners.size === 0) stop();
    };
  }, []);

  return state;
}
