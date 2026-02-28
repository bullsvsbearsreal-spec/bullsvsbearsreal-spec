'use client';

import { useState, useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface Liq {
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  usdValue?: number;
  time?: number;
}

export default function LiquidationsWidget({ wide }: { wide?: boolean }) {
  const [liqs, setLiqs] = useState<Liq[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const prevFirstTs = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/liquidations?symbol=BTC&limit=10');
        if (!res.ok) return;
        const json = await res.json();
        // API returns { symbol, exchange, data: [...], meta: {...} }
        const rawItems = json?.data || [];
        const symbol = json?.symbol || 'BTC';
        const items: Liq[] = rawItems.map((d: any) => ({
          symbol,
          side: d.side || 'long',
          quantity: d.size || 0,
          price: d.price || 0,
          usdValue: d.value || 0,
          time: d.timestamp || 0,
        }));
        if (mounted) {
          setLiqs(items.slice(0, wide ? 8 : 5));
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[Liquidations] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (liqs === null) return <WidgetSkeleton variant="list" rows={5} />;

  if (liqs.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
          <Flame className="w-4 h-4 text-green-400/60" />
        </div>
        <p className="text-xs text-neutral-500">No recent liquidations</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">BTC liquidations will show here</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1.5">
      {liqs.map((l, i) => {
        const val = l.usdValue || (l.quantity * l.price);
        const isLong = l.side?.toLowerCase() === 'buy' || l.side?.toLowerCase() === 'long';
        return (
          <div key={i} className="flex items-center justify-between text-xs py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isLong ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-neutral-300">{l.symbol?.replace(/USDT$/, '')}</span>
            </div>
            <span className="text-neutral-500 font-mono">
              ${val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toFixed(0)}
            </span>
          </div>
        );
      })}
      </div>
      <div className="text-right mt-1"><UpdatedAgo ts={updatedAt} /></div>
    </div>
  );
}
