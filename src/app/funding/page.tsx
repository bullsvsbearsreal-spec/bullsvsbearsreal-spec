'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { fetchAllFundingRates } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { TrendingUp, TrendingDown, RefreshCw, Clock, AlertTriangle, ArrowUpDown } from 'lucide-react';

type SortField = 'symbol' | 'fundingRate' | 'exchange';
type SortOrder = 'asc' | 'desc';

export default function FundingPage() {
  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('fundingRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllFundingRates();
      setFundingRates(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch funding rates. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get unique exchanges
  const exchanges = Array.from(new Set(fundingRates.map(fr => fr.exchange)));

  // Filter and sort data
  const filteredAndSorted = fundingRates
    .filter(fr => {
      if (exchangeFilter !== 'all' && fr.exchange !== exchangeFilter) return false;
      if (searchTerm && !fr.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'fundingRate':
          comparison = a.fundingRate - b.fundingRate;
          break;
        case 'exchange':
          comparison = a.exchange.localeCompare(b.exchange);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Group by symbol for comparison view
  const groupedBySymbol = new Map<string, FundingRateData[]>();
  fundingRates.forEach(fr => {
    const existing = groupedBySymbol.get(fr.symbol) || [];
    groupedBySymbol.set(fr.symbol, [...existing, fr]);
  });

  // Calculate stats
  const avgRate = fundingRates.length > 0
    ? fundingRates.reduce((sum, fr) => sum + fr.fundingRate, 0) / fundingRates.length
    : 0;
  const highestRate = fundingRates.length > 0
    ? fundingRates.reduce((max, fr) => fr.fundingRate > max.fundingRate ? fr : max, fundingRates[0])
    : null;
  const lowestRate = fundingRates.length > 0
    ? fundingRates.reduce((min, fr) => fr.fundingRate < min.fundingRate ? fr : min, fundingRates[0])
    : null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatRate = (rate: number) => {
    const formatted = rate.toFixed(4);
    return rate >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const getRateColor = (rate: number) => {
    if (rate > 0.05) return 'text-success';
    if (rate < -0.05) return 'text-error';
    return 'text-hub-gray-text';
  };

  const getExchangeColor = (exchange: string) => {
    const colors: Record<string, string> = {
      'Binance': 'bg-yellow-500/20 text-yellow-400',
      'Bybit': 'bg-orange-500/20 text-orange-400',
      'OKX': 'bg-blue-500/20 text-blue-400',
      'Bitget': 'bg-cyan-500/20 text-cyan-400',
      'Hyperliquid': 'bg-green-500/20 text-green-400',
      'dYdX': 'bg-purple-500/20 text-purple-400',
    };
    return colors[exchange] || 'bg-hub-gray/50 text-hub-gray-text';
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Funding Rates</h1>
            <p className="text-hub-gray-text mt-1">
              Real-time perpetual funding rates across all major exchanges
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-sm text-hub-gray-text flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-hub-gray/30 hover:bg-hub-gray/50 rounded-xl text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Total Pairs</span>
            <div className="text-2xl font-bold text-white mt-1">{fundingRates.length}</div>
          </div>
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Average Rate</span>
            <div className={`text-2xl font-bold mt-1 ${getRateColor(avgRate)}`}>
              {formatRate(avgRate)}
            </div>
          </div>
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Highest Rate</span>
            {highestRate && (
              <div className="mt-1">
                <span className="text-2xl font-bold text-success">{formatRate(highestRate.fundingRate)}</span>
                <span className="text-hub-gray-text text-sm ml-2">{highestRate.symbol}</span>
              </div>
            )}
          </div>
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Lowest Rate</span>
            {lowestRate && (
              <div className="mt-1">
                <span className="text-2xl font-bold text-error">{formatRate(lowestRate.fundingRate)}</span>
                <span className="text-hub-gray-text text-sm ml-2">{lowestRate.symbol}</span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-3 bg-hub-gray/20 border border-hub-gray/30 rounded-xl text-white placeholder-hub-gray-text focus:outline-none focus:border-hub-yellow/50"
          />
          <select
            value={exchangeFilter}
            onChange={(e) => setExchangeFilter(e.target.value)}
            className="px-4 py-3 bg-hub-gray/20 border border-hub-gray/30 rounded-xl text-white focus:outline-none focus:border-hub-yellow/50"
          >
            <option value="all">All Exchanges</option>
            {exchanges.map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-error" />
            <span className="text-error">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && fundingRates.length === 0 ? (
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Loading funding rates from all exchanges...</span>
            </div>
          </div>
        ) : (
          /* Funding Rates Table */
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hub-gray/30">
                    <th
                      className="px-6 py-4 text-left text-sm font-semibold text-hub-gray-text cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('symbol')}
                    >
                      <div className="flex items-center gap-2">
                        Symbol
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-sm font-semibold text-hub-gray-text cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('exchange')}
                    >
                      <div className="flex items-center gap-2">
                        Exchange
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('fundingRate')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        Funding Rate
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">
                      Annualized
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">
                      Mark Price
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">
                      Next Funding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((fr, index) => {
                    const annualized = fr.fundingRate * 3 * 365; // 8h funding * 3 per day * 365
                    const nextFunding = fr.nextFundingTime
                      ? new Date(fr.nextFundingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '-';

                    return (
                      <tr
                        key={`${fr.symbol}-${fr.exchange}-${index}`}
                        className="border-b border-hub-gray/20 hover:bg-hub-gray/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{fr.symbol}</span>
                            <span className="text-hub-gray-text text-sm">/USDT</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeColor(fr.exchange)}`}>
                            {fr.exchange}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {fr.fundingRate > 0 ? (
                              <TrendingUp className="w-4 h-4 text-success" />
                            ) : fr.fundingRate < 0 ? (
                              <TrendingDown className="w-4 h-4 text-error" />
                            ) : null}
                            <span className={`font-mono font-semibold ${getRateColor(fr.fundingRate)}`}>
                              {formatRate(fr.fundingRate)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-mono text-sm ${getRateColor(annualized)}`}>
                            {annualized >= 0 ? '+' : ''}{annualized.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-white font-mono">
                            ${fr.markPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-hub-gray-text text-sm">{nextFunding}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredAndSorted.length === 0 && !loading && (
              <div className="p-8 text-center text-hub-gray-text">
                No funding rates found matching your criteria.
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-hub-gray-text">
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            Positive (Longs pay shorts)
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-error" />
            Negative (Shorts pay longs)
          </span>
          <span className="ml-auto">
            Data refreshes automatically every 30 seconds
          </span>
        </div>
      </main>
    </div>
  );
}
