'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface Mover {
  symbol: string;
  change: number;
}

export default function TopMoversWidget({ wide }: { wide?: boolean }) {
  const [movers, setMovers] = useState<{ gainers: Mover[]; losers: Mover[] } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

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
        setUpdatedAt(Date.now());
      } catch (err) { console.error('[TopMovers] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (!movers) return <WidgetSkeleton variant="list" rows={3} />;

  const Row = ({ m, idx }: { m: Mover; idx: number }) => (
    <div key={m.symbol + idx} className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
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
      {!wide && <div className="text-right mt-1"><UpdatedAgo ts={updatedAt} /></div>}
    </div>
  );
}
