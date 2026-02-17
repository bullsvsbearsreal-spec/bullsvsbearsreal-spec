'use client';

import { useState, useEffect } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { fetchLongShortRatio } from '@/lib/api/aggregator';
import { ArrowLeftRight } from 'lucide-react';

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
    <div className="card-premium p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
            <ArrowLeftRight className="w-3 h-3 text-hub-yellow" />
          </div>
          <h3 className="text-white font-semibold text-sm">Long/Short Ratio</h3>
        </div>
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
              <div key={item.symbol} className="px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <TokenIconSimple symbol={item.symbol} size={18} />
                    <span className="text-white font-medium text-xs">{item.symbol}</span>
                  </div>
                  <div className={`h-4 rounded px-1.5 flex items-center text-[9px] font-bold uppercase tracking-wide ${
                    isLongDominant ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {isLongDominant ? 'Bullish' : 'Bearish'}
                  </div>
                </div>

                <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
                  <div
                    className="bg-gradient-to-r from-green-600 to-green-500 transition-all duration-500 rounded-l-full"
                    style={{ width: `${item.longRatio}%` }}
                  />
                  <div
                    className="bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500 rounded-r-full"
                    style={{ width: `${item.shortRatio}%` }}
                  />
                </div>

                <div className="flex justify-between mt-1 text-[10px] font-mono">
                  <span className="text-green-400 font-semibold">{item.longRatio.toFixed(1)}%</span>
                  <span className="text-red-400 font-semibold">{item.shortRatio.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
