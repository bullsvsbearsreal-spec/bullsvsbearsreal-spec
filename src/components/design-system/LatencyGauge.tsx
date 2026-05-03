'use client';
import { useEffect, useState } from 'react';

interface LatencyGaugeProps { label: string; base: number; spread?: number; color?: string; className?: string; }

export default function LatencyGauge({ label, base, spread = 12, color = 'var(--pump-mild)', className }: LatencyGaugeProps) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setV(base + Math.floor(Math.random() * spread * 2 - spread)), 750);
    return () => clearInterval(id);
  }, [base, spread]);
  const bad = v > base + spread * 0.7;
  const warn = v > base + spread * 0.3;
  const c = bad ? 'var(--rekt-mild)' : warn ? 'var(--hub-accent)' : color;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color: 'var(--fg-subtle)' }}>{label}</span>
      <span style={{ color: c, fontVariantNumeric: 'tabular-nums', fontWeight: 600, transition: 'color 220ms' }}>{v}ms</span>
    </span>
  );
}
