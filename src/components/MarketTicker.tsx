'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { TokenIconSimple } from './TokenIcon';
import { fetchAllTickers, fetchAllOpenInterest } from '@/lib/api/aggregator';
import { TickerData, OpenInterestData } from '@/lib/api/types';
import { formatPrice, formatNumber, safeNumber } from '@/lib/utils/format';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

export default function MarketTicker() {
  const [isScrolling, setIsScrolling] = useState(true);
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalOI, setTotalOI] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tickers, oiData] = await Promise.all([
          fetchAllTickers(),
          fetchAllOpenInterest(),
        ]);

        // Process tickers
        const processedTickers: TickerItem[] = tickers.slice(0, 12).map((t: TickerData) => ({
          symbol: (t.symbol || '').replace('USDT', '').replace('USD', ''),
          price: safeNumber(t.lastPrice),
          change: safeNumber(t.priceChangePercent24h),
        }));

        setTickerData(processedTickers);

        // Calculate totals
        const volume = tickers.reduce((sum: number, t: TickerData) => sum + safeNumber(t.quoteVolume24h), 0);
        const oi = oiData.reduce((sum: number, o: OpenInterestData) => sum + safeNumber(o.openInterestValue), 0);

        setTotalVolume(volume);
        setTotalOI(oi);
      } catch (err) {
        console.error('Failed to fetch ticker data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30 * 1000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const marketStats = [
    { label: '24h Volume', value: formatNumber(totalVolume), change: null, positive: null },
    { label: 'Open Interest', value: formatNumber(totalOI), change: null, positive: null },
    { label: 'BTC Dom', value: '54.2%', change: null, positive: null },
    { label: 'Status', value: isLoading ? 'Loading...' : 'Live', change: null, positive: null },
  ];

  // Duplicate items for seamless scroll
  const duplicatedTickers = [...tickerData, ...tickerData];

  return (
    <div className="bg-hub-dark/80 backdrop-blur-sm border-b border-hub-gray/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Top row - Market Stats */}
        <div className="px-4 py-2.5 border-b border-hub-gray/20">
          <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
            {marketStats.map((stat, index) => (
              <div key={index} className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-hub-gray-text text-xs uppercase tracking-wide">{stat.label}</span>
                <span className="text-white font-semibold">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row - Scrolling Ticker */}
        <div
          className="relative py-2"
          onMouseEnter={() => setIsScrolling(false)}
          onMouseLeave={() => setIsScrolling(true)}
        >
          <div
            className={`flex items-center gap-8 ${isScrolling ? 'animate-ticker' : ''}`}
            style={{ width: 'fit-content' }}
          >
            {duplicatedTickers.map((ticker, index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-3 py-1 cursor-pointer group"
              >
                <TokenIconSimple symbol={ticker.symbol} size={20} />
                <span className="text-white font-medium text-sm">{ticker.symbol}</span>
                <span className="text-hub-gray-text font-mono text-sm">{formatPrice(ticker.price)}</span>
                <span className={`text-sm font-medium ${(ticker.change ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {(ticker.change ?? 0) >= 0 ? '+' : ''}{(ticker.change ?? 0).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          {/* Gradient fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-hub-dark to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-hub-dark to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}