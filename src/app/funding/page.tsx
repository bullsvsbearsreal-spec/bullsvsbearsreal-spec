'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import { fetchAllFundingRates, fetchFundingArbitrage } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { RefreshCw, AlertTriangle, Check, Settings2 } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ALL_EXCHANGES, EXCHANGE_COLORS, CATEGORIES, CATEGORY_ICONS, PRIORITY_SYMBOLS, DEX_EXCHANGES, isExchangeDex } from '@/lib/constants';
import type { Category } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { useApiData } from '@/hooks/useApiData';
import FundingStats from './components/FundingStats';
import FundingTableView from './components/FundingTableView';
import FundingHeatmapView from './components/FundingHeatmapView';
import FundingArbitrageView from './components/FundingArbitrageView';

type SortField = 'symbol' | 'fundingRate' | 'exchange' | 'predictedRate';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'heatmap' | 'table' | 'arbitrage';
type VenueFilter = 'all' | 'cex' | 'dex';

export default function FundingPage() {
  const [sortField, setSortField] = useState<SortField>('fundingRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(new Set(ALL_EXCHANGES));
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);
  const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');

  const fetcher = useCallback(async () => {
    const [data, arbData] = await Promise.all([
      fetchAllFundingRates(),
      fetchFundingArbitrage(),
    ]);
    const validData = data.filter(fr => fr && isValidNumber(fr.fundingRate));
    return { fundingRates: validData, arbitrageData: arbData };
  }, []);

  const { data, error, isLoading: loading, lastUpdate, refresh: fetchData } = useApiData({
    fetcher,
    refreshInterval: 30000,
  });

  const fundingRates = data?.fundingRates ?? [];
  const arbitrageData = data?.arbitrageData ?? [];

  const toggleExchange = (exchange: string) => {
    setSelectedExchanges(prev => {
      const next = new Set(prev);
      if (next.has(exchange)) { if (next.size > 1) next.delete(exchange); }
      else { next.add(exchange); }
      return next;
    });
  };

  const toggleAllExchanges = () => {
    if (selectedExchanges.size === ALL_EXCHANGES.length) {
      setSelectedExchanges(new Set([ALL_EXCHANGES[0]]));
    } else {
      setSelectedExchanges(new Set(ALL_EXCHANGES));
    }
  };

  const getSymbolAvgRate = (symbol: string) => {
    const rates = fundingRates.filter(fr => fr.symbol === symbol);
    return rates.length > 0 ? rates.reduce((sum, fr) => sum + fr.fundingRate, 0) / rates.length : 0;
  };

  const allSymbolsWithRates = Array.from(new Set(fundingRates.map(fr => fr.symbol)))
    .map(symbol => ({ symbol, avgRate: getSymbolAvgRate(symbol) }));

  const highestRateSymbols = [...allSymbolsWithRates]
    .sort((a, b) => b.avgRate - a.avgRate).slice(0, 30).map(s => s.symbol);
  const lowestRateSymbols = [...allSymbolsWithRates]
    .sort((a, b) => a.avgRate - b.avgRate).slice(0, 30).map(s => s.symbol);

  const getCategorySymbols = () => {
    if (categoryFilter === 'all') return null;
    if (categoryFilter === 'highest') return highestRateSymbols;
    if (categoryFilter === 'lowest') return lowestRateSymbols;
    return CATEGORIES[categoryFilter].symbols;
  };
  const categorySymbols = getCategorySymbols();

  const symbols = Array.from(new Set(fundingRates.map(fr => fr.symbol)))
    .filter(symbol => !categorySymbols || categorySymbols.includes(symbol))
    .sort((a, b) => {
      if (categoryFilter === 'highest') return getSymbolAvgRate(b) - getSymbolAvgRate(a);
      if (categoryFilter === 'lowest') return getSymbolAvgRate(a) - getSymbolAvgRate(b);
      const aPriority = PRIORITY_SYMBOLS.indexOf(a);
      const bPriority = PRIORITY_SYMBOLS.indexOf(b);
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      const aRates = fundingRates.filter(fr => fr.symbol === a);
      const bRates = fundingRates.filter(fr => fr.symbol === b);
      const aAvg = aRates.reduce((sum, fr) => sum + Math.abs(fr.fundingRate), 0) / aRates.length;
      const bAvg = bRates.reduce((sum, fr) => sum + Math.abs(fr.fundingRate), 0) / bRates.length;
      return bAvg - aAvg;
    })
    .slice(0, 50);

  const heatmapData = new Map<string, Map<string, number>>();
  fundingRates.forEach(fr => {
    if (!heatmapData.has(fr.symbol)) heatmapData.set(fr.symbol, new Map());
    heatmapData.get(fr.symbol)!.set(fr.exchange, fr.fundingRate);
  });

  const visibleExchanges = ALL_EXCHANGES.filter(ex => {
    if (!selectedExchanges.has(ex)) return false;
    if (venueFilter === 'dex' && !isExchangeDex(ex)) return false;
    if (venueFilter === 'cex' && isExchangeDex(ex)) return false;
    return true;
  });

  const filteredAndSorted = fundingRates
    .filter(fr => {
      if (!selectedExchanges.has(fr.exchange)) return false;
      if (venueFilter === 'dex' && !isExchangeDex(fr.exchange)) return false;
      if (venueFilter === 'cex' && isExchangeDex(fr.exchange)) return false;
      if (searchTerm && !fr.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'highest') return highestRateSymbols.includes(fr.symbol);
        if (categoryFilter === 'lowest') return lowestRateSymbols.includes(fr.symbol);
        return CATEGORIES[categoryFilter].symbols.includes(fr.symbol);
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol': comparison = a.symbol.localeCompare(b.symbol); break;
        case 'fundingRate': comparison = Math.abs(a.fundingRate) - Math.abs(b.fundingRate); break;
        case 'exchange': comparison = a.exchange.localeCompare(b.exchange); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const validRates = fundingRates.filter(fr => isValidNumber(fr.fundingRate));
  const avgRate = validRates.length > 0
    ? validRates.reduce((sum, fr) => sum + fr.fundingRate, 0) / validRates.length : 0;
  const highestRate = validRates.length > 0
    ? validRates.reduce((max, fr) => fr.fundingRate > max.fundingRate ? fr : max, validRates[0]) : null;
  const lowestRate = validRates.length > 0
    ? validRates.reduce((min, fr) => fr.fundingRate < min.fundingRate ? fr : min, validRates[0]) : null;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: 'table', label: 'Table' },
    { key: 'heatmap', label: 'Heatmap' },
    { key: 'arbitrage', label: 'Arbitrage' },
  ];

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Funding Rates</h1>
            <p className="text-neutral-500 text-sm">Real-time perpetual funding across {ALL_EXCHANGES.length} exchanges ({DEX_EXCHANGES.size} DEX)</p>
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

        {/* Stats */}
        <FundingStats
          fundingRates={fundingRates}
          avgRate={avgRate}
          highestRate={highestRate}
          lowestRate={lowestRate}
        />

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORIES) as Category[]).map((cat) => {
              const IconComponent = CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    categoryFilter === cat
                      ? 'bg-hub-yellow text-black'
                      : 'text-neutral-500 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
                  }`}
                >
                  {IconComponent && <IconComponent className="w-3 h-3" />}
                  {CATEGORIES[cat].name}
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* CEX / DEX venue filter */}
            <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
              {(['all', 'cex', 'dex'] as VenueFilter[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVenueFilter(v)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    venueFilter === v ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {v === 'all' ? 'All' : v.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
              {viewTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === key ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {viewMode === 'table' && (
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-36 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
              />
            )}

            <div className="relative">
              <button
                onClick={() => setShowExchangeSelector(!showExchangeSelector)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  showExchangeSelector
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-500 hover:text-white bg-white/[0.04] border border-white/[0.06]'
                }`}
              >
                <Settings2 className="w-3 h-3" />
                {selectedExchanges.size}/{ALL_EXCHANGES.length}
              </button>

              {showExchangeSelector && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#111] border border-white/[0.08] rounded-xl p-3 shadow-2xl shadow-black/80 min-w-[240px]">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/[0.06]">
                    <span className="text-white font-medium text-xs">Exchanges</span>
                    <button onClick={toggleAllExchanges} className="text-[10px] text-hub-yellow">
                      {selectedExchanges.size === ALL_EXCHANGES.length ? 'None' : 'All'}
                    </button>
                  </div>
                  <div className="space-y-0.5 max-h-80 overflow-y-auto">
                    {ALL_EXCHANGES.map((exchange) => (
                      <button
                        key={exchange}
                        onClick={() => toggleExchange(exchange)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-xs ${
                          selectedExchanges.has(exchange) ? 'bg-white/[0.06] text-white' : 'text-neutral-600 hover:text-neutral-400'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                          selectedExchanges.has(exchange) ? 'bg-hub-yellow' : 'bg-white/[0.06] border border-white/[0.1]'
                        }`}>
                          {selectedExchanges.has(exchange) && <Check className="w-2.5 h-2.5 text-black" />}
                        </div>
                        <ExchangeLogo exchange={exchange.toLowerCase()} size={16} />
                        <span className="font-medium">{exchange}</span>
                        {isExchangeDex(exchange) && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>
                        )}
                        <div className={`ml-auto w-1.5 h-1.5 rounded-full ${EXCHANGE_COLORS[exchange]}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && fundingRates.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <RefreshCw className="w-5 h-5 text-hub-yellow animate-spin mx-auto mb-2" />
            <span className="text-neutral-500 text-sm">Loading funding rates...</span>
          </div>
        ) : (
          <>
            {viewMode === 'table' && (
              <FundingTableView data={filteredAndSorted} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            )}
            {viewMode === 'heatmap' && (
              <FundingHeatmapView symbols={symbols} visibleExchanges={[...visibleExchanges]} heatmapData={heatmapData} />
            )}
            {viewMode === 'arbitrage' && (
              <FundingArbitrageView arbitrageData={arbitrageData} />
            )}
          </>
        )}

        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            <span className="text-green-400 font-medium">Positive rate</span> = longs pay shorts.{' '}
            <span className="text-red-400 font-medium">Negative rate</span> = shorts pay longs.{' '}
            Funding paid every 8h. Annualized = Rate x 3 x 365.
          </p>
        </div>
      </main>
    </div>
  );
}
