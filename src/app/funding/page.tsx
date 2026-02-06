'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { TokenIconSimple } from '@/components/TokenIcon';
import { fetchAllFundingRates, fetchFundingArbitrage } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { TrendingUp, TrendingDown, RefreshCw, Clock, AlertTriangle, ArrowUpDown, Grid3X3, Table, Shuffle, Settings2, Check } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';

type SortField = 'symbol' | 'fundingRate' | 'exchange';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'heatmap' | 'arbitrage';

// Exchange list for heatmap columns
const ALL_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid', 'dYdX'];

// Exchange colors for the selector
const EXCHANGE_COLORS: Record<string, string> = {
  'Binance': 'bg-yellow-500',
  'Bybit': 'bg-orange-500',
  'OKX': 'bg-white',
  'Bitget': 'bg-cyan-400',
  'Hyperliquid': 'bg-green-400',
  'dYdX': 'bg-purple-500',
};

// Priority symbols that should always appear first
const PRIORITY_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC', 'LTC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'APT', 'SUI', 'INJ'];

// Symbol categories
const CATEGORIES: Record<string, { name: string; emoji: string; symbols: string[]; dynamic?: string }> = {
  all: { name: 'All', emoji: '📊', symbols: [] },
  tops: { name: 'Top 20', emoji: '👑', symbols: ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'LTC', 'MATIC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'APT', 'SUI', 'INJ'] },
  alts: { name: 'Alts', emoji: '💎', symbols: ['SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'ATOM', 'NEAR', 'APT', 'SUI', 'SEI', 'TIA', 'INJ', 'FTM', 'ALGO', 'EGLD', 'FLOW', 'HBAR', 'ICP', 'KAVA', 'MINA', 'ONE', 'ROSE', 'CELO', 'ZIL'] },
  memes: { name: 'Memes', emoji: '🐕', symbols: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME', 'NEIRO', 'BRETT', 'POPCAT', 'MOG', 'TURBO', 'BABYDOGE', 'ELON', 'LADYS', 'WOJAK', 'BOME', 'SLERF', 'CAT', 'GOAT', 'PNUT', 'ACT', 'HIPPO', 'SPX', 'GIGA', 'MYRO', 'BOOK', 'WEN'] },
  layer2: { name: 'Layer 2', emoji: '🔶', symbols: ['ARB', 'OP', 'MATIC', 'IMX', 'METIS', 'STRK', 'MANTA', 'BLAST', 'ZK', 'SCROLL', 'MODE', 'ZETA'] },
  defi: { name: 'DeFi', emoji: '💰', symbols: ['UNI', 'AAVE', 'LINK', 'MKR', 'SNX', 'CRV', 'COMP', 'SUSHI', 'YFI', 'LDO', 'DYDX', 'GMX', 'PENDLE', 'JUP', 'RAY', 'INJ', 'CAKE', 'BAL', 'RUNE', '1INCH', 'DODO', 'PERP'] },
  ai: { name: 'AI', emoji: '🤖', symbols: ['FET', 'RENDER', 'AGIX', 'OCEAN', 'TAO', 'WLD', 'RNDR', 'AKT', 'ARKM', 'AI', 'AIOZ', 'PHB', 'NMR', 'CTXC', 'OLAS', 'ALI', 'GLM', 'LPT', 'VIRTUAL', 'AI16Z'] },
  gaming: { name: 'Gaming', emoji: '🎮', symbols: ['AXS', 'SAND', 'MANA', 'IMX', 'GALA', 'ENJ', 'ILV', 'MAGIC', 'PIXEL', 'PRIME', 'PORTAL', 'YGG', 'RON', 'SUPER', 'GODS', 'LOKA', 'PYR', 'ALICE', 'BEAM', 'BIGTIME'] },
  highest: { name: 'Highest', emoji: '🚀', symbols: [], dynamic: 'highest' },
  lowest: { name: 'Lowest', emoji: '📉', symbols: [], dynamic: 'lowest' },
};

type Category = keyof typeof CATEGORIES;

export default function FundingPage() {
  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [arbitrageData, setArbitrageData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('fundingRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(new Set(ALL_EXCHANGES));
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);

  // Toggle exchange selection
  const toggleExchange = (exchange: string) => {
    setSelectedExchanges(prev => {
      const next = new Set(prev);
      if (next.has(exchange)) {
        // Don't allow deselecting all exchanges
        if (next.size > 1) {
          next.delete(exchange);
        }
      } else {
        next.add(exchange);
      }
      return next;
    });
  };

  // Select/deselect all exchanges
  const toggleAllExchanges = () => {
    if (selectedExchanges.size === ALL_EXCHANGES.length) {
      // Keep at least one exchange selected
      setSelectedExchanges(new Set([ALL_EXCHANGES[0]]));
    } else {
      setSelectedExchanges(new Set(ALL_EXCHANGES));
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, arbData] = await Promise.all([
        fetchAllFundingRates(),
        fetchFundingArbitrage(),
      ]);
      const validData = data.filter(fr =>
        fr &&
        typeof fr.fundingRate === 'number' &&
        !isNaN(fr.fundingRate) &&
        isFinite(fr.fundingRate)
      );
      setFundingRates(validData);
      setArbitrageData(arbData);
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get unique exchanges and symbols for heatmap
  const exchanges = Array.from(new Set(fundingRates.map(fr => fr.exchange)));

  // Calculate dynamic categories (highest/lowest funding rates)
  const getSymbolAvgRate = (symbol: string) => {
    const rates = fundingRates.filter(fr => fr.symbol === symbol);
    return rates.length > 0 ? rates.reduce((sum, fr) => sum + fr.fundingRate, 0) / rates.length : 0;
  };

  const allSymbolsWithRates = Array.from(new Set(fundingRates.map(fr => fr.symbol)))
    .map(symbol => ({ symbol, avgRate: getSymbolAvgRate(symbol) }));

  const highestRateSymbols = [...allSymbolsWithRates]
    .sort((a, b) => b.avgRate - a.avgRate)
    .slice(0, 30)
    .map(s => s.symbol);

  const lowestRateSymbols = [...allSymbolsWithRates]
    .sort((a, b) => a.avgRate - b.avgRate)
    .slice(0, 30)
    .map(s => s.symbol);

  // Get category symbols (handle dynamic categories)
  const getCategorySymbols = () => {
    if (categoryFilter === 'all') return null;
    if (categoryFilter === 'highest') return highestRateSymbols;
    if (categoryFilter === 'lowest') return lowestRateSymbols;
    return CATEGORIES[categoryFilter].symbols;
  };

  const categorySymbols = getCategorySymbols();

  const symbols = Array.from(new Set(fundingRates.map(fr => fr.symbol)))
    .filter(symbol => {
      // If category is selected, only show symbols in that category
      if (categorySymbols) {
        return categorySymbols.includes(symbol);
      }
      return true;
    })
    .sort((a, b) => {
      // For highest/lowest categories, sort by rate
      if (categoryFilter === 'highest') {
        return getSymbolAvgRate(b) - getSymbolAvgRate(a);
      }
      if (categoryFilter === 'lowest') {
        return getSymbolAvgRate(a) - getSymbolAvgRate(b);
      }

      // Priority symbols always come first
      const aPriority = PRIORITY_SYMBOLS.indexOf(a);
      const bPriority = PRIORITY_SYMBOLS.indexOf(b);

      // If both are priority symbols, sort by priority order
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      // If only a is priority, it comes first
      if (aPriority !== -1) return -1;
      // If only b is priority, it comes first
      if (bPriority !== -1) return 1;

      // For non-priority symbols, sort by average absolute funding rate
      const aRates = fundingRates.filter(fr => fr.symbol === a);
      const bRates = fundingRates.filter(fr => fr.symbol === b);
      const aAvg = aRates.reduce((sum, fr) => sum + Math.abs(fr.fundingRate), 0) / aRates.length;
      const bAvg = bRates.reduce((sum, fr) => sum + Math.abs(fr.fundingRate), 0) / bRates.length;
      return bAvg - aAvg;
    })
    .slice(0, 50); // Top 50 symbols (increased to include more)

  // Create heatmap data structure
  const heatmapData = new Map<string, Map<string, number>>();
  fundingRates.forEach(fr => {
    if (!heatmapData.has(fr.symbol)) {
      heatmapData.set(fr.symbol, new Map());
    }
    heatmapData.get(fr.symbol)!.set(fr.exchange, fr.fundingRate);
  });

  // Get selected exchanges as array for heatmap
  const visibleExchanges = ALL_EXCHANGES.filter(ex => selectedExchanges.has(ex));

  // Filter and sort data for table view
  const filteredAndSorted = fundingRates
    .filter(fr => {
      // Filter by selected exchanges
      if (!selectedExchanges.has(fr.exchange)) return false;
      if (searchTerm && !fr.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // Apply category filter (handle dynamic categories)
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'highest') {
          return highestRateSymbols.includes(fr.symbol);
        }
        if (categoryFilter === 'lowest') {
          return lowestRateSymbols.includes(fr.symbol);
        }
        return CATEGORIES[categoryFilter].symbols.includes(fr.symbol);
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'fundingRate':
          comparison = Math.abs(a.fundingRate) - Math.abs(b.fundingRate);
          break;
        case 'exchange':
          comparison = a.exchange.localeCompare(b.exchange);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Calculate stats
  const validRates = fundingRates.filter(fr =>
    typeof fr.fundingRate === 'number' && !isNaN(fr.fundingRate) && isFinite(fr.fundingRate)
  );
  const avgRate = validRates.length > 0
    ? validRates.reduce((sum, fr) => sum + fr.fundingRate, 0) / validRates.length
    : 0;
  const highestRate = validRates.length > 0
    ? validRates.reduce((max, fr) => fr.fundingRate > max.fundingRate ? fr : max, validRates[0])
    : null;
  const lowestRate = validRates.length > 0
    ? validRates.reduce((min, fr) => fr.fundingRate < min.fundingRate ? fr : min, validRates[0])
    : null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatRate = (rate: number | undefined | null) => {
    if (rate === undefined || rate === null || isNaN(rate) || !isFinite(rate)) {
      return '-';
    }
    const formatted = rate.toFixed(4);
    return rate >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const getRateColor = (rate: number) => {
    if (rate > 0.05) return 'text-success';
    if (rate < -0.05) return 'text-danger';
    return 'text-hub-gray-text';
  };

  const getHeatmapColor = (rate: number | undefined) => {
    if (rate === undefined) return 'bg-hub-gray/20';
    if (rate > 0.1) return 'bg-green-500';
    if (rate > 0.05) return 'bg-green-600';
    if (rate > 0.01) return 'bg-green-700';
    if (rate > 0) return 'bg-green-800';
    if (rate < -0.1) return 'bg-red-500';
    if (rate < -0.05) return 'bg-red-600';
    if (rate < -0.01) return 'bg-red-700';
    if (rate < 0) return 'bg-red-800';
    return 'bg-hub-gray/30';
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
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-hub-yellow" />
              Funding Rates
            </h1>
            <p className="text-hub-gray-text mt-1">
              Real-time perpetual funding rates across all major exchanges
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-sm text-hub-gray-text flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-hub-yellow/20 hover:bg-hub-yellow/30 border border-hub-yellow/30 rounded-xl text-hub-yellow transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
          <div className="bg-success/10 border border-success/30 rounded-2xl p-5">
            <span className="text-success text-sm">Highest Rate</span>
            {highestRate && (
              <div className="mt-1">
                <span className="text-2xl font-bold text-success">{formatRate(highestRate.fundingRate)}</span>
                <span className="text-success/70 text-sm ml-2">{highestRate.symbol}</span>
              </div>
            )}
          </div>
          <div className="bg-danger/10 border border-danger/30 rounded-2xl p-5">
            <span className="text-danger text-sm">Lowest Rate</span>
            {lowestRate && (
              <div className="mt-1">
                <span className="text-2xl font-bold text-danger">{formatRate(lowestRate.fundingRate)}</span>
                <span className="text-danger/70 text-sm ml-2">{lowestRate.symbol}</span>
              </div>
            )}
          </div>
        </div>

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
              <span>{CATEGORIES[cat].emoji}</span>
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

          {/* Exchange Selector Button */}
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

            {/* Exchange Selector Dropdown */}
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
            {/* Table View */}
            {viewMode === 'table' && (
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
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSorted.slice(0, 100).map((fr, index) => {
                        const annualized = fr.fundingRate * 3 * 365;
                        return (
                          <tr
                            key={`${fr.symbol}-${fr.exchange}-${index}`}
                            className="border-b border-hub-gray/20 hover:bg-hub-gray/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <TokenIconSimple symbol={fr.symbol} size={28} />
                                <span className="text-white font-semibold">{fr.symbol}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeColor(fr.exchange)}`}>
                                {fr.exchange}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`font-mono font-semibold ${getRateColor(fr.fundingRate)}`}>
                                {formatRate(fr.fundingRate)}
                              </span>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Heatmap View */}
            {viewMode === 'heatmap' && (
              <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-hub-gray/30">
                  <h3 className="text-white font-semibold">Funding Rate Heatmap</h3>
                  <p className="text-hub-gray-text text-sm">Compare rates across exchanges (green = positive, red = negative)</p>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-sm font-semibold text-hub-gray-text">Symbol</th>
                        {visibleExchanges.map(ex => (
                          <th key={ex} className="px-3 py-2 text-center text-sm font-semibold text-hub-gray-text">
                            <div className="flex items-center justify-center gap-2">
                              <ExchangeLogo exchange={ex.toLowerCase()} size={16} />
                              <span>{ex}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {symbols.map(symbol => {
                        const rates = heatmapData.get(symbol);
                        return (
                          <tr key={symbol} className="border-t border-hub-gray/20">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <TokenIconSimple symbol={symbol} size={24} />
                                <span className="text-white font-medium text-sm">{symbol}</span>
                              </div>
                            </td>
                            {visibleExchanges.map(ex => {
                              const rate = rates?.get(ex);
                              return (
                                <td key={ex} className="px-1 py-1">
                                  <div
                                    className={`${getHeatmapColor(rate)} rounded-lg px-2 py-2 text-center text-xs font-mono text-white/90`}
                                    title={`${symbol} on ${ex}: ${rate !== undefined ? formatRate(rate) : 'N/A'}`}
                                  >
                                    {rate !== undefined ? formatRate(rate) : '-'}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="p-4 border-t border-hub-gray/30 flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500" />
                    <span className="text-hub-gray-text">&lt; -0.1%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-700" />
                    <span className="text-hub-gray-text">-0.1% to 0%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-hub-gray/30" />
                    <span className="text-hub-gray-text">0%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-700" />
                    <span className="text-hub-gray-text">0% to +0.1%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500" />
                    <span className="text-hub-gray-text">&gt; +0.1%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Arbitrage View */}
            {viewMode === 'arbitrage' && (
              <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-hub-gray/30">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Shuffle className="w-5 h-5 text-hub-yellow" />
                    Funding Rate Arbitrage Opportunities
                  </h3>
                  <p className="text-hub-gray-text text-sm">Largest spread between exchanges (long on low rate, short on high rate)</p>
                </div>
                <div className="divide-y divide-hub-gray/20">
                  {arbitrageData.slice(0, 20).map((item, index) => {
                    const sortedExchanges = [...item.exchanges].sort((a: any, b: any) => b.rate - a.rate);
                    const highestEx = sortedExchanges[0];
                    const lowestEx = sortedExchanges[sortedExchanges.length - 1];

                    return (
                      <div key={item.symbol} className="p-4 hover:bg-hub-gray/30 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-hub-gray-text text-sm w-6">{index + 1}</span>
                            <TokenIconSimple symbol={item.symbol} size={32} />
                            <span className="text-white font-bold text-lg">{item.symbol}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-hub-yellow font-bold">
                              Spread: {item.spread.toFixed(4)}%
                            </div>
                            <div className="text-hub-gray-text text-xs">
                              Annualized: {(item.spread * 3 * 365).toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
                            <div className="text-danger text-xs mb-1">SHORT here (highest rate)</div>
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeColor(highestEx.exchange)}`}>
                                {highestEx.exchange}
                              </span>
                              <span className="text-danger font-mono font-bold">
                                {formatRate(highestEx.rate)}
                              </span>
                            </div>
                          </div>
                          <div className="bg-success/10 border border-success/20 rounded-xl p-3">
                            <div className="text-success text-xs mb-1">LONG here (lowest rate)</div>
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeColor(lowestEx.exchange)}`}>
                                {lowestEx.exchange}
                              </span>
                              <span className="text-success font-mono font-bold">
                                {formatRate(lowestEx.rate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* All exchanges for this symbol */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {sortedExchanges.map((ex: any) => (
                            <div
                              key={ex.exchange}
                              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-hub-gray/30 text-xs"
                            >
                              <span className="text-hub-gray-text">{ex.exchange}:</span>
                              <span className={ex.rate >= 0 ? 'text-success' : 'text-danger'}>
                                {formatRate(ex.rate)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {arbitrageData.length === 0 && (
                  <div className="p-8 text-center text-hub-gray-text">
                    No arbitrage opportunities found.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Legend */}
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
