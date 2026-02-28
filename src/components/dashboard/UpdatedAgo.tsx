'use client';

import { useState, useEffect } from 'react';

/**
 * Tiny "updated Xm ago" label for data-fetching widgets.
 * Accepts a timestamp (ms) and re-renders every 30s to stay fresh.
 */
export default function UpdatedAgo({ ts }: { ts: number | null }) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!ts) return;
    const iv = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, [ts]);

  if (!ts) return null;

  const seconds = Math.floor((Date.now() - ts) / 1000);
  let label: string;
  if (seconds < 10) label = 'just now';
  else if (seconds < 60) label = `${seconds}s ago`;
  else if (seconds < 3600) label = `${Math.floor(seconds / 60)}m ago`;
  else label = `${Math.floor(seconds / 3600)}h ago`;

  return (
    <span className="text-[9px] text-neutral-700 tabular-nums" title={new Date(ts).toLocaleTimeString()}>
      {label}
    </span>
  );
}
