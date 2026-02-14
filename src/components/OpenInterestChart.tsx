'use client';

import { useState, useEffect } from 'react';
import { ExchangeLogo } from './ExchangeLogos';
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { fetchAllOpenInterest } from '@/lib/api/aggregator';
import { OpenInterestData } from '@/lib/api/types';
import { formatNumber, safeNumber } from '@/lib/utils/format';

interface ExchangeOI {
  exchange: string;
  openInterest: number;
  change24h: number;
}

export default function OpenInterestChart() {
  const [exchangeData, setExchangeData] = useState<ExchangeOI[]>([]);
  const [totalOI, setTotalOI] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const oiData = await fetchAllOpenInterest();

      // Filter by selected symbol and aggregate by exchange
      const symbolPattern = selectedSymbol === 'BTC' ? /BTC/ : /ETH/;
      const filteredData = oiData.filter((oi: OpenInterestData) => symbolPattern.test(oi.symbol));

      // Aggregate by exchange
      const exchangeMap = new Map<string, number>();
      filteredData.forEach((oi: OpenInterestData) => {
        const current = exchangeMap.get(oi.exchange || 'Unknown') || 0;
        exchangeMap.set(oi.exchange || 'Unknown', current + safeNumber(oi.openInterestValue));
      });

      // Convert to array
      const exchangeOI: ExchangeOI[] = Array.from(exchangeMap.entries()).map(([exchange, openInterest]) => ({
        exchange,
        openInterest,
        change24h: (Math.random() - 0.5) * 10, // Simulate change for now
      })).sort((a, b) => b.openInterest - a.openInterest);

      setExchangeData(exchangeOI);
      setTotalOI(exchangeOI.reduce((sum, e) => sum + e.openInterest, 0));
    } catch (err) {
      setError('Failed to fetch open interest data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2 * 60 * 1000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const maxOI = exchangeData.length > 0 ? Math.max(...exchangeData.map(d => d.openInterest)) : 0;
  const exchangeShares = exchangeData.map(d => ({
    ...d,
    share: totalOI > 0 ? (d.openInterest / totalOI) * 100 : 0
  }));

  if (isLoading && exchangeData.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-hub-yellow animate-spin mb-3" />
        <p className="text-hub-gray-text text-sm">Loading open interest data...</p>
      </div>
    );
  }

  if (error && exchangeData.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="w-8 h-8 text-danger mb-3" />
        <p className="text-danger text-sm">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-2 bg-hub-gray/30 text-white rounded-lg text-sm hover:bg-hub-gray/50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-hub-gray/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-info/20 to-purple-500/10 rounded-xl">
              <BarChart3 className="w-5 h-5 text-info" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Open Interest</h2>
              <p className="text-hub-gray-text text-xs">{selectedSymbol} futures across exchanges</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-hub-gray/30 rounded-lg p-1">
              <button
                onClick={() => setSelectedSymbol('BTC')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedSymbol === 'BTC' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
                }`}
              >
                BTC
              </button>
              <button
                onClick={() => setSelectedSymbol('ETH')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  selectedSymbol === 'ETH' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
                }`}
              >
                ETH
              </button>
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 rounded-lg text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Total OI */}
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white">{formatNumber(totalOI)}</span>
          <span className="text-hub-gray-text text-sm">Total {selectedSymbol} OI</span>
        </div>
      </div>

      {/* Exchange breakdown */}
      <div className="p-5 space-y-4">
        {exchangeShares.map((data, index) => {
          const barWidth = (data.openInterest / maxOI) * 100;

          return (
            <div key={index} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ExchangeLogo exchange={data.exchange.toLowerCase()} size={24} />
                  <span className="text-white font-medium group-hover:text-hub-yellow transition-colors">
                    {data.exchange}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-hub-gray-text-light text-sm font-mono">
                    {formatNumber(data.openInterest)}
                  </span>
                  <div className={`flex items-center gap-0.5 ${data.change24h >= 0 ? 'text-success' : 'text-danger'}`}>
                    {data.change24h >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    <span className="text-xs font-medium">
                      {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-2.5 bg-hub-gray/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-hub-yellow via-hub-orange to-hub-yellow-dark transition-all duration-700 ease-out"
                  style={{ width: `${barWidth}%` }}
                />
                {/* Shimmer effect */}
                <div
                  className="absolute top-0 h-full w-20 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Market share label */}
              <div className="flex justify-end mt-1">
                <span className="text-xs text-hub-gray-text">
                  {data.share.toFixed(1)}% market share
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-hub-gray/20 bg-hub-gray/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-hub-yellow to-hub-orange" />
              <span className="text-xs text-hub-gray-text">CEX Dominance</span>
            </div>
          </div>
          <button className="text-xs text-hub-yellow hover:text-hub-yellow-light transition-colors font-medium">
            View ETH & Alts →
          </button>
        </div>
      </div>
    </div>
  );
}