'use client';

import { TokenIconSimple } from './TokenIcon';
import { useApi } from '@/hooks/useSWRApi';
import { ArrowLeftRight } from 'lucide-react';

interface RatioData {
  symbol: string;
  longRatio: number;
  shortRatio: number;
}

/** Trader slang for extreme L/S skew */
function getLSSlang(longRatio: number): string | null {
  if (longRatio >= 75) return 'Longs absolutely loaded — squeeze incoming?';
  if (longRatio >= 65) return 'Heavy long bias';
  if (longRatio <= 25) return 'Shorts piling in — pump fuel?';
  if (longRatio <= 35) return 'Bears in control';
  return null;
}

export default function LongShortRatio() {
  const { data: ratios, isLoading: loading } = useApi<RatioData[]>({
    key: 'longShortRatios',
    fetcher: async () => {
      const { fetchLongShortRatio } = await import('@/lib/api/aggregator');
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
      return Promise.all(
        symbols.map(async (symbol) => {
          const data = await fetchLongShortRatio(symbol);
          return { ...data, symbol: symbol.replace('USDT', '') };
        })
      );
    },
    refreshInterval: 30_000,
  });

  return (
    <div className="card-premium p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
            <ArrowLeftRight className="w-3 h-3 text-hub-yellow" />
          </div>
          <h3 className="text-white font-semibold text-sm">Long/Short Ratio</h3>
        </div>
        <span className="text-neutral-600 text-[10px]" title="Binance Global Long/Short Account Ratio — counts accounts, not position size">Binance · Accounts</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(ratios ?? []).map((item) => {
            const isLongDominant = item.longRatio > item.shortRatio;
            const isExtreme = item.longRatio >= 65 || item.longRatio <= 35;
            const slang = getLSSlang(item.longRatio);
            return (
              <div
                key={item.symbol}
                className={`relative px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors ${
                  isExtreme ? (isLongDominant ? 'card-bullish' : 'card-bearish') : ''
                } ${slang ? 'has-tooltip' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <TokenIconSimple symbol={item.symbol} size={18} />
                    <span className="text-white font-medium text-xs">{item.symbol}</span>
                  </div>
                  <span className={`delta-badge ${
                    isLongDominant ? 'delta-badge-up' : 'delta-badge-down'
                  } text-[9px] uppercase tracking-wide`}>
                    {isLongDominant ? 'Bullish' : 'Bearish'}
                  </span>
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
                  <span className={`font-semibold ${isExtreme && isLongDominant ? 'text-pump-hot' : 'text-green-400'}`}>
                    {item.longRatio.toFixed(1)}%
                  </span>
                  <span className={`font-semibold ${isExtreme && !isLongDominant ? 'text-rekt-hot' : 'text-red-400'}`}>
                    {item.shortRatio.toFixed(1)}%
                  </span>
                </div>

                {slang && (
                  <span className="trader-tooltip">
                    <span className="tooltip-slang">{slang}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
