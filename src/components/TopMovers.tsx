'use client';

import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
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
    <div className="glass-card rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Top Movers</h3>
            <p className="text-hub-gray-text text-xs">24h price change</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex rounded-lg overflow-hidden bg-hub-gray/30">
          <button
            onClick={() => setView('gainers')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'gainers'
                ? 'bg-hub-yellow text-black'
                : 'text-hub-gray-text hover:text-white'
            }`}
          >
            Gainers
          </button>
          <button
            onClick={() => setView('losers')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'losers'
                ? 'bg-hub-yellow text-black'
                : 'text-hub-gray-text hover:text-white'
            }`}
          >
            Losers
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-hub-gray/30 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, index) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between p-3 rounded-lg bg-hub-gray/20 hover:bg-hub-gray/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-hub-gray-text text-xs w-4 font-mono">{index + 1}</span>
                <TokenIconSimple symbol={item.symbol} size={28} />
                <span className="text-white font-medium">{item.symbol}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-hub-gray-text font-mono text-sm">
                  {formatPrice(item.lastPrice)}
                </span>
                <span className={`font-semibold text-sm min-w-[70px] text-right ${
                  item.priceChangePercent24h >= 0 ? 'text-success' : 'text-danger'
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
