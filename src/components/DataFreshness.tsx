'use client';

import { useState, useEffect } from 'react';

interface DataFreshnessProps {
  exchangeCount: number;
  lastUpdated: Date | number | null;
  sources?: string[];
}

function formatAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function DataFreshness({ exchangeCount, lastUpdated, sources }: DataFreshnessProps) {
  const ts = lastUpdated instanceof Date ? lastUpdated.getTime() : lastUpdated;
  // SSR-safe: anchor `now` to `ts` so first paint computes ageMs=0
  // (green dot, "Updated 0s ago") deterministically. Drift introduced
  // by Date.now() differing across server-render and hydration time
  // produced React #425 on /home and similar dashboards. useEffect
  // syncs to real time after mount.
  const [now, setNow] = useState<number>(ts ?? 0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ageMs = ts ? now - ts : Infinity;

  const dotColor = ageMs < 120_000 ? 'bg-green-500' : ageMs < 300_000 ? 'bg-amber-500' : 'bg-red-500';

  // While data hasn't arrived yet, don't render "0 exchanges" — it
  // looks broken next to a "Loading..." label. Show "—" instead.
  // (Pages caught reading "0 exchanges | Loading..." on funding-heatmap
  // during the round-3 critic walkthrough.)
  const noData = !ts || exchangeCount <= 0;
  const sourceText = sources && sources.length > 0
    ? sources.length <= 3
      ? sources.join(', ')
      : `${sources.slice(0, 2).join(', ')} +${sources.length - 2}`
    : noData
      ? '— exchanges'
      : `${exchangeCount} exchanges`;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
      <span className={`w-1 h-1 rounded-full ${dotColor} shrink-0`} />
      <span>{sourceText}</span>
      <span className="text-neutral-700">|</span>
      <span>{ts ? `Updated ${formatAgo(ageMs)}` : 'Loading…'}</span>
    </div>
  );
}
