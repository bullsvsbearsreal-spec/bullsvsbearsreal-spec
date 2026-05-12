'use client';
import { useAggregatorHealth } from '@/hooks/useAggregatorHealth';

interface ThroughputCounterProps {
  /** Render compact (no suffix word, narrower). */
  compact?: boolean;
  className?: string;
}

/**
 * Real-time aggregator-connection counter — shares a singleton poll
 * with StatusBar's STREAMING badge via `useAggregatorHealth`. So two
 * consumers on the same page (top chrome MarketTape + bottom chrome
 * StatusBar) share one fetch every 15s instead of doubling network
 * load.
 *
 * NOTE: this component previously rendered random wobble around
 * `baseline = 1247` every 420ms and called it "msg/s". That was
 * fake telemetry. Replaced with real venue-connectivity counts
 * via the shared health hook.
 *
 * Why no `msg/s`: the aggregator's /health surfaces a single
 * `lastUpdate` per venue (last batch ingest time), not a per-message
 * counter. Real connectivity is the most useful honest signal.
 */
export default function ThroughputCounter({ compact = false, className }: ThroughputCounterProps) {
  const { connected, total, status } = useAggregatorHealth();

  if (status === 'unknown') {
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
  const c = status === 'streaming' ? 'var(--pump-mild)'
          : status === 'degraded' ? 'var(--hub-accent)'
          : 'var(--rekt-mild)';

  return (
    <span className={className} style={{
      fontFamily: 'var(--font-mono)', fontSize: 10,
      color: 'var(--fg-default)', fontVariantNumeric: 'tabular-nums',
      fontWeight: 600,
    }}>
      <span style={{ color: c }}>{connected}</span>
      <span style={{ color: 'var(--fg-muted)' }}>/{total}</span>
      {!compact && <span style={{ color: 'var(--fg-muted)', fontSize: 9, marginLeft: 3 }}>venues</span>}
    </span>
  );
}
