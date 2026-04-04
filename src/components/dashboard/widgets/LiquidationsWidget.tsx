'use client';

import { useState, useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';
import { useDashboardOptional } from '../DashboardContext';

interface Liq {
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  usdValue?: number;
  time?: number;
}

const WHALE_THRESHOLD = 500_000; // $500K = whale

/** Trader slang for big liqs */
function getRektSlang(val: number, isLong: boolean): string | null {
  if (val < 100_000) return null;
  if (val >= 1_000_000) return isLong ? 'Whale long obliterated' : 'Massive short squeeze';
  if (val >= WHALE_THRESHOLD) return isLong ? 'Big long got rekt' : 'Short getting squeezed';
  return isLong ? 'Longs catching strays' : 'Shorts in trouble';
}

export default function LiquidationsWidget({ wide, widgetId }: { wide?: boolean; widgetId?: string }) {
  const ctx = useDashboardOptional();
  const symbol = (widgetId && ctx) ? ctx.getWidgetSymbol(widgetId) : 'BTC';

  const [liqs, setLiqs] = useState<Liq[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const prevCount = useRef(0);
  const [justUpdated, setJustUpdated] = useState(false);
  const fetchCount = useRef(0);

  useEffect(() => {
    let mounted = true;
    setLiqs(null);
    const load = async () => {
      try {
        const res = await fetch(`/api/liquidations?symbol=${symbol}&limit=10`);
        if (!res.ok) return;
        const json = await res.json();
        const rawItems = json?.data || [];
        const responseSymbol = json?.symbol || symbol;
        const items: Liq[] = rawItems.map((d: any) => ({
          symbol: responseSymbol,
          side: d.side || 'long',
          quantity: d.size || 0,
          price: d.price || 0,
          usdValue: d.value || 0,
          time: d.timestamp || 0,
        }));
        if (mounted) {
          setLiqs(items.slice(0, wide ? 8 : 5));
          setUpdatedAt(Date.now());
          // Flash micro-glow on refresh (skip first load)
          if (fetchCount.current > 0) {
            setJustUpdated(true);
            setTimeout(() => { if (mounted) setJustUpdated(false); }, 1000);
          }
          fetchCount.current++;
          prevCount.current = items.length;
        }
      } catch (err) { console.error('[Liquidations] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide, symbol]);

  if (liqs === null) return <WidgetSkeleton variant="list" rows={5} />;

  if (liqs.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
          <Flame className="w-4 h-4 text-green-400/60" />
        </div>
        <p className="text-xs text-neutral-500">No recent liquidations</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">{symbol} liquidations will show here</p>
      </div>
    );
  }

  return (
    <div className={justUpdated ? 'data-updated' : ''}>
      <div className="space-y-1">
      {liqs.map((l, i) => {
        const val = l.usdValue || (l.quantity * l.price);
        const isLong = l.side?.toLowerCase() === 'buy' || l.side?.toLowerCase() === 'long';
        const isWhale = val >= WHALE_THRESHOLD;
        const slang = getRektSlang(val, isLong);

        // Determine rekt tape class
        const tapeClass = isWhale
          ? 'rekt-tape-whale'
          : isLong
            ? 'rekt-tape-long'
            : 'rekt-tape-short';

        return (
          <div
            key={`${l.time}-${l.side}-${l.symbol}-${i}`}
            className={`rekt-tape-entry ${tapeClass} flex items-center justify-between text-xs py-1.5 px-2 rounded-md hover:bg-white/[0.04] transition-colors relative has-tooltip`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isLong ? 'bg-red-400' : 'bg-green-400'
              } ${isWhale ? 'animate-pulse' : ''}`} />
              <span className="text-neutral-300 font-medium">{l.symbol?.replace(/USDT$/, '')}</span>
              <span className={`text-[9px] font-semibold uppercase ${isLong ? 'text-red-400/60' : 'text-green-400/60'}`}>
                {isLong ? 'LONG' : 'SHORT'}
              </span>
              {isWhale && (
                <span className="badge-extreme">WHALE</span>
              )}
            </div>
            <span className={`font-mono font-bold ${
              isWhale ? 'text-base' : 'text-sm'
            } ${
              isWhale ? 'text-highlight-hot' : isLong ? 'text-red-400' : 'text-green-400'
            }`} style={isWhale ? { color: 'var(--highlight-hot)' } : undefined}>
              ${val >= 1_000_000
                ? `${(val / 1_000_000).toFixed(2)}M`
                : val >= 1000
                  ? `${(val / 1000).toFixed(1)}K`
                  : val.toFixed(0)}
            </span>
            {slang && (
              <span className="trader-tooltip">
                <span className="tooltip-slang">{slang}</span>
              </span>
            )}
          </div>
        );
      })}
      </div>
      <div className="text-right mt-1.5"><UpdatedAgo ts={updatedAt} /></div>
    </div>
  );
}
