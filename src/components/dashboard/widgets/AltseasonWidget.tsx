'use client';

import { useState, useEffect } from 'react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

function getLabel(val: number): { label: string; color: string } {
  if (val >= 75) return { label: 'Alt Season', color: '#22c55e' };
  if (val >= 50) return { label: 'Alt Leaning', color: '#84cc16' };
  if (val >= 25) return { label: 'BTC Leaning', color: '#f97316' };
  return { label: 'BTC Season', color: '#ef4444' };
}

export default function AltseasonWidget() {
  const [index, setIndex] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/global-stats');
        if (!res.ok) return;
        const json = await res.json();
        if (Number.isFinite(json.altcoin_season_index) && mounted) {
          setIndex(json.altcoin_season_index);
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[Altseason] error:', err); }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (index === null) return <WidgetSkeleton variant="stat" />;

  const { label, color } = getLabel(index);
  const pct = Math.min(100, Math.max(0, index));

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold" style={{ color }}>{index}</span>
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </div>

      {/* Gauge bar */}
      <div className="mt-3 relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, #ef4444, #f97316, #eab308, #84cc16, #22c55e)` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-black bg-white shadow-lg transition-all duration-500"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-red-400/60">BTC</span>
        <span className="text-[10px] text-neutral-600">% of top 100 alts outperforming BTC (90d)</span>
        <span className="text-[10px] text-green-400/60">ALT</span>
      </div>

      <div className="flex justify-end mt-1">
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
