'use client';
import { useEffect, useState } from 'react';

interface AggregatorHealth {
  health: Record<string, { connected: boolean; lastUpdate: number; errors: number }>;
  symbolCount: number;
  uptime: number;
}

interface ThroughputCounterProps {
  /** Render compact (no suffix word, narrower). */
  compact?: boolean;
  className?: string;
}

/**
 * Real-time aggregator pulse — fetches `prices.info-hub.io/health` and
 * surfaces actual venue connectivity (e.g. "32/32 live"). CORS-enabled
 * on the aggregator, so we can hit it directly from the browser
 * without a Next.js proxy.
 *
 * NOTE: this component previously rendered random wobble around a
 * hardcoded `baseline` (default 1247) every 420ms and called it
 * "msg/s". That was misleading telemetry — no real measurement was
 * happening. Replaced with real venue-connection counts here.
 *
 * Why no msg/s: the aggregator's /health endpoint surfaces a single
 * `lastUpdate` per venue (last batch ingest time), not a per-message
 * counter. We can't derive msg/s from that without inflating the
 * polling cadence beyond what's friendly to the droplet. Real
 * connectivity is the most useful honest signal we can offer.
 */
export default function ThroughputCounter({ compact = false, className }: ThroughputCounterProps) {
  const [state, setState] = useState<{ connected: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('https://prices.info-hub.io/health', {
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as AggregatorHealth;
        if (cancelled) return;
        const venues = Object.values(data.health ?? {});
        setState({
          connected: venues.filter(v => v.connected).length,
          total: venues.length,
        });
      } catch {
        // Aggregator unreachable — leave previous value in place so the
        // chrome doesn't flicker to '—' on every transient network blip.
      }
    }

    poll();
    const id = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (state == null) {
    return (
      <span className={className} style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--fg-faint)', fontVariantNumeric: 'tabular-nums',
      }}>
        —
      </span>
    );
  }

  // Color the connected count based on health.
  const allHealthy = state.connected === state.total;
  const mostlyHealthy = state.connected >= state.total - 2;
  const c = allHealthy ? 'var(--pump-mild)'
          : mostlyHealthy ? 'var(--hub-accent)'
          : 'var(--rekt-mild)';

  return (
    <span className={className} style={{
      fontFamily: 'var(--font-mono)', fontSize: 10,
      color: 'var(--fg-default)', fontVariantNumeric: 'tabular-nums',
      fontWeight: 600,
    }}>
      <span style={{ color: c }}>{state.connected}</span>
      <span style={{ color: 'var(--fg-muted)' }}>/{state.total}</span>
      {!compact && <span style={{ color: 'var(--fg-muted)', fontSize: 9, marginLeft: 3 }}>venues</span>}
    </span>
  );
}
