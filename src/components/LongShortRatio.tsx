'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { TokenIconSimple } from './TokenIcon';
import { fetchLongShortRatio } from '@/lib/api/aggregator';

interface RatioData {
  symbol: string;
  longRatio: number;
  shortRatio: number;
}

export default function LongShortRatio() {
  const [ratios, setRatios] = useState<RatioData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch for multiple symbols
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
        const results = await Promise.all(
          symbols.map(async (symbol) => {
            const data = await fetchLongShortRatio(symbol);
            return {
              symbol: symbol.replace('USDT', ''),
              ...data,
            };
          })
        );
        setRatios(results);
      } catch (error) {
        console.error('Failed to fetch long/short ratios:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Long/Short Ratio</h3>
          <p className="text-hub-gray-text text-xs">Top Trader Positions</p>
        </div>
      </div>

      {/* Ratios */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-16 bg-hub-gray/30 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {ratios.map((item) => {
            const isLongDominant = item.longRatio > item.shortRatio;
            return (
              <div
                key={item.symbol}
                className="p-3 rounded-xl bg-hub-gray/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TokenIconSimple symbol={item.symbol} size={24} />
                    <span className="text-white font-medium">{item.symbol}</span>
                  </div>
                  <span className={`text-xs font-medium ${
                    isLongDominant ? 'text-success' : 'text-danger'
                  }`}>
                    {isLongDominant ? (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Bullish
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> Bearish
                      </span>
                    )}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex h-2 rounded-full overflow-hidden bg-hub-gray/50">
                  <div
                    className="bg-success transition-all duration-500"
                    style={{ width: `${item.longRatio}%` }}
                  />
                  <div
                    className="bg-danger transition-all duration-500"
                    style={{ width: `${item.shortRatio}%` }}
                  />
                </div>

                {/* Labels */}
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-success">
                    Long {item.longRatio.toFixed(2)}%
                  </span>
                  <span className="text-danger">
                    Short {item.shortRatio.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
