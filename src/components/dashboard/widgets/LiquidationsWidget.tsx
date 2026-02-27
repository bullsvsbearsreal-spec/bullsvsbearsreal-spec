'use client';

import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';

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

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/liquidations?limit=10');
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.liquidations || data.data || [];
        if (mounted) setLiqs(items.slice(0, wide ? 8 : 5));
      } catch {}
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (liqs === null) {
    return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  if (liqs.length === 0) {
    return (
      <div className="text-center py-4">
        <Flame className="w-5 h-5 text-neutral-700 mx-auto mb-1" />
        <p className="text-xs text-neutral-600">No recent liquidations</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {liqs.map((l, i) => {
        const val = l.usdValue || (l.quantity * l.price);
        const isLong = l.side?.toLowerCase() === 'buy' || l.side?.toLowerCase() === 'long';
        return (
          <div key={i} className="flex items-center justify-between text-xs">
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
  );
}
