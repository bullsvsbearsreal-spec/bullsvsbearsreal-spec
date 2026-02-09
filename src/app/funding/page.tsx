'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import { fetchAllFundingRates, fetchFundingArbitrage } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { TrendingUp, RefreshCw, AlertTriangle, Grid3X3, Table, Shuffle, Settings2, Check } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ALL_EXCHANGES, EXCHANGE_COLORS, CATEGORIES, CATEGORY_ICONS, PRIORITY_SYMBOLS } from '@/lib/constants';
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

export default function FundingPage() {
  const [sortField, setSortField] = useState<SortField>('fundingRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(new Set(ALL_EXCHANGES));
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);

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

  // Toggle exchange selection
  const toggleExchange = (exchange: string) => {
    setSelectedExchanges(prev => {
      const next = new Set(prev);
      if (next.has(exchange)) {
        if (next.size > 1) next.delete(exchange);
      } else {
        next.add(exchange);
      }
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

  // Calculate dynamic categories (highest/lowest funding rates)
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

  // Symbols for heatmap view
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

  // Heatmap data structure
  const heatmapData = new Map<string, Map<string, number>>();
  fundingRates.forEach(fr => {
    if (!heatmapData.has(fr.symbol)) heatmapData.set(fr.symbol, new Map());
    heatmapData.get(fr.symbol)!.set(fr.exchange, fr.fundingRate);
  });

  const visibleExchanges = ALL_EXCHANGES.filter(ex => selectedExchanges.has(ex));

  // Filter and sort data for table view
  const filteredAndSorted = fundingRates
    .filter(fr => {
      if (!selectedExchanges.has(fr.exchange)) return false;
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

  // Calculate stats
  const validRates = fundingRates.filter(fr => isValidNumber(fr.fundingRate));
  const avgRate = validRates.length > 0
    ? validRates.reduce((sum, fr) => sum + fr.fundingRate, 0) / validRates.length : 0;
  const highestRate = validRates.length > 0
    ? validRates.reduce((max, fr) => fr.fundingRate > max.fundingRate ? fr : max, validRates[0]) : null;
  const lowestRate = validRates.length > 0
    ? validRates.reduce((min, fr) => fr.fundingRate < min.fundingRate ? fr : min, validRates[0]) : null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-hub-yellow" />
              Funding Rates
            </h1>
            <p className="text-hub-gray-text mt-1">
              Real-time perpetual funding rates across all major exchanges
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-sm text-hub-gray-text">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh funding rates"
              className="p-2 text-hub-gray-text hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <FundingStats
          fundingRates={fundingRates}
          avgRate={avgRate}
          highestRate={highestRate}
          lowestRate={lowestRate}
        />

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(CATEGORIES) as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                categoryFilter === cat
                  ? 'bg-hub-yellow text-black'
                  : 'bg-hub-gray/20 border border-hub-gray/30 text-hub-gray-text hover:text-white hover:border-hub-gray/50'
              }`}
            >
              {(() => {
                const IconComponent = CATEGORY_ICONS[cat];
                return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
              })()}
              <span>{CATEGORIES[cat].name}</span>
            </button>
          ))}
        </div>

        {/* View Mode Selector */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-hub-gray/30">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'table' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'heatmap' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Heatmap
            </button>
            <button
              onClick={() => setViewMode('arbitrage')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'arbitrage' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              <Shuffle className="w-4 h-4" />
              Arbitrage
            </button>
          </div>

          {viewMode === 'table' && (
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-3 bg-hub-gray/20 border border-hub-gray/30 rounded-xl text-white placeholder-hub-gray-text focus:outline-none focus:border-hub-yellow/50"
            />
          )}

          {/* Exchange Selector */}
          <div className="relative">
            <button
              onClick={() => setShowExchangeSelector(!showExchangeSelector)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                showExchangeSelector
                  ? 'bg-hub-yellow text-black'
                  : 'bg-hub-gray/20 border border-hub-gray/30 text-hub-gray-text hover:text-white'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Exchanges ({selectedExchanges.size}/{ALL_EXCHANGES.length})
            </button>

            {showExchangeSelector && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-hub-dark border border-hub-gray/30 rounded-2xl p-4 shadow-xl min-w-[280px]">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-hub-gray/30">
                  <span className="text-white font-semibold text-sm">Select Exchanges</span>
                  <button
                    onClick={toggleAllExchanges}
                    className="text-xs text-hub-yellow hover:text-hub-yellow/80 transition-colors"
                  >
                    {selectedExchanges.size === ALL_EXCHANGES.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-2">
                  {ALL_EXCHANGES.map((exchange) => (
                    <button
                      key={exchange}
                      onClick={() => toggleExchange(exchange)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        selectedExchanges.has(exchange)
                          ? 'bg-hub-gray/40 border border-hub-gray/50'
                          : 'bg-hub-gray/10 border border-transparent hover:bg-hub-gray/20'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                        selectedExchanges.has(exchange) ? 'bg-hub-yellow' : 'bg-hub-gray/30 border border-hub-gray/50'
                      }`}>
                        {selectedExchanges.has(exchange) && <Check className="w-3 h-3 text-black" />}
                      </div>
                      <ExchangeLogo exchange={exchange.toLowerCase()} size={20} />
                      <span className={`text-sm font-medium ${
                        selectedExchanges.has(exchange) ? 'text-white' : 'text-hub-gray-text'
                      }`}>
                        {exchange}
                      </span>
                      <div className={`ml-auto w-2 h-2 rounded-full ${EXCHANGE_COLORS[exchange]}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          <>
            {viewMode === 'table' && (
              <FundingTableView
                data={filteredAndSorted}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            )}
            {viewMode === 'heatmap' && (
              <FundingHeatmapView
                symbols={symbols}
                visibleExchanges={[...visibleExchanges]}
                heatmapData={heatmapData}
              />
            )}
            {viewMode === 'arbitrage' && (
              <FundingArbitrageView arbitrageData={arbitrageData} />
            )}
          </>
        )}

        {/* Info */}
        <div className="mt-6 bg-hub-yellow/10 border border-hub-yellow/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-hub-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-hub-yellow text-sm font-medium">Understanding Funding Rates</p>
              <p className="text-hub-gray-text text-sm mt-1">
                <strong className="text-success">Positive rate</strong> = Longs pay shorts (market is bullish).
                <br />
                <strong className="text-danger">Negative rate</strong> = Shorts pay longs (market is bearish).
                <br />
                Funding is paid every 8 hours. Annualized = Rate × 3 × 365.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
