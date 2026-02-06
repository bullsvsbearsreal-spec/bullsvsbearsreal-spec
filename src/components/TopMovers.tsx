'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
    <div className="bg-hub-gray/20 border border-hub-gray/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Top Movers</h3>
        <div className="flex text-xs">
          <button
            onClick={() => setView('gainers')}
            className={`px-2 py-1 rounded-l ${
              view === 'gainers' ? 'bg-green-500/20 text-green-400' : 'text-hub-gray-text hover:text-white'
            }`}
          >
            Gainers
          </button>
          <button
            onClick={() => setView('losers')}
            className={`px-2 py-1 rounded-r ${
              view === 'losers' ? 'bg-red-500/20 text-red-400' : 'text-hub-gray-text hover:text-white'
            }`}
          >
            Losers
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-hub-gray/30 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 5).map((item, index) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between py-2 px-2 rounded hover:bg-hub-gray/30"
            >
              <div className="flex items-center gap-2">
                <span className="text-hub-gray-text text-xs w-3">{index + 1}</span>
                <TokenIconSimple symbol={item.symbol} size={24} />
                <span className="text-white text-sm">{item.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/70 text-sm font-mono">
                  {formatPrice(item.lastPrice)}
                </span>
                <span className={`text-sm font-medium flex items-center gap-0.5 ${
                  item.priceChangePercent24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {item.priceChangePercent24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {item.priceChangePercent24h >= 0 ? '+' : ''}{item.priceChangePercent24h.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
