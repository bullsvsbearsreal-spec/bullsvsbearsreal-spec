'use client';
import { useEffect, useState } from 'react';

interface ThroughputCounterProps { baseline?: number; spread?: number; intervalMs?: number; suffix?: string; className?: string; }

export default function ThroughputCounter({ baseline = 1247, spread = 110, intervalMs = 420, suffix, className }: ThroughputCounterProps) {
  const [v, setV] = useState(baseline);
  useEffect(() => {
    const id = setInterval(() => setV(baseline + Math.floor(Math.random() * spread * 2 - spread)), intervalMs);
    return () => clearInterval(id);
  }, [baseline, spread, intervalMs]);
  return (
    <span className={className} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-default)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
      {v.toLocaleString()}{suffix && <span style={{ color: 'var(--fg-muted)', fontSize: 9, marginLeft: 3 }}>{suffix}</span>}
    </span>
  );
}
