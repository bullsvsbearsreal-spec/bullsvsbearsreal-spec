'use client';

import { useState, useEffect } from 'react';
import { ExchangeLogo } from './ExchangeLogos';
import { TokenIconSimple } from './TokenIcon';
import { Clock, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { fetchAllFundingRates } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';

export default function FundingRatesTable() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllFundingRates();
      setFundingRates(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch funding rates');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const symbols = Array.from(new Set(fundingRates.map(r => r.symbol))).slice(0, 10);

  const filteredRates = selectedSymbol
    ? fundingRates.filter(r => r.symbol === selectedSymbol)
    : fundingRates;

  const calculateAnnualized = (rate: number | undefined | null) => ((rate ?? 0) * 3 * 365).toFixed(2);
  const safeRate = (rate: number | undefined | null) => rate ?? 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-hub-gray/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-hub-yellow/20 to-hub-orange/10 rounded-xl">
              <Clock className="w-5 h-5 text-hub-yellow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Funding Rates</h2>
              <p className="text-hub-gray-text text-xs">
                {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Live data from exchanges'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-hub-gray-text bg-hub-gray/30 px-2 py-1 rounded-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              Live
            </span>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 rounded-lg text-hub-gray-text hover:text-hub-yellow hover:bg-hub-gray/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Symbol Filter */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setSelectedSymbol(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              !selectedSymbol
                ? 'bg-hub-yellow text-black'
                : 'text-hub-gray-text hover:text-white hover:bg-hub-gray/30'
            }`}
          >
            All
          </button>
          {symbols.map((symbol) => (
            <button
              key={symbol}
              onClick={() => setSelectedSymbol(symbol)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedSymbol === symbol
                  ? 'bg-hub-yellow text-black'
                  : 'text-hub-gray-text hover:text-white hover:bg-hub-gray/30'
              }`}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && fundingRates.length === 0 && (
        <div className="p-10 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-hub-yellow animate-spin mb-3" />
          <p className="text-hub-gray-text text-sm">Fetching live funding rates...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-10 flex flex-col items-center justify-center">
          <AlertCircle className="w-8 h-8 text-danger mb-3" />
          <p className="text-danger text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 px-4 py-2 bg-hub-gray/30 text-white rounded-lg text-sm hover:bg-hub-gray/50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && fundingRates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-hub-gray/20">
                <th className="text-left text-xs text-hub-gray-text font-medium px-5 py-3">Asset</th>
                <th className="text-left text-xs text-hub-gray-text font-medium px-5 py-3">Exchange</th>
                <th className="text-right text-xs text-hub-gray-text font-medium px-5 py-3">Current Rate</th>
                <th className="text-right text-xs text-hub-gray-text font-medium px-5 py-3">Annualized</th>
              </tr>
            </thead>
            <tbody>
              {filteredRates.slice(0, 15).map((rate, index) => {
                const annualized = parseFloat(calculateAnnualized(rate.fundingRate));
                return (
                  <tr
                    key={`${rate.symbol}-${rate.exchange}-${index}`}
                    className="border-t border-hub-gray/20 hover:bg-hub-gray/10 transition-colors data-row"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <TokenIconSimple symbol={rate.symbol} size={28} />
                        <span className="font-semibold text-white">{rate.symbol}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <ExchangeLogo exchange={rate.exchange.toLowerCase()} size={20} />
                        <span className="text-hub-gray-text-light text-sm">{rate.exchange}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {safeRate(rate.fundingRate) >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-danger" />
                        )}
                        <span className={`font-mono text-sm ${safeRate(rate.fundingRate) >= 0 ? 'text-success' : 'text-danger'}`}>
                          {safeRate(rate.fundingRate) >= 0 ? '+' : ''}{safeRate(rate.fundingRate).toFixed(4)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`px-2 py-1 rounded-md text-sm font-semibold ${
                        annualized >= 10
                          ? 'bg-hub-yellow/10 text-hub-yellow'
                          : annualized >= 5
                          ? 'bg-success/10 text-success'
                          : annualized < 0
                          ? 'bg-danger/10 text-danger'
                          : 'bg-hub-gray/30 text-hub-gray-text-light'
                      }`}>
                        {annualized.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-hub-gray/20 bg-hub-gray/10">
        <div className="flex items-center justify-between">
          <p className="text-xs text-hub-gray-text">
            Positive rates: Longs pay shorts | Negative rates: Shorts pay longs
          </p>
          <span className="text-xs text-hub-gray-text">
            {fundingRates.length} rates from {new Set(fundingRates.map(r => r.exchange)).size} exchanges
          </span>
        </div>
      </div>
    </div>
  );
}