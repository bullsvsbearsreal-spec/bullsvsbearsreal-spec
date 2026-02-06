'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Flame, Snowflake } from 'lucide-react';
import { fetchTopMovers } from '@/lib/api/aggregator';
import { TickerData } from '@/lib/api/types';

function formatPrice(num: number): string {
  if (num === undefined || num === null) return '$0.00';
  if (num >= 1000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(6)}`;
}

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
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            view === 'gainers' ? 'bg-success/20' : 'bg-danger/20'
          }`}>
            {view === 'gainers' ? (
              <Flame className="w-5 h-5 text-success" />
            ) : (
              <Snowflake className="w-5 h-5 text-danger" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Top {view === 'gainers' ? 'Gainers' : 'Losers'}
            </h3>
            <p className="text-hub-gray-text text-xs">24h price change</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex rounded-xl overflow-hidden bg-hub-gray/30 border border-hub-gray/30">
          <button
            onClick={() => setView('gainers')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
              view === 'gainers'
                ? 'bg-success text-black'
                : 'text-hub-gray-text hover:text-white'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            Gainers
          </button>
          <button
            onClick={() => setView('losers')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
              view === 'losers'
                ? 'bg-danger text-white'
                : 'text-hub-gray-text hover:text-white'
            }`}
          >
            <TrendingDown className="w-3 h-3" />
            Losers
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-hub-gray/30 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, index) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between p-3 rounded-xl bg-hub-gray/30 hover:bg-hub-gray/40 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-hub-gray-text text-xs w-5">{index + 1}</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hub-yellow/30 to-hub-orange/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-hub-yellow">
                    {item.symbol.slice(0, 2)}
                  </span>
                </div>
                <span className="text-white font-medium group-hover:text-hub-yellow transition-colors">
                  {item.symbol}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white font-mono text-sm">
                  {formatPrice(item.lastPrice)}
                </span>
                <div className={`flex items-center gap-1 min-w-[80px] justify-end ${
                  item.priceChangePercent24h >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {item.priceChangePercent24h >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span className="font-semibold text-sm">
                    {item.priceChangePercent24h >= 0 ? '+' : ''}
                    {item.priceChangePercent24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
