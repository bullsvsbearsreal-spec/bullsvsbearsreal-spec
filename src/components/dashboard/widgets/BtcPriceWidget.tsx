'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import AnimatedValue from '../AnimatedValue';
import UpdatedAgo from '../UpdatedAgo';

export default function BtcPriceWidget() {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/tickers?symbols=BTC');
        if (!res.ok) return;
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data || [];
        const btc = Array.isArray(data) ? data.find((t: any) => t.symbol === 'BTC' || t.symbol === 'BTCUSDT') : null;
        if (btc && mounted) {
          setPrice(btc.price || btc.lastPrice);
          setChange(btc.priceChangePercent24h ?? btc.change24h ?? null);
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[BtcPrice] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (price === null) return <WidgetSkeleton variant="stat" />;

  const up = (change ?? 0) >= 0;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <AnimatedValue
          value={price}
          format={(v) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          className="text-2xl font-bold text-white"
        />
        {change !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? '+' : ''}{change.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-[10px] text-neutral-600">24h change</p>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
