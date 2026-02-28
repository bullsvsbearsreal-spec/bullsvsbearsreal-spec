'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WidgetSkeleton from '../WidgetSkeleton';

interface DomEntry {
  symbol: string;
  dominance: number;
}

const COLORS = ['#F7931A', '#627EEA', '#26A17B', '#E6007A', '#14F195', '#8B8B8B'];

export default function DominanceWidget() {
  const [entries, setEntries] = useState<DomEntry[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/dominance');
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.dominance || data.data || [];
        if (mounted && items.length > 0) {
          setEntries(items.slice(0, 6));
        }
      } catch (err) { console.error('[Dominance] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (entries === null) return <WidgetSkeleton variant="bar" />;

  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-neutral-500">Dominance data unavailable</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">Will refresh automatically when API responds</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-6 rounded-lg overflow-hidden mb-3">
        {entries.map((e, i) => (
          <div
            key={e.symbol}
            className="flex items-center justify-center text-[9px] font-bold text-white/80 min-w-[20px]"
            style={{
              width: `${e.dominance}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
            title={`${e.symbol}: ${e.dominance.toFixed(1)}%`}
          >
            {e.dominance > 5 ? `${e.dominance.toFixed(0)}%` : ''}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {entries.map((e, i) => (
          <div key={e.symbol} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-[10px] text-neutral-400">{e.symbol}</span>
            <span className="text-[10px] text-neutral-600">{e.dominance.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <Link href="/dominance" className="text-[10px] text-hub-yellow hover:underline mt-2 inline-block">
        View full chart
      </Link>
    </div>
  );
}
