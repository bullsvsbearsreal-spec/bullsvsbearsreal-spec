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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ts = lastUpdated instanceof Date ? lastUpdated.getTime() : lastUpdated;
  const ageMs = ts ? now - ts : Infinity;

  const dotColor = ageMs < 120_000 ? 'bg-green-500' : ageMs < 300_000 ? 'bg-amber-500' : 'bg-red-500';

  const sourceText = sources && sources.length > 0
    ? sources.length <= 3
      ? sources.join(', ')
      : `${sources.slice(0, 2).join(', ')} +${exchangeCount - 2}`
    : `${exchangeCount} exchanges`;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
      <span className={`w-1 h-1 rounded-full ${dotColor} shrink-0`} />
      <span>{sourceText}</span>
      <span className="text-neutral-700">|</span>
      <span>{ts ? `Updated ${formatAgo(ageMs)}` : 'Loading...'}</span>
    </div>
  );
}
