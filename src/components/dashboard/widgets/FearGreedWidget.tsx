'use client';

import { useState, useEffect } from 'react';

const COLORS: Record<string, string> = {
  'Extreme Fear': 'text-red-400',
  Fear: 'text-orange-400',
  Neutral: 'text-yellow-400',
  Greed: 'text-green-400',
  'Extreme Greed': 'text-emerald-400',
};

function getLabel(val: number): string {
  if (val <= 20) return 'Extreme Fear';
  if (val <= 40) return 'Fear';
  if (val <= 60) return 'Neutral';
  if (val <= 80) return 'Greed';
  return 'Extreme Greed';
}

export default function FearGreedWidget() {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/fear-greed');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setValue(data.value ?? data.fgi?.now?.value ?? null);
      } catch {}
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (value === null) {
    return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  const label = getLabel(value);
  const color = COLORS[label] || 'text-neutral-400';

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span className={`text-xs font-medium ${color}`}>{label}</span>
      </div>
      {/* Simple bar */}
      <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${value}%`,
            background: value <= 25 ? '#ef4444' : value <= 50 ? '#f59e0b' : value <= 75 ? '#22c55e' : '#10b981',
          }}
        />
      </div>
    </div>
  );
}
