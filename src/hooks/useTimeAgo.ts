'use client';

import { useState, useEffect } from 'react';

/**
 * Returns a human-readable "Xs ago" / "Xm ago" string that ticks every second.
 * Accepts a Date | null; returns null when no date is provided yet.
 */
export function useTimeAgo(date: Date | null): string | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return null;

  const diffMs = Date.now() - date.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
