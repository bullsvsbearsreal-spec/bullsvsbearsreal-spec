'use client';

import { useState, useEffect } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { fetchAllTickers, fetchAllOpenInterest } from '@/lib/api/aggregator';
import { TickerData } from '@/lib/api/types';
import { formatPrice, safeNumber } from '@/lib/utils/format';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

export default function MarketTicker() {
  const [isScrolling, setIsScrolling] = useState(true);
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tickers] = await Promise.all([
          fetchAllTickers(),
          fetchAllOpenInterest(),
        ]);

        const processedTickers: TickerItem[] = tickers.slice(0, 16).map((t: TickerData) => ({
          symbol: (t.symbol || '').replace('USDT', '').replace('USD', ''),
          price: safeNumber(t.lastPrice),
          change: safeNumber(t.priceChangePercent24h),
        }));

        setTickerData(processedTickers);
      } catch (err) {
        console.error('Failed to fetch ticker data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

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
                className="flex items-center gap-1.5 cursor-pointer group"
              >
                {index > 0 && <span className="w-1 h-1 rounded-full bg-white/10 mr-2" />}
                <TokenIconSimple symbol={ticker.symbol} size={16} />
                <span className="text-neutral-400 group-hover:text-white font-medium text-xs transition-colors">{ticker.symbol}</span>
                <span className="text-neutral-500 font-mono text-xs">{formatPrice(ticker.price)}</span>
                <span className={`text-xs font-mono tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{(ticker.change ?? 0).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
