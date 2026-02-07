'use client';

import { useState, useEffect } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { fetchAllTickers, fetchAllOpenInterest } from '@/lib/api/aggregator';
import { TickerData, OpenInterestData } from '@/lib/api/types';
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

        // Process tickers - get top 16 for a fuller ticker
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

  // Duplicate items for seamless scroll
  const duplicatedTickers = [...tickerData, ...tickerData];

  if (isLoading) {
    return (
      <div className="bg-hub-black/95 border-b border-hub-gray/10 overflow-hidden">
        <div className="py-3">
          <div className="flex items-center gap-10 animate-pulse px-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-hub-gray/30" />
                <div className="h-4 w-12 bg-hub-gray/20 rounded" />
                <div className="h-4 w-20 bg-hub-gray/20 rounded" />
                <div className="h-4 w-14 bg-hub-gray/20 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hub-black/95 border-b border-hub-gray/10 overflow-hidden">
      {/* Scrolling Ticker */}
      <div
        className="relative py-3"
        onMouseEnter={() => setIsScrolling(false)}
        onMouseLeave={() => setIsScrolling(true)}
      >
        <div
          className={`flex items-center gap-10 ${isScrolling ? 'animate-ticker' : ''}`}
          style={{ width: 'fit-content' }}
        >
          {duplicatedTickers.map((ticker, index) => {
            const isPositive = (ticker.change ?? 0) >= 0;
            return (
              <div
                key={index}
                className="flex items-center gap-2.5 cursor-pointer group transition-opacity hover:opacity-80"
              >
                <TokenIconSimple symbol={ticker.symbol} size={22} />
                <span className="text-white/90 font-medium text-sm">{ticker.symbol}</span>
                <span className="text-white/50 font-mono text-sm">{formatPrice(ticker.price)}</span>
                <span className={`text-sm font-medium tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                  {isPositive ? '+' : ''}{(ticker.change ?? 0).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Gradient fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-hub-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-hub-black to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
