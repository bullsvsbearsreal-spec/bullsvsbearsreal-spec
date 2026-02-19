'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { fetchAllFundingRates, fetchFundingArbitrage, fetchAllOpenInterest, type AssetClassFilter } from '@/lib/api/aggregator';
import { FundingRateData } from '@/lib/api/types';
import { RefreshCw, AlertTriangle, Check, Settings2, TrendingUp, DollarSign, BarChart3, Gem as CommodityIcon } from 'lucide-react';
import UpdatedAgo from '@/components/UpdatedAgo';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ALL_EXCHANGES, EXCHANGE_COLORS, CATEGORIES, CATEGORY_ICONS, PRIORITY_SYMBOLS, DEX_EXCHANGES, isExchangeDex, getCategoriesForAssetClass } from '@/lib/constants';
import type { Category, AssetClass } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { useApiData } from '@/hooks/useApiData';
import FundingStats from './components/FundingStats';
import FundingTableView from './components/FundingTableView';
import FundingHeatmapView from './components/FundingHeatmapView';
import FundingArbitrageView from './components/FundingArbitrageView';
import ShareButton from '@/components/ShareButton';
import Footer from '@/components/Footer';
import { saveFundingSnapshot, getFundingHistory, getAccumulatedFundingBatch, type HistoryPoint, type AccumulatedFunding } from '@/lib/storage/fundingHistory';

type SortField = 'symbol' | 'fundingRate' | 'exchange';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'heatmap' | 'table' | 'arbitrage';
type VenueFilter = 'all' | 'cex' | 'dex';

const ASSET_CLASS_TABS: { key: AssetClass; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'crypto', label: 'Crypto', icon: TrendingUp },
  { key: 'stocks', label: 'Stocks', icon: BarChart3 },
  { key: 'forex', label: 'Forex', icon: DollarSign },
  { key: 'commodities', label: 'Commodities', icon: CommodityIcon },
];

const ASSET_CLASS_SUBTITLES: Record<AssetClass, string> = {
  crypto: 'Real-time perpetual funding',
  stocks: 'Real-time stock perp funding',
  forex: 'Real-time forex perp funding',
  commodities: 'Real-time commodity perp funding',
};

export default function FundingPage() {
  const [sortField, setSortField] = useState<SortField>('fundingRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(ALL_EXCHANGES);
    try {
      const saved = localStorage.getItem('infohub:funding:exchanges');
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        const valid = arr.filter(e => (ALL_EXCHANGES as readonly string[]).includes(e));
        if (valid.length > 0) return new Set(valid);
      }
    } catch {}
    return new Set(ALL_EXCHANGES);
  });
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);
  const [venueFilter, setVenueFilter] = useState<VenueFilter>(() => {
    if (typeof window === 'undefined') return 'all';
    return (localStorage.getItem('infohub:funding:venue') as VenueFilter) || 'all';
  });
  const [assetClass, setAssetClass] = useState<AssetClass>('crypto');
  const exchangeSelectorRef = useRef<HTMLDivElement>(null);

  // Persist exchange selection & venue filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('infohub:funding:exchanges', JSON.stringify(Array.from(selectedExchanges)));
    } catch {}
  }, [selectedExchanges]);

  useEffect(() => {
    try {
      localStorage.setItem('infohub:funding:venue', venueFilter);
    } catch {}
  }, [venueFilter]);

  // Close exchange selector on Escape or click outside
  useEffect(() => {
    if (!showExchangeSelector) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowExchangeSelector(false); };
    const handleClick = (e: MouseEvent) => {
      if (exchangeSelectorRef.current && !exchangeSelectorRef.current.contains(e.target as Node)) setShowExchangeSelector(false);
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => { window.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); };
  }, [showExchangeSelector]);

  // Get dynamic categories/icons/priorities for current asset class
  const { categories: activeCategories, icons: activeCategoryIcons, prioritySymbols: activePrioritySymbols } = useMemo(
    () => getCategoriesForAssetClass(assetClass),
    [assetClass]
  );

  const fetcher = useCallback(async () => {
    const [data, arbData, oiData] = await Promise.all([
      fetchAllFundingRates(assetClass as AssetClassFilter),
      assetClass === 'crypto' ? fetchFundingArbitrage() : Promise.resolve([]),
      assetClass === 'crypto' ? fetchAllOpenInterest() : Promise.resolve([]),
    ]);
    const validData = data.filter(fr => fr && isValidNumber(fr.fundingRate));
    // Build OI lookup: "SYMBOL|EXCHANGE" → openInterestValue (USD)
    const oiMap = new Map<string, number>();
    (Array.isArray(oiData) ? oiData : []).forEach((oi: any) => {
      if (oi.openInterestValue > 0) {
        oiMap.set(`${oi.symbol}|${oi.exchange}`, oi.openInterestValue);
      }
    });
    return { fundingRates: validData, arbitrageData: arbData, oiMap };
  }, [assetClass]);

  const { data, error, isLoading: loading, lastUpdate, refresh: fetchData } = useApiData({
    fetcher,
    refreshInterval: 30000,
  });

  const fundingRates = Array.isArray(data?.fundingRates) ? data.fundingRates : [];
  const arbitrageData = Array.isArray(data?.arbitrageData) ? data.arbitrageData : [];
  const oiMap = data?.oiMap ?? new Map<string, number>();

  // Build mark prices map: first seen price per symbol (for arb view)
  const markPricesMap = useMemo(() => {
    const map = new Map<string, number>();
    fundingRates.forEach(fr => {
      if (fr.markPrice && fr.markPrice > 0 && !map.has(fr.symbol)) {
        map.set(fr.symbol, fr.markPrice);
      }
    });
    return map;
  }, [fundingRates]);

  // Save funding snapshot for historical sparklines
  useEffect(() => {
    if (fundingRates.length > 0) {
      saveFundingSnapshot(fundingRates);
    }
  }, [fundingRates]);

  // Build history map for sparklines (only for visible rows)
  const historyMap = useMemo(() => {
    if (typeof window === 'undefined' || fundingRates.length === 0) return new Map<string, HistoryPoint[]>();
    const map = new Map<string, HistoryPoint[]>();
    // Only load history for top-100 visible rows to avoid scanning localStorage excessively
    const seen = new Set<string>();
    fundingRates.slice(0, 100).forEach(fr => {
      const key = `${fr.symbol}|${fr.exchange}`;
      if (seen.has(key)) return;
      seen.add(key);
      const history = getFundingHistory(fr.symbol, fr.exchange, 7);
      if (history.length >= 2) {
        map.set(key, history);
      }
    });
    return map;
  }, [fundingRates]);

  // Build accumulated funding map (1D/7D/30D cumulative rates)
  const accumulatedMap = useMemo(() => {
    if (typeof window === 'undefined' || fundingRates.length === 0) return new Map<string, AccumulatedFunding>();
    const pairs: { symbol: string; exchange: string }[] = [];
    const seen = new Set<string>();
    fundingRates.slice(0, 100).forEach(fr => {
      const key = `${fr.symbol}|${fr.exchange}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ symbol: fr.symbol, exchange: fr.exchange });
    });
    return getAccumulatedFundingBatch(pairs);
  }, [fundingRates]);

  const handleAssetClassChange = (newAssetClass: AssetClass) => {
    setAssetClass(newAssetClass);
    setCategoryFilter('all'); // Reset category on asset class change
    setSearchTerm('');
  };

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
    if (rates.length === 0) return 0;
    // Normalize to 8h basis for cross-exchange comparison
    const sum8h = rates.reduce((sum, fr) => {
      const mult = fr.fundingInterval === '1h' ? 8 : fr.fundingInterval === '4h' ? 2 : 1;
      return sum + fr.fundingRate * mult;
    }, 0);
    return sum8h / rates.length;
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
    return activeCategories[categoryFilter]?.symbols || null;
  };
  const categorySymbols = getCategorySymbols();

  const symbols = Array.from(new Set(fundingRates.map(fr => fr.symbol)))
    .filter(symbol => !categorySymbols || categorySymbols.includes(symbol))
    .sort((a, b) => {
      if (categoryFilter === 'highest') return getSymbolAvgRate(b) - getSymbolAvgRate(a);
      if (categoryFilter === 'lowest') return getSymbolAvgRate(a) - getSymbolAvgRate(b);
      const aPriority = activePrioritySymbols.indexOf(a);
      const bPriority = activePrioritySymbols.indexOf(b);
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      const aRates = fundingRates.filter(fr => fr.symbol === a);
      const bRates = fundingRates.filter(fr => fr.symbol === b);
      const norm = (fr: typeof aRates[0]) => { const m = fr.fundingInterval === '1h' ? 8 : fr.fundingInterval === '4h' ? 2 : 1; return Math.abs(fr.fundingRate) * m; };
      const aAvg = aRates.reduce((sum, fr) => sum + norm(fr), 0) / aRates.length;
      const bAvg = bRates.reduce((sum, fr) => sum + norm(fr), 0) / bRates.length;
      return bAvg - aAvg;
    })
;

  const heatmapData = new Map<string, Map<string, number>>();
  const intervalMap = new Map<string, string>(); // "SYMBOL|EXCHANGE" → interval
  const longShortMap = new Map<string, { long: number; short: number }>(); // L/S rates for skew-based DEXes
  fundingRates.forEach(fr => {
    if (!heatmapData.has(fr.symbol)) heatmapData.set(fr.symbol, new Map());
    heatmapData.get(fr.symbol)!.set(fr.exchange, fr.fundingRate);
    if (fr.fundingInterval && fr.fundingInterval !== '8h') {
      intervalMap.set(`${fr.symbol}|${fr.exchange}`, fr.fundingInterval);
    }
    if (fr.fundingRateLong !== undefined && fr.fundingRateShort !== undefined) {
      longShortMap.set(`${fr.symbol}|${fr.exchange}`, { long: fr.fundingRateLong, short: fr.fundingRateShort });
    }
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
        return (activeCategories[categoryFilter]?.symbols || []).includes(fr.symbol);
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
    ? validRates.reduce((sum, fr) => {
        const mult = fr.fundingInterval === '1h' ? 8 : fr.fundingInterval === '4h' ? 2 : 1;
        return sum + fr.fundingRate * mult;
      }, 0) / validRates.length : 0;
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
    ...(assetClass === 'crypto' ? [{ key: 'arbitrage' as ViewMode, label: 'Arbitrage' }] : []),
  ];

  const categoryKeys = Object.keys(activeCategories);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Funding Rates</h1>
            <p className="text-neutral-500 text-sm">{ASSET_CLASS_SUBTITLES[assetClass]} across {ALL_EXCHANGES.length} exchanges ({DEX_EXCHANGES.size} DEX)</p>
          </div>
          <div className="flex items-center gap-3">
            <UpdatedAgo date={lastUpdate} />
            <ShareButton text={`Check out ${assetClass} funding rates on InfoHub — free, no signup, 21 exchanges`} />
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

        {/* Asset Class Tabs */}
        <div className="flex items-center gap-1 mb-4 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit" role="tablist" aria-label="Asset class">
          {ASSET_CLASS_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={assetClass === key}
              onClick={() => handleAssetClassChange(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                assetClass === key
                  ? 'bg-hub-yellow text-black shadow-sm'
                  : 'text-neutral-500 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {assetClass === key && fundingRates.length > 0 && (
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  assetClass === key ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-400'
                }`}>
                  {fundingRates.length}
                </span>
              )}
            </button>
          ))}
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
            {categoryKeys.map((cat) => {
              const IconComponent = activeCategoryIcons[cat];
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
                  {activeCategories[cat].name}
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
                aria-label="Search symbols"
                className="w-full sm:w-36 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40"
              />
            )}

            <div className="relative" ref={exchangeSelectorRef}>
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
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#0e0e0e] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/80 min-w-[280px] overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-3.5 h-3.5 text-hub-yellow" />
                      <span className="text-white font-semibold text-xs">Exchanges</span>
                      <span className="text-[10px] text-neutral-500 font-mono">{selectedExchanges.size}/{ALL_EXCHANGES.length}</span>
                    </div>
                    <button onClick={toggleAllExchanges} className="text-[10px] font-semibold text-hub-yellow hover:text-hub-yellow/80 transition-colors px-2 py-0.5 rounded bg-hub-yellow/10 hover:bg-hub-yellow/15">
                      {selectedExchanges.size === ALL_EXCHANGES.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="p-2 max-h-[400px] overflow-y-auto">
                    {/* CEX Section */}
                    <div className="mb-1">
                      <div className="px-2 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Centralized ({ALL_EXCHANGES.filter(e => !isExchangeDex(e)).length})</div>
                      <div className="grid grid-cols-2 gap-0.5">
                        {ALL_EXCHANGES.filter(e => !isExchangeDex(e)).map((exchange) => {
                          const active = selectedExchanges.has(exchange);
                          return (
                            <button
                              key={exchange}
                              onClick={() => toggleExchange(exchange)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-xs ${
                                active ? 'bg-white/[0.06] text-white' : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.02]'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                                active ? 'bg-hub-yellow' : 'bg-white/[0.04] border border-white/[0.1]'
                              }`}>
                                {active && <Check className="w-2.5 h-2.5 text-black" />}
                              </div>
                              <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                              <span className="font-medium truncate">{exchange}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mx-2 my-1.5 border-t border-white/[0.06]" />

                    {/* DEX Section */}
                    <div>
                      <div className="px-2 py-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Decentralized ({ALL_EXCHANGES.filter(e => isExchangeDex(e)).length})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-0.5">
                        {ALL_EXCHANGES.filter(e => isExchangeDex(e)).map((exchange) => {
                          const active = selectedExchanges.has(exchange);
                          return (
                            <button
                              key={exchange}
                              onClick={() => toggleExchange(exchange)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-xs ${
                                active ? 'bg-purple-500/10 text-white' : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.02]'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                                active ? 'bg-purple-500' : 'bg-white/[0.04] border border-white/[0.1]'
                              }`}>
                                {active && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
                              <span className="font-medium truncate">{exchange}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
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
            <span className="text-neutral-500 text-sm">Loading {assetClass} funding rates...</span>
          </div>
        ) : fundingRates.length === 0 && !loading ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <div className="text-neutral-600 text-sm mb-2">No {assetClass} funding data available</div>
            <p className="text-neutral-700 text-xs">
              {assetClass === 'forex' && 'Forex perps are available on Lighter, Aster, dYdX, and gTrade (where enabled).'}
              {assetClass === 'stocks' && 'Stock perps are available on Gate.io, Aster, Phemex, Lighter, and gTrade.'}
              {assetClass === 'commodities' && 'Commodity perps (gold, silver, oil) are available on Lighter, Aster, Phemex, and gTrade.'}
            </p>
          </div>
        ) : (
          <>
            {viewMode === 'table' && (
              <FundingTableView data={filteredAndSorted} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} oiMap={oiMap} />
            )}
            {viewMode === 'heatmap' && (
              <FundingHeatmapView symbols={symbols} visibleExchanges={[...visibleExchanges]} heatmapData={heatmapData} intervalMap={intervalMap} oiMap={oiMap} longShortMap={longShortMap} />
            )}
            {viewMode === 'arbitrage' && assetClass === 'crypto' && (
              <FundingArbitrageView arbitrageData={arbitrageData} oiMap={oiMap} markPrices={markPricesMap} intervalMap={intervalMap} />
            )}
          </>
        )}

        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            {assetClass === 'crypto' && (
              <>
                <span className="text-green-400 font-medium">Positive rate</span> = longs pay shorts.{' '}
                <span className="text-red-400 font-medium">Negative rate</span> = shorts pay longs.{' '}
                Most exchanges pay every 8h. Hyperliquid pays hourly (marked /1h). Annualized adjusts per interval.
              </>
            )}
            {assetClass === 'stocks' && (
              <>
                <span className="text-green-400 font-medium">Positive rate</span> = longs pay shorts.{' '}
                <span className="text-red-400 font-medium">Negative rate</span> = shorts pay longs.{' '}
                Stock perps trade 24/7 on DEXs. Funding rates reflect demand to hold synthetic equity exposure.
              </>
            )}
            {assetClass === 'forex' && (
              <>
                <span className="text-green-400 font-medium">Positive rate</span> = longs pay shorts.{' '}
                <span className="text-red-400 font-medium">Negative rate</span> = shorts pay longs.{' '}
                Forex perp rates approximate traditional swap rates. Some exchanges may show zero if funding is disabled.
              </>
            )}
            {assetClass === 'commodities' && (
              <>
                <span className="text-green-400 font-medium">Positive rate</span> = longs pay shorts.{' '}
                <span className="text-red-400 font-medium">Negative rate</span> = shorts pay longs.{' '}
                Commodity perps (gold, silver, oil) provide 24/7 exposure to physical commodity prices.
              </>
            )}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
