'use client';

import { useState, useMemo } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { useTickers } from '@/hooks/useSWRApi';
import { TickerData } from '@/lib/api/types';
import { formatPrice, safeNumber } from '@/lib/utils/format';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

export default function MarketTicker() {
  const [isScrolling, setIsScrolling] = useState(true);
  const { data: tickers, isLoading } = useTickers();

  const tickerData = useMemo<TickerItem[]>(() => {
    if (!tickers) return [];
    return tickers
      .filter((t: TickerData) => t.priceChangePercent24h != null && t.priceChangePercent24h !== 0)
      .slice(0, 40)
      .map((t: TickerData) => ({
        symbol: (t.symbol || '').replace('USDT', '').replace('USD', ''),
        price: safeNumber(t.lastPrice),
        change: safeNumber(t.priceChangePercent24h),
      }));
  }, [tickers]);

  const duplicatedTickers = [...tickerData, ...tickerData];

  if (isLoading) {
    return (
      <div className="border-b border-white/[0.04] bg-black overflow-hidden">
        <div className="py-2">
          <div className="flex items-center gap-8 animate-pulse px-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-white/[0.06]" />
                <div className="h-3 w-8 bg-white/[0.04] rounded" />
                <div className="h-3 w-14 bg-white/[0.04] rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/[0.04] bg-black overflow-hidden">
      <div
        className="relative py-2"
        onMouseEnter={() => setIsScrolling(false)}
        onMouseLeave={() => setIsScrolling(true)}
      >
        <div
          className={`flex items-center gap-8 ${isScrolling ? 'animate-ticker' : ''}`}
          style={{ width: 'fit-content' }}
        >
          {duplicatedTickers.map((ticker, index) => {
            const isPositive = (ticker.change ?? 0) >= 0;
            return (
              <div
                key={index}
                className="flex items-center gap-1.5 cursor-pointer group transition-opacity hover:opacity-70"
              >
                <TokenIconSimple symbol={ticker.symbol} size={16} />
                <span className="text-neutral-400 font-medium text-xs">{ticker.symbol}</span>
                <span className="text-neutral-500 font-mono text-xs">{formatPrice(ticker.price)}</span>
                <span className={`text-xs font-mono tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{(ticker.change ?? 0).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
