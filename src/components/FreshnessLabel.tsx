'use client';

/**
 * Tiny "Updated 30s ago · refresh every 60s" label for tool headers.
 * Reads `ts` (unix ms) from API responses and self-updates every second.
 */

import { useState, useEffect } from 'react';

interface Props {
  /** Unix ms of when the data was fetched. */
  ts: number | null | undefined;
  /** Auto-refresh interval in ms (display hint only). */
  refreshIntervalMs?: number;
  className?: string;
}

function fmtAgo(seconds: number): string {
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function fmtInterval(ms: number): string {
  if (ms < 60_000) return `every ${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `every ${Math.round(ms / 60_000)}m`;
  return `every ${Math.round(ms / 3_600_000)}h`;
}

export default function FreshnessLabel({ ts, refreshIntervalMs, className }: Props) {
  // SSR-safe initial state: anchor to `ts` so first-paint computes
  // ageS=0 ("0s ago") deterministically on both server and client.
  // Without this, useState(() => Date.now()) drifts between SSR and
  // hydration time, producing React error #425. The first useEffect
  // tick syncs to the real wall clock 1s after mount.
  const [now, setNow] = useState<number>(ts ?? 0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (ts == null || !Number.isFinite(ts)) {
    return (
      <span className={className ?? 'text-[10px] text-neutral-600 font-mono'}>
        — never updated
      </span>
    );
  }

  const ageS = Math.max(0, Math.floor((now - ts) / 1000));
  const stale = refreshIntervalMs != null && ageS * 1000 > refreshIntervalMs * 2;
  const tone = stale ? 'text-amber-300' : 'text-neutral-500';
  const baseCls = className ?? `text-[10px] ${tone} font-mono`;

  return (
    <span className={baseCls} title={`Last refresh: ${new Date(ts).toLocaleTimeString()}`}>
      updated {fmtAgo(ageS)}
      {refreshIntervalMs != null && (
        <span className="text-neutral-700 ml-1.5">· refresh {fmtInterval(refreshIntervalMs)}</span>
      )}
    </span>
  );
}
