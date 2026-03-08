'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface StablecoinInfo {
  symbol: string;
  name: string;
  mcap: number;
  change7d: number | null;  // percentage
}

function fmtCap(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export default function StablecoinFlowsWidget() {
  const [coins, setCoins] = useState<StablecoinInfo[] | null>(null);
  const [totalCap, setTotalCap] = useState<number>(0);
  const [totalChange, setTotalChange] = useState<number>(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/stablecoins');
        if (!res.ok) return;
        const json = await res.json();
        const data: any[] = json?.stablecoins || [];

        const mapped: StablecoinInfo[] = data.slice(0, 6).map((c: any) => ({
          symbol: c.symbol || '',
          name: c.name || '',
          mcap: c.mcap || 0,
          change7d: typeof c.change7d === 'number' ? c.change7d : null,
        }));

        // Compute total mcap and weighted average 7d change
        let cap = 0;
        let weightedChange = 0;
        let weightSum = 0;
        for (const c of mapped) {
          cap += c.mcap;
          if (c.change7d !== null && c.mcap > 0) {
            weightedChange += c.change7d * c.mcap;
            weightSum += c.mcap;
          }
        }
        const avgChange = weightSum > 0 ? weightedChange / weightSum : 0;

        if (mounted) {
          setCoins(mapped);
          setTotalCap(cap);
          setTotalChange(avgChange);
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[StablecoinFlows] error:', err); }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!coins) return <WidgetSkeleton variant="list" />;

  const flowDir = totalChange > 0 ? 'inflow' : totalChange < 0 ? 'outflow' : 'neutral';

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-white">{fmtCap(totalCap)}</span>
        <div className={`flex items-center gap-0.5 text-xs font-medium ${
          flowDir === 'inflow' ? 'text-green-400' :
          flowDir === 'outflow' ? 'text-red-400' : 'text-neutral-500'
        }`}>
          {flowDir === 'inflow' ? <TrendingUp className="w-3 h-3" /> :
           flowDir === 'outflow' ? <TrendingDown className="w-3 h-3" /> :
           <Minus className="w-3 h-3" />}
          {fmtPct(totalChange)} 7d
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {coins.map(c => (
          <div key={c.symbol} className="flex items-center gap-2 text-xs py-0.5">
            <span className="text-neutral-300 font-medium w-12 flex-shrink-0">{c.symbol}</span>
            <span className="flex-1 text-neutral-500">{fmtCap(c.mcap)}</span>
            <span className={`font-mono text-[10px] ${
              c.change7d === null ? 'text-neutral-600' :
              c.change7d >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {c.change7d !== null ? fmtPct(c.change7d) : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-1.5">
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
