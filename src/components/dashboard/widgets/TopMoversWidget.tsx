'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';

interface Mover {
  symbol: string;
  change: number;
}

export default function TopMoversWidget({ wide }: { wide?: boolean }) {
  const [movers, setMovers] = useState<{ gainers: Mover[]; losers: Mover[] } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/tickers');
        if (!res.ok) return;
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data || [];
        if (!Array.isArray(data) || !mounted) return;

        const valid = data
          .filter((t: any) => t.priceChangePercent != null && t.symbol)
          .map((t: any) => ({
            symbol: t.symbol.replace(/USDT$/, ''),
            change: Number(t.priceChangePercent),
          }));

        valid.sort((a: Mover, b: Mover) => b.change - a.change);
        const limit = wide ? 5 : 3;
        setMovers({
          gainers: valid.slice(0, limit),
          losers: valid.slice(-limit).reverse(),
        });
      } catch {}
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (!movers) {
    return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" /></div>;
  }

  const Row = ({ m, idx }: { m: Mover; idx: number }) => (
    <div key={m.symbol + idx} className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1.5">
        <TokenIconSimple symbol={m.symbol} size={14} />
        <span className="text-xs text-neutral-300">{m.symbol}</span>
      </div>
      <span className={`text-xs font-medium tabular-nums ${m.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {m.change >= 0 ? '+' : ''}{m.change.toFixed(1)}%
      </span>
    </div>
  );

  return (
    <div className={wide ? 'grid grid-cols-2 gap-4' : 'space-y-2'}>
      <div>
        <div className="flex items-center gap-1 mb-1">
          <TrendingUp className="w-3 h-3 text-green-400" />
          <span className="text-[10px] font-medium text-green-400/70 uppercase">Gainers</span>
        </div>
        {movers.gainers.map((m, i) => <Row key={'g' + i} m={m} idx={i} />)}
      </div>
      <div>
        <div className="flex items-center gap-1 mb-1">
          <TrendingDown className="w-3 h-3 text-red-400" />
          <span className="text-[10px] font-medium text-red-400/70 uppercase">Losers</span>
        </div>
        {movers.losers.map((m, i) => <Row key={'l' + i} m={m} idx={i} />)}
      </div>
    </div>
  );
}
