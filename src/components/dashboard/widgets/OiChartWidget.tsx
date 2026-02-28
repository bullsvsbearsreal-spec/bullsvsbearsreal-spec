'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import WidgetSkeleton from '../WidgetSkeleton';

interface OiEntry {
  symbol: string;
  openInterest: number;
  oiChange24h?: number;
}

function formatOI(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function OiChartWidget() {
  const [entries, setEntries] = useState<OiEntry[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/open-interest?limit=10');
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.data || [];
        if (mounted) setEntries(items.slice(0, 8));
      } catch (err) { console.error('[OiChart] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (entries === null) return <WidgetSkeleton variant="list" rows={6} />;

  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-neutral-500">Open interest data unavailable</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">Aggregated OI will appear when exchanges respond</p>
      </div>
    );
  }

  const maxOi = Math.max(...entries.map((e) => e.openInterest || 0));

  return (
    <div>
      <div className="space-y-1.5">
        {entries.map((e, i) => {
          const pct = maxOi > 0 ? ((e.openInterest || 0) / maxOi) * 100 : 0;
          return (
            <div key={e.symbol + i} className="flex items-center gap-2 py-0.5 px-1 -mx-1 rounded-md hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-1 w-16 flex-shrink-0">
                <TokenIconSimple symbol={e.symbol?.replace(/USDT$/, '')} size={12} />
                <span className="text-[10px] text-neutral-400 truncate">{e.symbol?.replace(/USDT$/, '')}</span>
              </div>
              <div className="flex-1 h-3 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500/40"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-500 font-mono w-14 text-right">
                {formatOI(e.openInterest || 0)}
              </span>
            </div>
          );
        })}
      </div>
      <Link href="/open-interest" className="text-[10px] text-hub-yellow hover:underline mt-2 inline-block">
        View all
      </Link>
    </div>
  );
}
