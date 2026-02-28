'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Star, TrendingUp, TrendingDown } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { useUserData } from '../useUserData';
import WidgetSkeleton from '../WidgetSkeleton';

interface TickerRow {
  symbol: string;
  price: number;
  change: number;
}

export default function WatchlistWidget({ wide }: { wide?: boolean }) {
  const userData = useUserData();
  const [tickers, setTickers] = useState<TickerRow[]>([]);
  const mountedRef = useRef(true);

  const watchlist = userData?.watchlist ?? [];

  // Fetch live prices for watchlist symbols
  useEffect(() => {
    mountedRef.current = true;
    if (watchlist.length === 0) { setTickers([]); return; }

    const load = async () => {
      try {
        const res = await fetch('/api/tickers');
        if (!res.ok) return;
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data || [];
        if (!Array.isArray(data) || !mountedRef.current) return;

        const map = new Map<string, { price: number; change: number }>();
        for (const t of data) {
          const sym = (t.symbol || '').replace(/USDT$/, '');
          if (!map.has(sym)) {
            map.set(sym, {
              price: t.price || t.lastPrice || 0,
              change: t.priceChangePercent ?? t.change24h ?? 0,
            });
          }
        }

        const rows: TickerRow[] = watchlist
          .map((sym) => {
            const tick = map.get(sym);
            return tick ? { symbol: sym, price: tick.price, change: tick.change } : null;
          })
          .filter(Boolean) as TickerRow[];

        if (mountedRef.current) setTickers(rows);
      } catch (err) { console.error('[Watchlist] fetch error:', err); }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { mountedRef.current = false; clearInterval(iv); };
  }, [watchlist.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (userData === null) return <WidgetSkeleton variant="list" rows={5} />;

  if (watchlist.length === 0) {
    return (
      <div className="text-center py-3">
        <div className="w-8 h-8 rounded-full bg-hub-yellow/10 flex items-center justify-center mx-auto mb-2">
          <Star className="w-4 h-4 text-hub-yellow/60" />
        </div>
        <p className="text-xs text-neutral-500 mb-0.5">No symbols added</p>
        <p className="text-[10px] text-neutral-600 mb-2">Add coins to see live prices here</p>
        <Link href="/watchlist" className="text-[10px] text-hub-yellow hover:underline font-medium">+ Add symbols</Link>
      </div>
    );
  }

  const limit = wide ? 8 : 5;
  const visible = tickers.slice(0, limit);

  const fmtPrice = (p: number) => {
    if (p >= 1000) return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (p >= 1) return '$' + p.toFixed(2);
    return '$' + p.toPrecision(4);
  };

  return (
    <div>
      <div className="space-y-0.5">
        {visible.map((t) => {
          const up = t.change >= 0;
          return (
            <div key={t.symbol} className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-1.5 min-w-0">
                <TokenIconSimple symbol={t.symbol} size={14} />
                <span className="text-xs text-neutral-300 truncate">{t.symbol}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white font-medium tabular-nums">{fmtPrice(t.price)}</span>
                <span className={`flex items-center gap-0.5 text-[10px] font-medium tabular-nums w-14 justify-end ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {up ? '+' : ''}{t.change.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {watchlist.length > limit && (
        <Link href="/watchlist" className="block text-center mt-1.5 text-[10px] text-hub-yellow hover:underline">
          View all {watchlist.length} symbols
        </Link>
      )}
    </div>
  );
}
