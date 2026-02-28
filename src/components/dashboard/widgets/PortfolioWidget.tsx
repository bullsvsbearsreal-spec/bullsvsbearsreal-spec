'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Briefcase, TrendingUp, TrendingDown } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { useUserData } from '../useUserData';
import WidgetSkeleton from '../WidgetSkeleton';

interface HoldingRow {
  symbol: string;
  qty: number;
  currentValue: number;
  pnlPercent: number;
}

export default function PortfolioWidget({ wide }: { wide?: boolean }) {
  const userData = useUserData();
  const [rows, setRows] = useState<HoldingRow[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const mountedRef = useRef(true);

  const holdings = userData?.portfolio ?? [];
  // Stable reference: only recompute when holdings content actually changes
  const holdingsKey = useMemo(() => JSON.stringify(holdings), [holdings]);

  useEffect(() => {
    mountedRef.current = true;
    if (holdings.length === 0) { setRows([]); setTotalValue(0); return; }

    const load = async () => {
      try {
        const res = await fetch('/api/tickers');
        if (!res.ok) return;
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data || [];
        if (!Array.isArray(data) || !mountedRef.current) return;

        const priceMap = new Map<string, number>();
        for (const t of data) {
          const sym = (t.symbol || '').replace(/USDT$/, '');
          if (!priceMap.has(sym)) {
            priceMap.set(sym, t.price || t.lastPrice || 0);
          }
        }

        let total = 0;
        const mapped: HoldingRow[] = holdings.map((h: any) => {
          const price = priceMap.get(h.symbol) || 0;
          const qty = Number(h.qty) || 0;
          const avgPrice = Number(h.avgPrice) || 0;
          const currentValue = qty * price;
          const pnlPercent = avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
          total += currentValue;
          return { symbol: h.symbol, qty, currentValue, pnlPercent };
        });

        if (mountedRef.current) {
          setRows(mapped);
          setTotalValue(total);
        }
      } catch (err) { console.error('[Portfolio] fetch error:', err); }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { mountedRef.current = false; clearInterval(iv); };
  }, [holdingsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (userData === null) return <WidgetSkeleton variant="list" rows={4} />;

  if (holdings.length === 0) {
    return (
      <div className="text-center py-3">
        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-2">
          <Briefcase className="w-4 h-4 text-purple-400/60" />
        </div>
        <p className="text-xs text-neutral-500 mb-0.5">No holdings added</p>
        <p className="text-[10px] text-neutral-600 mb-2">Add positions to see value and P&L</p>
        <Link href="/portfolio" className="text-[10px] text-hub-yellow hover:underline font-medium">+ Add holdings</Link>
      </div>
    );
  }

  const fmtVal = (v: number) => {
    if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
    if (v >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'K';
    return '$' + v.toFixed(2);
  };

  const limit = wide ? 6 : 4;
  const visible = rows.slice(0, limit);

  return (
    <div>
      {/* Total value header */}
      <div className="mb-2">
        <p className="text-lg font-bold text-white tabular-nums">{fmtVal(totalValue)}</p>
        <p className="text-[10px] text-neutral-600">Total value</p>
      </div>

      {/* Per-holding rows */}
      <div className="space-y-0.5">
        {visible.map((h) => {
          const up = h.pnlPercent >= 0;
          return (
            <div key={h.symbol} className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-1.5 min-w-0">
                <TokenIconSimple symbol={h.symbol} size={14} />
                <span className="text-xs text-neutral-300 truncate">{h.symbol}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white font-medium tabular-nums">{fmtVal(h.currentValue)}</span>
                <span className={`flex items-center gap-0.5 text-[10px] font-medium tabular-nums w-14 justify-end ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {up ? '+' : ''}{h.pnlPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {holdings.length > limit && (
        <Link href="/portfolio" className="block text-center mt-1.5 text-[10px] text-hub-yellow hover:underline">
          View all {holdings.length} holdings
        </Link>
      )}
    </div>
  );
}
