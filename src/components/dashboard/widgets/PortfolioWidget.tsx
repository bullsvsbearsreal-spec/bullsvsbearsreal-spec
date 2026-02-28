'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Briefcase, TrendingUp, TrendingDown } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { useUserData } from '../useUserData';

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
      } catch {}
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { mountedRef.current = false; clearInterval(iv); };
  }, [JSON.stringify(holdings)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (userData === null) {
    return <div className="h-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (holdings.length === 0) {
    return (
      <div className="text-center py-2">
        <Briefcase className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No holdings yet</p>
        <Link href="/portfolio" className="text-[10px] text-hub-yellow hover:underline">Add holdings</Link>
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
            <div key={h.symbol} className="flex items-center justify-between py-0.5">
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
