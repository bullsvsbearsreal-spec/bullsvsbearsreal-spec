'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, DollarSign, Bitcoin } from 'lucide-react';
import { fetchAllTickers } from '@/lib/api/aggregator';

interface IndexData {
  name: string;
  value: string;
  change: number;
  icon: React.ReactNode;
}

export default function MarketIndices() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tickers = await fetchAllTickers();

        // Calculate market data
        const btcTicker = tickers.find(t => t.symbol === 'BTC');
        const totalVolume = tickers.reduce((sum, t) => sum + (t.quoteVolume24h || 0), 0);
        const btcVolume = btcTicker?.quoteVolume24h || 0;

        // BTC Dominance (by volume)
        const btcDominance = totalVolume > 0 ? (btcVolume / totalVolume) * 100 : 0;

        // Calculate altcoin performance vs BTC
        const altcoins = tickers.filter(t => t.symbol !== 'BTC' && t.priceChangePercent24h !== undefined);
        const avgAltcoinChange = altcoins.length > 0
          ? altcoins.reduce((sum, t) => sum + (t.priceChangePercent24h || 0), 0) / altcoins.length
          : 0;
        const btcChange = btcTicker?.priceChangePercent24h || 0;
        const altcoinOutperformance = avgAltcoinChange - btcChange;

        // Altcoin Season Index (0-100, above 75 = altseason)
        // Based on whether altcoins are outperforming BTC
        const altSeasonIndex = Math.min(100, Math.max(0, 50 + (altcoinOutperformance * 5)));

        setIndices([
          {
            name: 'BTC Dominance',
            value: `${btcDominance.toFixed(2)}%`,
            change: btcChange,
            icon: <Bitcoin className="w-4 h-4" />,
          },
          {
            name: 'Altcoin Season',
            value: altSeasonIndex.toFixed(0),
            change: altcoinOutperformance,
            icon: <Activity className="w-4 h-4" />,
          },
          {
            name: 'BTC Price',
            value: btcTicker ? `$${btcTicker.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-',
            change: btcChange,
            icon: <DollarSign className="w-4 h-4" />,
          },
          {
            name: 'ETH Price',
            value: tickers.find(t => t.symbol === 'ETH')
              ? `$${tickers.find(t => t.symbol === 'ETH')!.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '-',
            change: tickers.find(t => t.symbol === 'ETH')?.priceChangePercent24h || 0,
            icon: <DollarSign className="w-4 h-4" />,
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
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-hub-yellow/20 flex items-center justify-center">
          <Activity className="w-5 h-5 text-hub-yellow" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Market Index</h3>
          <p className="text-hub-gray-text text-xs">Key market indicators</p>
        </div>
      </div>

      {/* Indices */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-14 bg-hub-gray/30 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {indices.map((index) => (
            <div
              key={index.name}
              className="flex items-center justify-between p-3 rounded-xl bg-hub-gray/30 hover:bg-hub-gray/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center text-hub-yellow">
                  {index.icon}
                </div>
                <span className="text-hub-gray-text text-sm">{index.name}</span>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold">{index.value}</div>
                <div className={`text-xs flex items-center gap-1 justify-end ${
                  index.change >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {index.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
