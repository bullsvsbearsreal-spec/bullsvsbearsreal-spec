'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpDown, AlertTriangle, Search, Info, Layers, BarChart3 } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';
import { useApiData } from '@/hooks/useApiData';
import { fetchAllFundingRates } from '@/lib/api/aggregator';

type SortField = 'symbol' | 'exchange' | 'markPrice' | 'indexPrice' | 'basis' | 'fundingRate';
type SortOrder = 'asc' | 'desc';
type BasisTab = 'all' | 'premium' | 'discount';

const ROWS_PER_PAGE = 50;

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
  if (!isFinite(basis)) return '—';
  return basis > 0 ? '+' + basis.toFixed(4) + '%' : basis.toFixed(4) + '%';
}

function formatFundingRate(rate: number): string {
  if (!isFinite(rate)) return '—';
  const pct = rate * 100;
  return pct > 0 ? '+' + pct.toFixed(4) + '%' : pct.toFixed(4) + '%';
}

export default function BasisPage() {
  const [sortField, setSortField] = useState<SortField>('basis');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [basisTab, setBasisTab] = useState<BasisTab>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetcher = useCallback(async () => {
    const data = await fetchAllFundingRates();
    return data;
  }, []);

  const { data: fundingRates, error, isLoading: loading, lastUpdate, refresh: fetchData } = useApiData({
    fetcher,
    refreshInterval: 60000, // 60s (server caches for 2 min)
  });

  const rawData = fundingRates ?? [];

  // Calculate basis for each entry, filtering out invalid prices and extreme outliers
  const MAX_BASIS_PCT = 50; // Filter entries with >50% basis (stale/incorrect index prices)

  const basisData: BasisEntry[] = useMemo(() => {
    return rawData
      .filter(fr => {
        const mp = fr.markPrice;
        const ip = fr.indexPrice;
        return typeof mp === 'number' && isFinite(mp) && mp > 0 &&
               typeof ip === 'number' && isFinite(ip) && ip > 0;
      })
      .map(fr => {
        const markPrice = fr.markPrice as number;
        const indexPrice = fr.indexPrice as number;
        const basis = ((markPrice - indexPrice) / indexPrice) * 100;
        return {
          symbol: fr.symbol,
          exchange: fr.exchange,
          markPrice,
          indexPrice,
          basis: isFinite(basis) ? basis : 0,
          fundingRate: fr.fundingRate,
          fundingInterval: fr.fundingInterval,
        };
      })
      .filter(entry => Math.abs(entry.basis) <= MAX_BASIS_PCT); // Remove extreme outliers
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageItems = filteredAndSorted.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Tab counts
  const premiumCount = useMemo(() => basisData.filter(b => b.basis > 0).length, [basisData]);
  const discountCount = useMemo(() => basisData.filter(b => b.basis < 0).length, [basisData]);

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
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 inline-block ml-1 ${sortField === field ? 'text-hub-yellow' : 'text-neutral-600'}`} />
  );

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <ArrowUpDown className="w-4 h-4 text-hub-yellow" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Basis / Premium</h1>
              <div className="flex items-center gap-1.5">
                {basisData.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />}
                <p className="text-neutral-500 text-sm">
                  Futures-spot price spread across {exchanges.length} exchanges
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[10px] text-neutral-600 font-mono">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-hub-yellow" />
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Avg Basis</span>
                <div className={`text-lg font-bold font-mono tabular-nums ${stats.avg > 0 ? 'text-success' : stats.avg < 0 ? 'text-danger' : 'text-white'}`}>
                  {formatBasis(stats.avg)}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Highest Premium</span>
                {stats.highest ? (
                  <div>
                    <span className="text-lg font-bold font-mono tabular-nums text-success">{formatBasis(stats.highest.basis)}</span>
                    <span className="text-neutral-400 text-xs ml-1.5">{stats.highest.symbol}</span>
                    <span className="text-neutral-600 text-[10px] ml-1">{stats.highest.exchange}</span>
                  </div>
                ) : (
                  <div className="text-lg font-bold font-mono tabular-nums text-neutral-600">—</div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Deepest Discount</span>
                {stats.deepest ? (
                  <div>
                    <span className="text-lg font-bold font-mono tabular-nums text-danger">{formatBasis(stats.deepest.basis)}</span>
                    <span className="text-neutral-400 text-xs ml-1.5">{stats.deepest.symbol}</span>
                    <span className="text-neutral-600 text-[10px] ml-1">{stats.deepest.exchange}</span>
                  </div>
                ) : (
                  <div className="text-lg font-bold font-mono tabular-nums text-neutral-600">—</div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] uppercase tracking-wider"># Symbols</span>
                <div className="text-lg font-bold text-white font-mono tabular-nums">{stats.count}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Basis tabs */}
          <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
            {([
              { key: 'all' as BasisTab, label: 'All', count: basisData.length },
              { key: 'premium' as BasisTab, label: 'Premium', count: premiumCount },
              { key: 'discount' as BasisTab, label: 'Discount', count: discountCount },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => { setBasisTab(key); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  basisTab === key ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white bg-white/[0.04]'
                }`}
              >
                {label}
                {basisTab === key && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/20">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Exchange filter */}
          <select
            value={exchangeFilter}
            onChange={(e) => { setExchangeFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs focus:outline-none focus:border-hub-yellow/40 appearance-none cursor-pointer"
          >
            <option value="all" className="bg-hub-darker">All Exchanges</option>
            {exchanges.map(ex => (
              <option key={ex} value={ex} className="bg-hub-darker">{ex}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[150px] max-w-[220px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40"
            />
          </div>

          <span className="text-[11px] text-neutral-600 ml-auto">
            {filteredAndSorted.length} entr{filteredAndSorted.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
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
                      className={`text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${sortField === 'symbol' ? 'text-hub-yellow' : 'text-neutral-500'}`}
                    >
                      Symbol
                      <SortIcon field="symbol" />
                    </th>
                    <th
                      onClick={() => handleSort('exchange')}
                      className={`text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${sortField === 'exchange' ? 'text-hub-yellow' : 'text-neutral-500'}`}
                    >
                      Exchange
                      <SortIcon field="exchange" />
                    </th>
                    <th
                      onClick={() => handleSort('markPrice')}
                      className={`text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${sortField === 'markPrice' ? 'text-hub-yellow' : 'text-neutral-500'}`}
                    >
                      Mark Price
                      <SortIcon field="markPrice" />
                    </th>
                    <th
                      onClick={() => handleSort('indexPrice')}
                      className={`text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${sortField === 'indexPrice' ? 'text-hub-yellow' : 'text-neutral-500'}`}
                    >
                      Index Price
                      <SortIcon field="indexPrice" />
                    </th>
                    <th
                      onClick={() => handleSort('basis')}
                      className={`text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${sortField === 'basis' ? 'text-hub-yellow' : 'text-neutral-500'}`}
                    >
                      Basis %
                      <SortIcon field="basis" />
                    </th>
                    <th
                      onClick={() => handleSort('fundingRate')}
                      className={`text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${sortField === 'fundingRate' ? 'text-hub-yellow' : 'text-neutral-500'}`}
                    >
                      Funding Rate
                      <SortIcon field="fundingRate" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-neutral-500 text-sm">
                        {searchTerm ? 'No matching entries.' : 'No entries for selected filters.'}
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((entry, idx) => (
                      <tr
                        key={`${entry.symbol}-${entry.exchange}-${startIdx + idx}`}
                        className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Symbol */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <TokenIconSimple symbol={entry.symbol} size={20} />
                            <span className="text-white font-medium text-xs">{entry.symbol}</span>
                          </div>
                        </td>
                        {/* Exchange */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <ExchangeLogo exchange={entry.exchange.toLowerCase()} size={16} />
                            <span className="text-neutral-400 text-xs">{entry.exchange}</span>
                          </div>
                        </td>
                        {/* Mark Price */}
                        <td className="px-3 py-2 text-right">
                          <span className="text-white font-mono tabular-nums text-xs">{formatPrice(entry.markPrice)}</span>
                        </td>
                        {/* Index Price */}
                        <td className="px-3 py-2 text-right">
                          <span className="text-neutral-400 font-mono tabular-nums text-xs">{formatPrice(entry.indexPrice)}</span>
                        </td>
                        {/* Basis % */}
                        <td className="px-3 py-2 text-right">
                          {Math.abs(entry.basis) >= 0.1 ? (
                            <span className={`h-5 rounded-md px-1.5 inline-flex items-center ${entry.basis > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                              <span className={`font-mono tabular-nums text-xs font-semibold ${
                                entry.basis > 0 ? 'text-success' : 'text-danger'
                              }`}>
                                {formatBasis(entry.basis)}
                              </span>
                            </span>
                          ) : (
                            <span className={`font-mono tabular-nums text-xs font-semibold ${
                              entry.basis > 0 ? 'text-success' : entry.basis < 0 ? 'text-danger' : 'text-neutral-500'
                            }`}>
                              {formatBasis(entry.basis)}
                            </span>
                          )}
                        </td>
                        {/* Funding Rate */}
                        <td className="px-3 py-2 text-right">
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

            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredAndSorted.length}
              rowsPerPage={ROWS_PER_PAGE}
              onPageChange={setCurrentPage}
              label="entries"
            />
          </div>
        )}

        {/* Info box */}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-hub-yellow mt-0.5 flex-shrink-0" />
            <span>
              <span className="text-success font-medium">Positive basis (premium)</span> = futures trading above spot; traders are bullish.{' '}
              <span className="text-danger font-medium">Negative basis (discount)</span> = futures trading below spot; traders are bearish.{' '}
              Basis is calculated as <span className="text-neutral-400 font-mono">(markPrice - indexPrice) / indexPrice x 100</span>.
              Large premiums often precede funding rate increases.
            </span>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
