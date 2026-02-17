'use client';

import { useState, useEffect } from 'react';
import { fetchAllTickers } from '@/lib/api/aggregator';
import { LineChart, TrendingUp, TrendingDown } from 'lucide-react';

interface IndexData {
  name: string;
  value: string;
  change: number;
}

export default function MarketIndices() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tickers = await fetchAllTickers();

        const btcTicker = tickers.find(t => t.symbol === 'BTC');
        const totalVolume = tickers.reduce((sum, t) => sum + (t.quoteVolume24h || 0), 0);
        const btcVolume = btcTicker?.quoteVolume24h || 0;
        const btcDominance = totalVolume > 0 ? (btcVolume / totalVolume) * 100 : 0;

        const altcoins = tickers.filter(t => t.symbol !== 'BTC' && t.priceChangePercent24h !== undefined);
        const avgAltcoinChange = altcoins.length > 0
          ? altcoins.reduce((sum, t) => sum + (t.priceChangePercent24h || 0), 0) / altcoins.length
          : 0;
        const btcChange = btcTicker?.priceChangePercent24h || 0;
        const altcoinOutperformance = avgAltcoinChange - btcChange;
        const altSeasonIndex = Math.min(100, Math.max(0, 50 + (altcoinOutperformance * 5)));

        setIndices([
          {
            name: 'BTC Dominance',
            value: `${btcDominance.toFixed(2)}%`,
            change: btcChange,
          },
          {
            name: 'Altcoin Season',
            value: altSeasonIndex.toFixed(0),
            change: altcoinOutperformance,
          },
          {
            name: 'BTC Price',
            value: btcTicker ? `$${btcTicker.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-',
            change: btcChange,
          },
          {
            name: 'ETH Price',
            value: tickers.find(t => t.symbol === 'ETH')
              ? `$${tickers.find(t => t.symbol === 'ETH')!.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '-',
            change: tickers.find(t => t.symbol === 'ETH')?.priceChangePercent24h || 0,
          },
        ]);
      } catch (error) {
        console.error('Failed to fetch market indices:', error);
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
            <LineChart className="w-3 h-3 text-hub-yellow" />
          </div>
          <h3 className="text-white font-semibold text-sm">Market Index</h3>
        </div>
        <span className="text-neutral-600 text-[10px]">Key indicators</span>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {indices.map((index) => {
            const isPositive = index.change >= 0;
            return (
              <div
                key={index.name}
                className="data-row-premium flex items-center justify-between"
              >
                <span className="text-neutral-400 text-xs">{index.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono font-semibold text-xs tabular-nums">{index.value}</span>
                  <div className={`flex items-center gap-0.5 h-5 rounded-md px-1.5 ${
                    isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    {isPositive
                      ? <TrendingUp className="w-2.5 h-2.5 text-green-400" />
                      : <TrendingDown className="w-2.5 h-2.5 text-red-400" />
                    }
                    <span className={`text-[10px] font-mono font-semibold ${
                      isPositive ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {isPositive ? '+' : ''}{index.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
