'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchAllOpenInterest, aggregateOpenInterestBySymbol, aggregateOpenInterestByExchange } from '@/lib/api/aggregator';
import { OpenInterestData } from '@/lib/api/types';
import { RefreshCw, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { getExchangeBadgeColor } from '@/lib/constants';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatUSD } from '@/lib/utils/format';

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
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

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


  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Open Interest</h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Aggregate OI across {exchanges.length} exchanges
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-neutral-600">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-md text-neutral-400 text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#111] border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Total OI</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{formatUSD(totalOI)}</div>
          </div>
          <div className="bg-[#111] border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Symbols</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{symbolAggregated.size}</div>
          </div>
          <div className="bg-[#111] border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Exchanges</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{exchanges.length}</div>
          </div>
        </div>

        {/* Exchange Breakdown */}
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-4">
          <h3 className="text-white font-semibold text-sm mb-3">OI by Exchange</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from(exchangeAggregated.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([exchange, value]) => {
                const percentage = totalOI > 0 ? (value / totalOI) * 100 : 0;
                return (
                  <div key={exchange} className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                      <span className="text-neutral-400 text-xs">{exchange}</span>
                    </div>
                    <div className="text-sm font-bold text-white font-mono">{formatUSD(value)}</div>
                    <div className="text-[10px] text-neutral-600 font-mono">{percentage.toFixed(1)}%</div>
                    <div className="h-1 bg-white/[0.04] rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-hub-yellow rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* View Toggle & Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex rounded-md overflow-hidden bg-white/[0.04]">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'all' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
              }`}
            >
              All Data
            </button>
            <button
              onClick={() => setViewMode('aggregated')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'aggregated' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
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
            className="flex-1 min-w-[160px] px-3 py-1.5 bg-[#111] border border-white/[0.06] rounded-md text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/30"
          />
          {viewMode === 'all' && (
            <select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#111] border border-white/[0.06] rounded-md text-white text-xs focus:outline-none focus:border-hub-yellow/30"
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
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Loading open interest from all exchanges...</span>
            </div>
          </div>
        ) : viewMode === 'aggregated' ? (
          /* Aggregated View */
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Symbol</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Total OI Value</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">% of Total</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedSorted.map(([symbol, value], index) => {
                    const percentage = totalOI > 0 ? (value / totalOI) * 100 : 0;
                    return (
                      <tr
                        key={symbol}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-2">
                          <span className="text-neutral-600">#{index + 1}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{symbol}</span>
                            <span className="text-neutral-600 text-sm">/USDT</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-white font-mono font-semibold">{formatUSD(value)}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-neutral-600">{percentage.toFixed(2)}%</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="w-32 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-hub-yellow to-hub-orange rounded-full"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
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
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th
                      className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('symbol')}
                    >
                      <div className="flex items-center gap-2">
                        Symbol
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('exchange')}
                    >
                      <div className="flex items-center gap-2">
                        Exchange
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      Open Interest
                    </th>
                    <th
                      className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
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
                  {filteredAndSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((oi, index) => (
                    <tr
                      key={`${oi.symbol}-${oi.exchange}-${index}`}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{oi.symbol}</span>
                          <span className="text-neutral-500 text-sm">/USDT</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <ExchangeLogo exchange={oi.exchange.toLowerCase()} size={16} />
                          <span className={`text-xs font-medium ${getExchangeBadgeColor(oi.exchange)}`}>
                            {oi.exchange}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-neutral-500 font-mono">
                          {oi.openInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-white font-mono font-semibold">{formatUSD(oi.openInterestValue)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredAndSorted.length > PAGE_SIZE && (
              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-neutral-500 text-xs">
                  Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2.5 py-1 rounded text-xs text-neutral-400 hover:text-white bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="text-neutral-500 text-xs px-2">
                    {page + 1} / {Math.ceil(filteredAndSorted.length / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(filteredAndSorted.length / PAGE_SIZE) - 1, p + 1))}
                    disabled={(page + 1) * PAGE_SIZE >= filteredAndSorted.length}
                    className="px-2.5 py-1 rounded text-xs text-neutral-400 hover:text-white bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {filteredAndSorted.length === 0 && !loading && (
              <div className="p-8 text-center text-neutral-500">
                No open interest data found matching your criteria.
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 text-sm text-neutral-600">
          Data refreshes automatically every 30 seconds
        </div>
      </main>
      <Footer />
    </div>
  );
}
