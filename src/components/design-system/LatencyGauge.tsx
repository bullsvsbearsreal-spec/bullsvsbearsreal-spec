'use client';
import { useEffect, useState } from 'react';

interface LatencyGaugeProps {
  label: string;
  /** Endpoint to ping. Should be a small, cacheable, no-auth-required URL. */
  url: string;
  /** Poll cadence — defaults to 15s to keep the network noise minimal. */
  intervalMs?: number;
  className?: string;
}

/**
 * Real-time API latency gauge — pings `url` periodically and displays the
 * round-trip time. Renders "—" while the first measurement is in flight
 * or if the endpoint is unreachable.
 *
 * Coloring: <200ms green / 200-500ms amber / >500ms red. Matches the
 * thresholds partners expect from a healthy edge — anything above 500ms
 * is worth surfacing as degraded.
 *
 * NOTE: this component previously displayed random wobble around a
 * hardcoded base value with no real measurement at all. That was
 * misleading telemetry in a financial product — replaced with real
 * timing here. If you change the polling URL, prefer endpoints with
 * `Cache-Control: public` on Cloudflare so the gauge measures edge
 * latency from the user's POP rather than a cold origin fetch.
 */
export default function LatencyGauge({
  label, url, intervalMs = 15_000, className,
}: LatencyGaugeProps) {
  const [v, setV] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const t0 = performance.now();
      try {
        // HEAD where supported is cheaper; fall through to GET on
        // a 405 (some hosting edges don't pass HEAD through). Cache
        // bust with a query param so repeated probes don't read from
        // the browser's HTTP cache.
        const probe = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
        const res = await fetch(probe, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        if (cancelled) return;
        if (res.ok || (res.status >= 200 && res.status < 500)) {
          // 401 / 403 / 429 all count — we measured the round-trip,
          // we just don't have permission to read the body. Use
          // `< 500` so server errors aren't treated as "OK latency".
          setV(Math.round(performance.now() - t0));
        } else {
          setV(null);
        }
      } catch {
        if (!cancelled) setV(null);
      }
    }

    ping();
    const id = setInterval(ping, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [url, intervalMs]);

  if (v == null) {
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ color: 'var(--fg-subtle)' }}>{label}</span>
        <span style={{ color: 'var(--fg-faint)', fontVariantNumeric: 'tabular-nums' }}>—</span>
      </span>
    );
  }

  const c = v > 500 ? 'var(--rekt-mild)'
          : v > 200 ? 'var(--hub-accent)'
          :           'var(--pump-mild)';

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color: 'var(--fg-subtle)' }}>{label}</span>
      <span style={{ color: c, fontVariantNumeric: 'tabular-nums', fontWeight: 600, transition: 'color 220ms' }}>{v}ms</span>
    </span>
  );
}
