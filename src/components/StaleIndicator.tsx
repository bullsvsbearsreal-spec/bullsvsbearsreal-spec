'use client';

import { useState, useEffect } from 'react';

interface StaleIndicatorProps {
  lastUpdated: Date | number | null;
  isError?: boolean;
  isValidating?: boolean;
  staleThresholdMs?: number;
}

export default function StaleIndicator({
  lastUpdated,
  isError,
  isValidating,
  staleThresholdMs = 300_000,
}: StaleIndicatorProps) {
  const ts = lastUpdated instanceof Date ? lastUpdated.getTime() : lastUpdated;
  // SSR-safe: anchor `now` to `ts` so first paint computes ageMs=0
  // (no stale-warning branch) deterministically. Without this, the
  // useState(Date.now()) initial value drifts across server-render
  // and hydration time — when the drift crosses the staleThresholdMs
  // boundary the server emits "Data may be a moment behind" while
  // the client emits null (or vice-versa), tripping React #425.
  const [now, setNow] = useState<number>(ts ?? 0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (isError) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] text-red-400/80">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-breathe-fast absolute inline-flex h-full w-full rounded-full bg-red-400" />
          <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-red-400" />
        </span>
        Having trouble connecting
      </span>
    );
  }

  const ageMs = ts ? now - ts : Infinity;

  if (ageMs > staleThresholdMs) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-400/70">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_3px_rgba(251,191,36,0.3)]" />
        Data may be a moment behind
      </span>
    );
  }

  if (isValidating) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-breathe-fast absolute inline-flex h-full w-full rounded-full bg-neutral-400" />
          <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-neutral-500" />
        </span>
        Catching up...
      </span>
    );
  }

  return null;
}
