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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (isError) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Connection issue — retrying...
      </span>
    );
  }

  const ts = lastUpdated instanceof Date ? lastUpdated.getTime() : lastUpdated;
  const ageMs = ts ? now - ts : Infinity;

  if (ageMs > staleThresholdMs) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Data may be delayed
      </span>
    );
  }

  if (isValidating) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-600">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse" />
        Refreshing...
      </span>
    );
  }

  return null;
}
