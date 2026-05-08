'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import AnimatedValue from '../AnimatedValue';
import UpdatedAgo from '../UpdatedAgo';
import { useDashboardOptional } from '../DashboardContext';

export default function BtcPriceWidget({ widgetId }: { wide?: boolean; widgetId?: string }) {
  const ctx = useDashboardOptional();
  const symbol = (widgetId && ctx) ? ctx.getWidgetSymbol(widgetId) : 'BTC';

  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retries = 0;
    setPrice(null);
    setChange(null);
    setError(false);
    const load = async () => {
      try {
        const res = await fetch(`/api/tickers?symbols=${symbol}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data || [];
        const match = Array.isArray(data) ? data.find((t: any) => t.symbol === symbol || t.symbol === `${symbol}USDT`) : null;
        if (match && mounted) {
          setPrice(match.price || match.lastPrice);
          setChange(match.priceChangePercent24h ?? match.change24h ?? null);
          setUpdatedAt(Date.now());
          setError(false);
        }
        retries = 0;
      } catch (err) {
        console.error(`[PriceWidget] fetch error for ${symbol}:`, err);
        retries++;
        if (retries >= 3 && mounted) setError(true);
      }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [symbol]);

  if (error && price === null) return (
    <div className="text-center py-4">
      <p className="text-xs text-neutral-500">Failed to load {symbol} price</p>
      <button onClick={() => { setError(false); window.location.reload(); }} className="text-[10px] text-amber-500 hover:text-amber-400 mt-1">Retry</button>
    </div>
  );

  if (price === null) return <WidgetSkeleton variant="stat" />;

  const up = (change ?? 0) >= 0;

  // Price formatter — must preserve decimals for sub-$1 coins (THETA,
  // SHIB, PEPE, etc.). The previous fixed `maximumFractionDigits: 0`
  // formatter rounded THETA's $0.2164 to "$0", which is what the
  // dashboard "BTC Price" widget rendered when the user synced it to
  // a low-priced symbol.
  const formatPrice = (v: number): string => {
    if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (v >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    if (v >= 0.0001) return `$${v.toFixed(6)}`;
    if (v > 0) return `$${v.toFixed(8)}`;
    return '$0';
  };

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <AnimatedValue
          value={price}
          format={formatPrice}
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
