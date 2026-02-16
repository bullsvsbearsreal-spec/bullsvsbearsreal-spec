'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpDown, AlertTriangle, Search } from 'lucide-react';
import { FundingRateData } from '@/lib/api/types';
import { formatPrice } from '@/lib/utils/format';
import { useApiData } from '@/hooks/useApiData';
import { fetchAllFundingRates } from '@/lib/api/aggregator';

type SortField = 'symbol' | 'exchange' | 'markPrice' | 'indexPrice' | 'basis' | 'fundingRate';
type SortOrder = 'asc' | 'desc';
type BasisTab = 'all' | 'premium' | 'discount';

interface BasisEntry {
  symbol: string;
  exchange: string;
  markPrice: number;
  indexPrice: number;
  basis: number;
  fundingRate: number;
  fundingInterval?: string;
}

function formatBasis(basis: number): string {
  return basis > 0 ? '+' + basis.toFixed(4) + '%' : basis.toFixed(4) + '%';
}

function formatFundingRate(rate: number): string {
  const pct = rate * 100;
  return pct > 0 ? '+' + pct.toFixed(4) + '%' : pct.toFixed(4) + '%';
}

export default function BasisPage() {
  const [sortField, setSortField] = useState<SortField>('basis');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [basisTab, setBasisTab] = useState<BasisTab>('all');

  const fetcher = useCallback(async () => {
    const data = await fetchAllFundingRates();
    return data;
  }, []);

  const { data: fundingRates, error, isLoading: loading, lastUpdate, refresh: fetchData } = useApiData({
    fetcher,
    refreshInterval: 30000,
  });

  const rawData = fundingRates ?? [];

  // Calculate basis for each entry, filtering out invalid prices
  const basisData: BasisEntry[] = useMemo(() => {
    return rawData
      .filter(fr => fr.markPrice && fr.markPrice > 0 && fr.indexPrice && fr.indexPrice > 0)
      .map(fr => ({
        symbol: fr.symbol,
        exchange: fr.exchange,
        markPrice: fr.markPrice!,
        indexPrice: fr.indexPrice!,
        basis: ((fr.markPrice! - fr.indexPrice!) / fr.indexPrice!) * 100,
        fundingRate: fr.fundingRate,
        fundingInterval: fr.fundingInterval,
      }));
  }, [rawData]);

  // Get unique exchanges
  const exchanges = useMemo(() => {
    return Array.from(new Set(basisData.map(b => b.exchange))).sort();
  }, [basisData]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    return basisData
      .filter(b => {
        if (exchangeFilter !== 'all' && b.exchange !== exchangeFilter) return false;
        if (searchTerm && !b.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (basisTab === 'premium' && b.basis <= 0) return false;
        if (basisTab === 'discount' && b.basis >= 0) return false;
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'symbol':
            comparison = a.symbol.localeCompare(b.symbol);
            break;
          case 'exchange':
            comparison = a.exchange.localeCompare(b.exchange);
            break;
          case 'markPrice':
            comparison = a.markPrice - b.markPrice;
            break;
          case 'indexPrice':
            comparison = a.indexPrice - b.indexPrice;
            break;
          case 'basis':
            comparison = Math.abs(a.basis) - Math.abs(b.basis);
            break;
          case 'fundingRate':
            comparison = Math.abs(a.fundingRate) - Math.abs(b.fundingRate);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [basisData, exchangeFilter, searchTerm, basisTab, sortField, sortOrder]);

  // Summary stats
  const stats = useMemo(() => {
    if (basisData.length === 0) return { avg: 0, highest: null as BasisEntry | null, deepest: null as BasisEntry | null, count: 0 };
    const avg = basisData.reduce((sum, b) => sum + b.basis, 0) / basisData.length;
    const highest = basisData.reduce((max, b) => b.basis > max.basis ? b : max, basisData[0]);
    const deepest = basisData.reduce((min, b) => b.basis < min.basis ? b : min, basisData[0]);
    const uniqueSymbols = new Set(basisData.map(b => b.symbol)).size;
    return { avg, highest, deepest, count: uniqueSymbols };
  }, [basisData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 inline-block ml-1 ${sortField === field ? 'text-hub-yellow' : 'text-neutral-600'}`} />
  );

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Basis / Premium</h1>
            <p className="text-neutral-500 text-sm">
              Futures-spot price spread across {exchanges.length} exchanges
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-neutral-600 font-mono">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh"
              className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Avg Basis</span>
            <div className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${stats.avg > 0 ? 'text-success' : stats.avg < 0 ? 'text-danger' : 'text-white'}`}>
              {formatBasis(stats.avg)}
            </div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-success" />
              Highest Premium
            </span>
            {stats.highest ? (
              <div className="mt-0.5">
                <span className="text-lg font-bold font-mono tabular-nums text-success">{formatBasis(stats.highest.basis)}</span>
                <span className="text-neutral-500 text-xs ml-1.5">{stats.highest.symbol}</span>
                <span className="text-neutral-600 text-[10px] ml-1">{stats.highest.exchange}</span>
              </div>
            ) : (
              <div className="text-lg font-bold font-mono tabular-nums text-neutral-600 mt-0.5">--</div>
            )}
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-danger" />
              Deepest Discount
            </span>
            {stats.deepest ? (
              <div className="mt-0.5">
                <span className="text-lg font-bold font-mono tabular-nums text-danger">{formatBasis(stats.deepest.basis)}</span>
                <span className="text-neutral-500 text-xs ml-1.5">{stats.deepest.symbol}</span>
                <span className="text-neutral-600 text-[10px] ml-1">{stats.deepest.exchange}</span>
              </div>
            ) : (
              <div className="text-lg font-bold font-mono tabular-nums text-neutral-600 mt-0.5">--</div>
            )}
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wider"># Symbols</span>
            <div className="text-lg font-bold text-white font-mono tabular-nums mt-0.5">{stats.count}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Basis tabs */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {([
              { key: 'all' as BasisTab, label: 'All' },
              { key: 'premium' as BasisTab, label: 'Premium' },
              { key: 'discount' as BasisTab, label: 'Discount' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setBasisTab(key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  basisTab === key ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {label}
                {basisTab === key && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/20">
                    {filteredAndSorted.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Exchange filter */}
          <select
            value={exchangeFilter}
            onChange={(e) => setExchangeFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs focus:outline-none focus:border-hub-yellow/40 appearance-none cursor-pointer"
          >
            <option value="all" className="bg-hub-darker">All Exchanges</option>
            {exchanges.map(ex => (
              <option key={ex} value={ex} className="bg-hub-darker">{ex}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3 h-3 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search symbols"
              className="w-full sm:w-40 pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
            <button
              onClick={fetchData}
              className="ml-auto text-xs text-red-400 hover:text-white underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && basisData.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <RefreshCw className="w-5 h-5 text-hub-yellow animate-spin mx-auto mb-2" />
            <span className="text-neutral-500 text-sm">Loading basis data...</span>
          </div>
        ) : basisData.length === 0 && !loading ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <div className="text-neutral-600 text-sm mb-2">No basis data available</div>
            <button
              onClick={fetchData}
              className="text-hub-yellow text-xs hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          /* Table */
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th
                      onClick={() => handleSort('symbol')}
                      className="text-left px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    >
                      Symbol
                      <SortIcon field="symbol" />
                    </th>
                    <th
                      onClick={() => handleSort('exchange')}
                      className="text-left px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    >
                      Exchange
                      <SortIcon field="exchange" />
                    </th>
                    <th
                      onClick={() => handleSort('markPrice')}
                      className="text-right px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    >
                      Mark Price
                      <SortIcon field="markPrice" />
                    </th>
                    <th
                      onClick={() => handleSort('indexPrice')}
                      className="text-right px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    >
                      Index Price
                      <SortIcon field="indexPrice" />
                    </th>
                    <th
                      onClick={() => handleSort('basis')}
                      className="text-right px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    >
                      Basis %
                      <SortIcon field="basis" />
                    </th>
                    <th
                      onClick={() => handleSort('fundingRate')}
                      className="text-right px-4 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    >
                      Funding Rate
                      <SortIcon field="fundingRate" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-neutral-600 text-sm">
                        No matching entries
                      </td>
                    </tr>
                  ) : (
                    filteredAndSorted.map((entry, idx) => (
                      <tr
                        key={`${entry.symbol}-${entry.exchange}-${idx}`}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Symbol */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <TokenIconSimple symbol={entry.symbol} size={20} />
                            <span className="text-white font-medium text-sm">{entry.symbol}</span>
                          </div>
                        </td>
                        {/* Exchange */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ExchangeLogo exchange={entry.exchange.toLowerCase()} size={16} />
                            <span className="text-neutral-400 text-xs">{entry.exchange}</span>
                          </div>
                        </td>
                        {/* Mark Price */}
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-white font-mono tabular-nums text-xs">{formatPrice(entry.markPrice)}</span>
                        </td>
                        {/* Index Price */}
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-neutral-400 font-mono tabular-nums text-xs">{formatPrice(entry.indexPrice)}</span>
                        </td>
                        {/* Basis % */}
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-mono tabular-nums text-xs font-semibold ${
                            entry.basis > 0 ? 'text-success' : entry.basis < 0 ? 'text-danger' : 'text-neutral-500'
                          }`}>
                            {formatBasis(entry.basis)}
                          </span>
                        </td>
                        {/* Funding Rate */}
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-mono tabular-nums text-xs ${
                            entry.fundingRate > 0 ? 'text-success' : entry.fundingRate < 0 ? 'text-danger' : 'text-neutral-500'
                          }`}>
                            {formatFundingRate(entry.fundingRate)}
                          </span>
                          {entry.fundingInterval && entry.fundingInterval !== '8h' && (
                            <span className="text-neutral-600 text-[10px] ml-1">/{entry.fundingInterval}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-neutral-600 text-xs">
                {filteredAndSorted.length} entries
              </span>
              <span className="text-neutral-700 text-[10px]">
                Auto-refreshes every 30s
              </span>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            <span className="text-success font-medium">Positive basis (premium)</span> = futures trading above spot; traders are bullish.{' '}
            <span className="text-danger font-medium">Negative basis (discount)</span> = futures trading below spot; traders are bearish.{' '}
            Basis is calculated as <span className="text-neutral-400 font-mono">(markPrice - indexPrice) / indexPrice x 100</span>.
            Large premiums often precede funding rate increases.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
