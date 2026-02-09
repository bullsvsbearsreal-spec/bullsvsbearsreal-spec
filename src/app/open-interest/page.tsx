'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { fetchAllOpenInterest, aggregateOpenInterestBySymbol, aggregateOpenInterestByExchange } from '@/lib/api/aggregator';
import { OpenInterestData } from '@/lib/api/types';
import { BarChart3, RefreshCw, Clock, AlertTriangle, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { getExchangeBadgeColor } from '@/lib/constants';

type SortField = 'symbol' | 'openInterestValue' | 'exchange';
type SortOrder = 'asc' | 'desc';

export default function OpenInterestPage() {
  const [openInterest, setOpenInterest] = useState<OpenInterestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('openInterestValue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'aggregated'>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllOpenInterest();
      setOpenInterest(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch open interest data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get unique exchanges
  const exchanges = Array.from(new Set(openInterest.map(oi => oi.exchange)));

  // Aggregate data
  const symbolAggregated = aggregateOpenInterestBySymbol(openInterest);
  const exchangeAggregated = aggregateOpenInterestByExchange(openInterest);

  // Filter and sort data
  const filteredAndSorted = openInterest
    .filter(oi => {
      if (exchangeFilter !== 'all' && oi.exchange !== exchangeFilter) return false;
      if (searchTerm && !oi.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'openInterestValue':
          comparison = a.openInterestValue - b.openInterestValue;
          break;
        case 'exchange':
          comparison = a.exchange.localeCompare(b.exchange);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Aggregated by symbol, sorted
  const aggregatedSorted = Array.from(symbolAggregated.entries())
    .filter(([symbol]) => !searchTerm || symbol.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b[1] - a[1]);

  // Calculate total OI
  const totalOI = openInterest.reduce((sum, oi) => sum + oi.openInterestValue, 0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatValue = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };


  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Open Interest</h1>
            <p className="text-hub-gray-text mt-1">
              Aggregate open interest across all major perpetual exchanges
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Total Open Interest</span>
            <div className="text-3xl font-bold text-white mt-1">{formatValue(totalOI)}</div>
          </div>
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Active Symbols</span>
            <div className="text-3xl font-bold text-white mt-1">{symbolAggregated.size}</div>
          </div>
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Exchanges</span>
            <div className="text-3xl font-bold text-white mt-1">{exchanges.length}</div>
          </div>
        </div>

        {/* Exchange Breakdown */}
        <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Open Interest by Exchange</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from(exchangeAggregated.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([exchange, value]) => {
                const percentage = totalOI > 0 ? (value / totalOI) * 100 : 0;
                return (
                  <div key={exchange} className="text-center">
                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${getExchangeBadgeColor(exchange)}`}>
                      {exchange}
                    </span>
                    <div className="text-xl font-bold text-white mt-2">{formatValue(value)}</div>
                    <div className="text-sm text-hub-gray-text">{percentage.toFixed(1)}%</div>
                    <div className="h-2 bg-hub-gray/30 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-hub-yellow to-hub-orange rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* View Toggle & Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-hub-gray/30">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'all' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              All Data
            </button>
            <button
              onClick={() => setViewMode('aggregated')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'aggregated' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              By Symbol
            </button>
          </div>
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-3 bg-hub-gray/20 border border-hub-gray/30 rounded-xl text-white placeholder-hub-gray-text focus:outline-none focus:border-hub-yellow/50"
          />
          {viewMode === 'all' && (
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
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-error" />
            <span className="text-error">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && openInterest.length === 0 ? (
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Loading open interest from all exchanges...</span>
            </div>
          </div>
        ) : viewMode === 'aggregated' ? (
          /* Aggregated View */
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hub-gray/30">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-hub-gray-text">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-hub-gray-text">Symbol</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">Total OI Value</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">% of Total</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-hub-gray-text">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedSorted.map(([symbol, value], index) => {
                    const percentage = totalOI > 0 ? (value / totalOI) * 100 : 0;
                    return (
                      <tr
                        key={symbol}
                        className="border-b border-hub-gray/20 hover:bg-hub-gray/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-hub-gray-text">#{index + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{symbol}</span>
                            <span className="text-hub-gray-text text-sm">/USDT</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-white font-mono font-semibold">{formatValue(value)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-hub-gray-text">{percentage.toFixed(2)}%</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-32 h-2 bg-hub-gray/30 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-hub-yellow to-hub-orange rounded-full"
                              style={{ width: `${Math.min(percentage * 2, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* All Data View */
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
                    <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">
                      Open Interest
                    </th>
                    <th
                      className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('openInterestValue')}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        OI Value
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((oi, index) => (
                    <tr
                      key={`${oi.symbol}-${oi.exchange}-${index}`}
                      className="border-b border-hub-gray/20 hover:bg-hub-gray/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{oi.symbol}</span>
                          <span className="text-hub-gray-text text-sm">/USDT</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeBadgeColor(oi.exchange)}`}>
                          {oi.exchange}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-hub-gray-text font-mono">
                          {oi.openInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-white font-mono font-semibold">{formatValue(oi.openInterestValue)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredAndSorted.length === 0 && !loading && (
              <div className="p-8 text-center text-hub-gray-text">
                No open interest data found matching your criteria.
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 text-sm text-hub-gray-text">
          Data refreshes automatically every 30 seconds
        </div>
      </main>
    </div>
  );
}
