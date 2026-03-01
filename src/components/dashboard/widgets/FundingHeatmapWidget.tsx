'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface FundingRate {
  symbol: string;
  exchange: string;
  fundingRate: number;
}

export default function FundingHeatmapWidget() {
  const [rates, setRates] = useState<FundingRate[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/funding?limit=30');
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.data || data.rates || [];
        if (mounted) {
          setRates(items.slice(0, 20));
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[FundingHeatmap] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (rates === null) return <WidgetSkeleton variant="heatmap" />;

  if (rates.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-neutral-500">No funding rates yet</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">Waiting for next funding update</p>
      </div>
    );
  }

  // Mini heatmap: show as colored tiles
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {rates.slice(0, 18).map((r, i) => {
          const rate = r.fundingRate; // already a percentage from the API
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
      <div className="flex items-center justify-between">
        <Link href="/funding-heatmap" className="text-[10px] text-hub-yellow hover:underline">
          View full heatmap
        </Link>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
