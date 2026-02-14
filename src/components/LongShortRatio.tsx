'use client';

import { useState, useEffect } from 'react';
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
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
        const results = await Promise.all(
          symbols.map(async (symbol) => {
            const data = await fetchLongShortRatio(symbol);
            return {
              ...data,
              symbol: symbol.replace('USDT', ''),
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
    <div className="card-hub p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Long/Short Ratio</h3>
        <span className="text-neutral-600 text-[10px]">Top traders</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {ratios.map((item) => {
            const isLongDominant = item.longRatio > item.shortRatio;
            return (
              <div key={item.symbol} className="px-2.5 py-2 rounded-lg bg-white/[0.02]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <TokenIconSimple symbol={item.symbol} size={18} />
                    <span className="text-white font-medium text-xs">{item.symbol}</span>
                  </div>
                  <span className={`text-[10px] font-medium ${
                    isLongDominant ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isLongDominant ? 'Bullish' : 'Bearish'}
                  </span>
                </div>

                <div className="flex h-1 rounded-full overflow-hidden bg-white/[0.04]">
                  <div
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${item.longRatio}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all duration-500"
                    style={{ width: `${item.shortRatio}%` }}
                  />
                </div>

                <div className="flex justify-between mt-1 text-[10px] font-mono">
                  <span className="text-green-400">{item.longRatio.toFixed(1)}%</span>
                  <span className="text-red-400">{item.shortRatio.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
