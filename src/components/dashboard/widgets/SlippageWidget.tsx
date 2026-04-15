'use client';

import { useState, useEffect } from 'react';
import WidgetSkeleton from '../WidgetSkeleton';
import AnimatedValue from '../AnimatedValue';
import UpdatedAgo from '../UpdatedAgo';
import { useDashboardOptional } from '../DashboardContext';

interface VenueCost {
  exchange: string;
  available: boolean;
  fee: number;
  spread: number;
  priceImpact: number;
  totalCost: number;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function SlippageWidget({ wide, widgetId }: { wide?: boolean; widgetId?: string }) {
  const ctx = useDashboardOptional();
  const symbol = (widgetId && ctx) ? ctx.getWidgetSymbol(widgetId) : 'BTC';

  const [venues, setVenues] = useState<VenueCost[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setVenues(null);
    const load = async () => {
      try {
        const res = await fetch(`/api/execution-costs?asset=${symbol}&size=100000&direction=long`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        const available = (json.venues || [])
          .filter((v: VenueCost) => v.available)
          .sort((a: VenueCost, b: VenueCost) => a.totalCost - b.totalCost);
        setVenues(available);
        setUpdatedAt(Date.now());
      } catch (err) {
        console.error(`[SlippageWidget] fetch error for ${symbol}:`, err);
      }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [symbol]);

  if (!venues) return <WidgetSkeleton variant="list" rows={3} />;

  const top = venues.slice(0, wide ? 5 : 3);

  if (top.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-neutral-500">No execution data for {symbol}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-400">{symbol} @ $100K</span>
        <UpdatedAgo ts={updatedAt} />
      </div>

      <div className="space-y-1.5">
        {top.map((v, i) => (
          <div key={v.exchange} className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-xs w-5">{MEDAL[i] ?? <span className="text-neutral-600 text-[10px]">#{i + 1}</span>}</span>
              <span className="text-xs text-neutral-300">{v.exchange}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-neutral-500" title="Fee">F:{v.fee.toFixed(3)}%</span>
              <span className="text-neutral-500" title="Spread">S:{v.spread.toFixed(4)}%</span>
              <AnimatedValue
                value={v.totalCost}
                format={(val) => `${val.toFixed(4)}%`}
                className={`font-medium ${v.totalCost < 0.05 ? 'text-green-400' : v.totalCost < 0.1 ? 'text-hub-yellow' : 'text-red-400'}`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-right mt-2">
        <a href="/execution-costs" className="text-[10px] text-hub-yellow hover:text-hub-yellow-light transition-colors">
          View full analysis →
        </a>
      </div>
    </div>
  );
}
