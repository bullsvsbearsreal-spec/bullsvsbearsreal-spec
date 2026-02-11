'use client';

import { useState, useEffect } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { fetchTopMovers } from '@/lib/api/aggregator';
import { TickerData } from '@/lib/api/types';
import { formatPrice } from '@/lib/utils/format';

export default function TopMovers() {
  const [gainers, setGainers] = useState<TickerData[]>([]);
  const [losers, setLosers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'gainers' | 'losers'>('gainers');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchTopMovers();
        setGainers(data.gainers);
        setLosers(data.losers);
      } catch (error) {
        console.error('Failed to fetch top movers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const items = view === 'gainers' ? gainers : losers;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Top Movers</h3>
        <div className="flex rounded-md overflow-hidden bg-white/[0.04]">
          <button
            onClick={() => setView('gainers')}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              view === 'gainers' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
            }`}
          >
            Gainers
          </button>
          <button
            onClick={() => setView('losers')}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              view === 'losers' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
            }`}
          >
            Losers
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 5).map((item, index) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 text-[10px] font-mono w-3">{index + 1}</span>
                <TokenIconSimple symbol={item.symbol} size={20} />
                <span className="text-white font-medium text-xs">{item.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-neutral-500 font-mono text-xs">
                  {formatPrice(item.lastPrice)}
                </span>
                <span className={`font-mono font-semibold text-xs min-w-[52px] text-right ${
                  item.priceChangePercent24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {item.priceChangePercent24h >= 0 ? '+' : ''}
                  {item.priceChangePercent24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
