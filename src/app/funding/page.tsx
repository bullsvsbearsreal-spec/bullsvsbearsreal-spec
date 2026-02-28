'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { fetchAllFundingRates, fetchFundingArbitrage, fetchAllOpenInterest, type AssetClassFilter } from '@/lib/api/aggregator';
import { RefreshCw, AlertTriangle, Check, Settings2, TrendingUp, DollarSign, BarChart3, Gem as CommodityIcon } from 'lucide-react';
import UpdatedAgo from '@/components/UpdatedAgo';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ALL_EXCHANGES, DEX_EXCHANGES, isExchangeDex, getCategoriesForAssetClass } from '@/lib/constants';
import type { AssetClass } from '@/lib/constants';
import { isValidNumber } from '@/lib/utils/format';
import { useApiData } from '@/hooks/useApiData';
import FundingStats from './components/FundingStats';
import FundingHeatmapView from './components/FundingHeatmapView';
import FundingArbitrageView from './components/FundingArbitrageView';
import dynamic from 'next/dynamic';

const FundingHistoryChart = dynamic(() => import('./components/FundingHistoryChart'), { ssr: false });
import ShareButton from '@/components/ShareButton';
import Footer from '@/components/Footer';
import { saveFundingSnapshot } from '@/lib/storage/fundingHistory';
import { type FundingPeriod, periodMultiplier, PERIOD_HOURS, formatRateAdaptive } from './utils';

type ViewMode = 'heatmap' | 'arbitrage';
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
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(new Set(ALL_EXCHANGES));
  const [showExchangeSelector, setShowExchangeSelector] = useState(false);
  const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');
  const [assetClass, setAssetClass] = useState<AssetClass>('crypto');
  const [fundingPeriod, setFundingPeriod] = useState<FundingPeriod>('8h');
  const exchangeSelectorRef = useRef<HTMLDivElement>(null);

  // Restore all user preferences from localStorage after hydration
  // (initializing from localStorage during SSR causes hydration mismatches)
  useEffect(() => {
    try {
      const savedExchanges = localStorage.getItem('infohub:funding:exchanges');
      if (savedExchanges) {
        const arr = JSON.parse(savedExchanges) as string[];
        const valid = arr.filter(e => (ALL_EXCHANGES as readonly string[]).includes(e));
        if (valid.length > 0) setSelectedExchanges(new Set(valid));
      }
    } catch {}
    try {
      const savedVenue = localStorage.getItem('infohub:funding:venue') as VenueFilter | null;
      if (savedVenue) setVenueFilter(savedVenue);
    } catch {}
    try {
      const savedPeriod = localStorage.getItem('infohub:funding:period') as FundingPeriod | null;
      if (savedPeriod) setFundingPeriod(savedPeriod);
    } catch {}
  }, []);

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

  useEffect(() => {
    try { localStorage.setItem('infohub:funding:period', fundingPeriod); } catch {}
  }, [fundingPeriod]);

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

  // Per-tab data cache: instantly show previously loaded tab data while fetching fresh data
  type FundingData = { fundingRates: any[]; arbitrageData: any[]; oiMap: Map<string, number>; _assetClass: string };
  const tabCacheRef = useRef<Map<string, FundingData>>(new Map());

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
    const result: FundingData = { fundingRates: validData, arbitrageData: arbData, oiMap, _assetClass: assetClass };
    // Cache this tab's data for instant switching
    tabCacheRef.current.set(assetClass, result);
    return result;
  }, [assetClass]);

  const { data: freshData, error, isLoading: loading, lastUpdate, refresh: fetchData } = useApiData({
    fetcher,
    refreshInterval: 30000,
  });

  // Use freshData only if it matches the current tab; otherwise fall back to tab cache
  const data = (freshData && freshData._assetClass === assetClass)
    ? freshData
    : tabCacheRef.current.get(assetClass) ?? null;

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

  const handleAssetClassChange = (newAssetClass: AssetClass) => {
    setAssetClass(newAssetClass);
    setCategoryFilter('all'); // Reset category on asset class change
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

  const cexExchanges = ALL_EXCHANGES.filter(e => !isExchangeDex(e));
  const dexExchanges = ALL_EXCHANGES.filter(e => isExchangeDex(e));

  const toggleSectionExchanges = (section: 'cex' | 'dex') => {
    const sectionExchanges = section === 'cex' ? cexExchanges : dexExchanges;
    const allSelected = sectionExchanges.every(e => selectedExchanges.has(e));
    setSelectedExchanges(prev => {
      const next = new Set(prev);
      if (allSelected) {
        sectionExchanges.forEach(e => next.delete(e));
        if (next.size === 0) next.add(ALL_EXCHANGES[0]);
      } else {
        sectionExchanges.forEach(e => next.add(e));
      }
      return next;
    });
  };

  const selectOnlySection = (section: 'cex' | 'dex') => {
    const sectionExchanges = section === 'cex' ? cexExchanges : dexExchanges;
    setSelectedExchanges(new Set(sectionExchanges));
  };

  const getSymbolAvgRate = (symbol: string) => {
    const rates = fundingRates.filter(fr => fr.symbol === symbol);
    if (rates.length === 0) return 0;
    const sumNormalized = rates.reduce((sum, fr) => {
      return sum + fr.fundingRate * periodMultiplier(fr.fundingInterval, fundingPeriod);
    }, 0);
    return sumNormalized / rates.length;
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
      const norm = (fr: typeof aRates[0]) => Math.abs(fr.fundingRate) * periodMultiplier(fr.fundingInterval, fundingPeriod);
      const aAvg = aRates.reduce((sum, fr) => sum + norm(fr), 0) / aRates.length;
      const bAvg = bRates.reduce((sum, fr) => sum + norm(fr), 0) / bRates.length;
      return bAvg - aAvg;
    })
;

  const heatmapData = new Map<string, Map<string, number>>();
  const intervalMap = new Map<string, string>(); // "SYMBOL|EXCHANGE" → interval
  const longShortMap = new Map<string, { long: number; short: number }>(); // L/S rates for skew-based DEXes
  const borrowingMap = new Map<string, number>(); // Symmetric borrowing fees (gTrade)
  fundingRates.forEach(fr => {
    if (!heatmapData.has(fr.symbol)) heatmapData.set(fr.symbol, new Map());
    // For skew-based DEXes (gTrade, GMX), use the short-side rate as the primary display
    // This matches how these exchanges show funding — their UI emphasizes the short holding cost
    const displayRate = fr.fundingRateShort !== undefined ? fr.fundingRateShort : fr.fundingRate;
    heatmapData.get(fr.symbol)!.set(fr.exchange, displayRate);
    if (fr.fundingInterval && fr.fundingInterval !== '8h') {
      intervalMap.set(`${fr.symbol}|${fr.exchange}`, fr.fundingInterval);
    }
    if (fr.fundingRateLong !== undefined && fr.fundingRateShort !== undefined) {
      longShortMap.set(`${fr.symbol}|${fr.exchange}`, { long: fr.fundingRateLong, short: fr.fundingRateShort });
    }
    if (fr.borrowingRate != null && fr.borrowingRate > 0.00001) {
      borrowingMap.set(`${fr.symbol}|${fr.exchange}`, fr.borrowingRate);
    }
  });

  const visibleExchanges = ALL_EXCHANGES.filter(ex => {
    if (!selectedExchanges.has(ex)) return false;
    if (venueFilter === 'dex' && !isExchangeDex(ex)) return false;
    if (venueFilter === 'cex' && isExchangeDex(ex)) return false;
    return true;
  });

  // Compute actual exchange counts from live data for the subtitle
  const activeExchangeNames = useMemo(() => {
    const names = new Set(fundingRates.map(fr => fr.exchange));
    return names;
  }, [fundingRates]);
  const activeExchangeCount = activeExchangeNames.size;
  const activeDexCount = useMemo(() => {
    let count = 0;
    activeExchangeNames.forEach(name => { if (isExchangeDex(name)) count++; });
    return count;
  }, [activeExchangeNames]);

  const validRates = fundingRates.filter(fr => isValidNumber(fr.fundingRate));
  const avgRate = validRates.length > 0
    ? validRates.reduce((sum, fr) => {
        return sum + fr.fundingRate * periodMultiplier(fr.fundingInterval, fundingPeriod);
      }, 0) / validRates.length : 0;
  const normRate = (fr: typeof validRates[0]) => fr.fundingRate * periodMultiplier(fr.fundingInterval, fundingPeriod);
  const highestRate = validRates.length > 0
    ? validRates.reduce((max, fr) => normRate(fr) > normRate(max) ? fr : max, validRates[0]) : null;
  const lowestRate = validRates.length > 0
    ? validRates.reduce((min, fr) => normRate(fr) < normRate(min) ? fr : min, validRates[0]) : null;

  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: 'heatmap', label: 'Heatmap' },
    ...(assetClass === 'crypto' ? [{ key: 'arbitrage' as ViewMode, label: 'Arbitrage' }] : []),
  ];

  const categoryKeys = Object.keys(activeCategories);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Funding <span className="text-gradient">Rates</span>
            </h1>
            <p className="text-neutral-600 text-sm mt-1">
              {ASSET_CLASS_SUBTITLES[assetClass]} across{' '}
              <span className="text-neutral-400 font-medium">
              {activeExchangeCount > 0
                ? <>{activeExchangeCount} exchanges</>
                : <>{ALL_EXCHANGES.length} exchanges</>
              }
              </span>
              {' '}<span className="text-neutral-700">({activeDexCount > 0 ? activeDexCount : DEX_EXCHANGES.size} DEX)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UpdatedAgo date={lastUpdate} />
            <ShareButton text={`Check out ${assetClass} funding rates on InfoHub — real-time data from ${ALL_EXCHANGES.length} exchanges`} />
            <button
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh"
              className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.04] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Asset Class Tabs */}
        <div className="flex items-center gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }} role="tablist" aria-label="Asset class">
          {ASSET_CLASS_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={assetClass === key}
              onClick={() => handleAssetClassChange(key)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                assetClass === key
                  ? 'bg-hub-yellow text-black shadow-[0_1px_8px_rgba(255,165,0,0.2)]'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {assetClass === key && fundingRates.length > 0 && (
                <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/20 text-black/80">
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
          fundingPeriod={fundingPeriod}
        />

        {/* Historical Chart */}
        <FundingHistoryChart />

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryKeys.map((cat) => {
              const IconComponent = activeCategoryIcons[cat];
              const isActive = categoryFilter === cat;
              const isDynamic = activeCategories[cat]?.dynamic;
              return (
                <span key={cat} className="contents">
                  {/* Divider before dynamic filters */}
                  {isDynamic && cat === categoryKeys.find(k => activeCategories[k]?.dynamic) && (
                    <span className="w-px h-5 mx-1 bg-white/[0.08] hidden sm:block" />
                  )}
                  <button
                    onClick={() => setCategoryFilter(cat)}
                    className={`relative px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 flex items-center gap-1.5 border border-transparent ${
                      isActive
                        ? isDynamic
                          ? cat === 'highest'
                            ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25'
                          : 'bg-hub-yellow text-black shadow-[0_2px_12px_rgba(255,165,0,0.2)]'
                        : isDynamic
                          ? 'text-neutral-500 hover:text-neutral-300'
                          : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06]'
                    }`}
                    style={!isActive && !isDynamic ? { background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.04)' } : isDynamic && !isActive ? { background: 'transparent' } : undefined}
                  >
                    {IconComponent && (
                      <IconComponent className={`w-3 h-3 ${isActive && !isDynamic ? 'text-black/70' : ''}`} />
                    )}
                    {activeCategories[cat].name}
                    {isActive && !isDynamic && (
                      <span className="absolute -bottom-px left-3 right-3 h-[2px] rounded-full bg-hub-yellow/60" />
                    )}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            {/* CEX / DEX venue filter */}
            <div className="flex rounded-lg overflow-hidden ring-1 ring-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
              {(['all', 'cex', 'dex'] as VenueFilter[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVenueFilter(v)}
                  className={`px-3 py-[7px] text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                    venueFilter === v
                      ? 'bg-hub-yellow text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {v === 'all' ? 'All' : v.toUpperCase()}
                </button>
              ))}
            </div>

            <span className="w-px h-5 bg-white/[0.06]" />

            {/* Period normalization toggle */}
            <div className="flex rounded-lg overflow-hidden ring-1 ring-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
              {(['1h', '4h', '8h', '24h', '1Y'] as FundingPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setFundingPeriod(p)}
                  className={`px-2.5 py-[7px] text-[11px] font-bold font-mono tracking-tight transition-all duration-200 ${
                    fundingPeriod === p
                      ? 'bg-hub-yellow text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <span className="w-px h-5 bg-white/[0.06]" />

            {/* Heatmap / Arbitrage view toggle */}
            <div className="flex rounded-lg overflow-hidden ring-1 ring-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
              {viewTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-3.5 py-[7px] text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                    viewMode === key
                      ? 'bg-hub-yellow text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="w-px h-5 bg-white/[0.06]" />

            {/* Exchange selector */}
            <div className="relative" ref={exchangeSelectorRef}>
              <button
                onClick={() => setShowExchangeSelector(!showExchangeSelector)}
                className={`px-3 py-[7px] rounded-lg text-[11px] font-semibold transition-all duration-200 flex items-center gap-1.5 ring-1 ${
                  showExchangeSelector
                    ? 'bg-hub-yellow text-black ring-hub-yellow/30 shadow-[0_2px_12px_rgba(255,165,0,0.2)]'
                    : 'text-neutral-500 hover:text-neutral-300 ring-white/[0.06] hover:ring-white/[0.1]'
                }`}
                style={!showExchangeSelector ? { background: 'rgba(255,255,255,0.02)' } : undefined}
              >
                <Settings2 className="w-3 h-3" />
                <span className="font-mono">{selectedExchanges.size}/{ALL_EXCHANGES.length}</span>
              </button>

              {showExchangeSelector && (
                <div className="absolute right-0 top-full mt-2 z-50 rounded-2xl shadow-2xl shadow-black/90 min-w-[460px] overflow-hidden" style={{ background: 'linear-gradient(180deg, #141414 0%, #0c0c0c 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.04) 0%, transparent 60%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
                        <Settings2 className="w-3.5 h-3.5 text-hub-yellow" />
                      </div>
                      <span className="text-white font-semibold text-[13px]">Exchanges</span>
                      <span className="text-[10px] text-neutral-500 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">{selectedExchanges.size}/{ALL_EXCHANGES.length}</span>
                    </div>
                    <button onClick={toggleAllExchanges} className="text-[10px] font-bold text-hub-yellow hover:text-hub-yellow/80 transition-all duration-200 px-2.5 py-1 rounded-md bg-hub-yellow/10 hover:bg-hub-yellow/15 ring-1 ring-hub-yellow/10">
                      {selectedExchanges.size === ALL_EXCHANGES.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="p-3 max-h-[70vh] overflow-y-auto">
                    {/* CEX Section */}
                    <div className="mb-2">
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <span className="text-[10px] font-bold text-hub-yellow/60 uppercase tracking-[0.12em]">Centralized</span>
                        <span className="text-[9px] font-mono text-neutral-600 bg-white/[0.03] px-1.5 py-0.5 rounded">{cexExchanges.length}</span>
                        <span className="flex-1 h-px bg-white/[0.04]" />
                        <button onClick={() => selectOnlySection('cex')} className="text-[9px] font-semibold text-neutral-600 hover:text-hub-yellow/70 transition-colors px-1.5 py-0.5 rounded hover:bg-hub-yellow/5">Only</button>
                        <button onClick={() => toggleSectionExchanges('cex')} className="text-[9px] font-semibold text-neutral-600 hover:text-hub-yellow/70 transition-colors px-1.5 py-0.5 rounded hover:bg-hub-yellow/5">
                          {cexExchanges.every(e => selectedExchanges.has(e)) ? 'None' : 'All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {ALL_EXCHANGES.filter(e => !isExchangeDex(e)).map((exchange) => {
                          const active = selectedExchanges.has(exchange);
                          return (
                            <button
                              key={exchange}
                              onClick={() => toggleExchange(exchange)}
                              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs ${
                                active
                                  ? 'bg-white/[0.06] text-white ring-1 ring-white/[0.08]'
                                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03]'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-[5px] flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                                active ? 'bg-hub-yellow shadow-[0_0_6px_rgba(255,165,0,0.3)]' : 'bg-white/[0.04] ring-1 ring-white/[0.08] group-hover:ring-white/[0.15]'
                              }`}>
                                {active && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                              </div>
                              <ExchangeLogo exchange={exchange.toLowerCase()} size={15} />
                              <span className="font-medium truncate">{exchange}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DEX Section */}
                    <div className="mt-3">
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <span className="text-[10px] font-bold text-purple-400/70 uppercase tracking-[0.12em]">Decentralized</span>
                        <span className="text-[9px] font-mono text-neutral-600 bg-purple-500/[0.06] px-1.5 py-0.5 rounded text-purple-400/60">{dexExchanges.length}</span>
                        <span className="flex-1 h-px bg-purple-500/[0.08]" />
                        <button onClick={() => selectOnlySection('dex')} className="text-[9px] font-semibold text-neutral-600 hover:text-purple-400/70 transition-colors px-1.5 py-0.5 rounded hover:bg-purple-500/5">Only</button>
                        <button onClick={() => toggleSectionExchanges('dex')} className="text-[9px] font-semibold text-neutral-600 hover:text-purple-400/70 transition-colors px-1.5 py-0.5 rounded hover:bg-purple-500/5">
                          {dexExchanges.every(e => selectedExchanges.has(e)) ? 'None' : 'All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {ALL_EXCHANGES.filter(e => isExchangeDex(e)).map((exchange) => {
                          const active = selectedExchanges.has(exchange);
                          return (
                            <button
                              key={exchange}
                              onClick={() => toggleExchange(exchange)}
                              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs ${
                                active
                                  ? 'bg-purple-500/[0.08] text-white ring-1 ring-purple-500/20'
                                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.03]'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-[5px] flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                                active ? 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.3)]' : 'bg-white/[0.04] ring-1 ring-white/[0.08] group-hover:ring-white/[0.15]'
                              }`}>
                                {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                              </div>
                              <ExchangeLogo exchange={exchange.toLowerCase()} size={15} />
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
            {viewMode === 'heatmap' && (
              <FundingHeatmapView symbols={symbols} visibleExchanges={[...visibleExchanges]} heatmapData={heatmapData} intervalMap={intervalMap} oiMap={oiMap} longShortMap={longShortMap} fundingPeriod={fundingPeriod} />
            )}
            {viewMode === 'arbitrage' && assetClass === 'crypto' && (
              <FundingArbitrageView arbitrageData={arbitrageData} oiMap={oiMap} markPrices={markPricesMap} intervalMap={intervalMap} fundingPeriod={fundingPeriod} />
            )}
          </>
        )}

        <div className="mt-5 p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.04) 0%, rgba(255,165,0,0.01) 100%)', border: '1px solid rgba(255,165,0,0.08)' }}>
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
