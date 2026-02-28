'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FundingRate {
  symbol: string;
  exchange: string;
  rate: number;
}

export default function FundingHeatmapWidget() {
  const [rates, setRates] = useState<FundingRate[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/funding?limit=30');
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.data || data.rates || [];
        if (mounted) setRates(items.slice(0, 20));
      } catch (err) { console.error('[FundingHeatmap] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (rates === null) {
    return <div className="h-24 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (rates.length === 0) {
    return <p className="text-xs text-neutral-600 text-center py-4">No funding data</p>;
  }

  // Mini heatmap: show as colored tiles
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {rates.slice(0, 18).map((r, i) => {
          const pct = r.rate * 100; // convert to percentage if needed
          const rate = Math.abs(pct) > 1 ? pct / 100 : pct; // normalize
          const color = rate > 0.05
            ? 'bg-green-500/40 text-green-300'
            : rate > 0.01
              ? 'bg-green-500/20 text-green-400/70'
              : rate < -0.05
                ? 'bg-red-500/40 text-red-300'
                : rate < -0.01
                  ? 'bg-red-500/20 text-red-400/70'
                  : 'bg-white/[0.04] text-neutral-500';

          return (
            <div
              key={`${r.symbol}-${r.exchange}-${i}`}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${color}`}
              title={`${r.symbol} ${r.exchange}: ${rate.toFixed(4)}%`}
            >
              {r.symbol?.replace(/USDT$/, '').slice(0, 5)}
            </div>
          );
        })}
      </div>
      <Link href="/funding-heatmap" className="text-[10px] text-hub-yellow hover:underline">
        View full heatmap
      </Link>
    </div>
  );
}
