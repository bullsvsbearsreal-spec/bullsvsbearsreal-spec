'use client';

import { useState, useEffect } from 'react';

interface ExchangeHealthDotProps {
  lastUpdated: number | null;
  exchangeName?: string;
}

/**
 * Tiny health dot for exchange data freshness.
 * Only shows amber/red dots — green (healthy) is assumed and hidden to reduce noise.
 */
export default function ExchangeHealthDot({ lastUpdated, exchangeName }: ExchangeHealthDotProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  if (!lastUpdated) {
    return (
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
        title={exchangeName ? `${exchangeName} — no data` : 'No data'}
      />
    );
  }

  const ageMs = now - lastUpdated;
  const ageSec = Math.floor(ageMs / 1000);

  // Fresh (<2min) — no dot, assume healthy
  if (ageMs < 120_000) return null;

  const ageText = ageSec < 60
    ? `${ageSec}s old`
    : ageSec < 3600
      ? `${Math.floor(ageSec / 60)}m old`
      : `${Math.floor(ageSec / 3600)}h old`;

  const label = exchangeName ? `${exchangeName} — data ${ageText}` : `Data ${ageText}`;

  // Delayed (2-5min) — amber
  if (ageMs < 300_000) {
    return (
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
        title={label}
      />
    );
  }

  // Stale (>5min) — red
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
      title={label}
    />
  );
}
