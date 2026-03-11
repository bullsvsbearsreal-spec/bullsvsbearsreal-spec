'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRateAdaptive, type FundingPeriod, periodMultiplier, PERIOD_HOURS } from '../utils';
import Pagination from './Pagination';
import { ChevronUp, ChevronDown, ExternalLink, Grid3X3, LayoutGrid, Settings2, Search, X } from 'lucide-react';
import { getExchangeTradeUrl } from '@/lib/constants';
import type { FundingPrefs } from '@/lib/db';

const ROWS_PER_PAGE = 80;
const TREEMAP_MAX = 100;

interface ExchangeSort {
  exchange: string;
  direction: 'desc' | 'asc';
}

type HeatmapMode = 'grid' | 'treemap';

interface AccumulatedFunding { d1: number; d7: number; d30: number }

interface FundingHeatmapViewProps {
  symbols: string[];
  visibleExchanges: string[];
  heatmapData: Map<string, Map<string, number>>;
  intervalMap?: Map<string, string>;
  oiMap?: Map<string, number>;
  longShortMap?: Map<string, { long: number; short: number }>;
  // borrowingMap removed — was computed but never used
  predictedMap?: Map<string, Map<string, number>>;
  accumulatedMap?: Map<string, AccumulatedFunding>;
  fundingPeriod: FundingPeriod;
  fundingPrefs?: Required<FundingPrefs>;
  onUpdatePrefs?: (partial: Partial<FundingPrefs>) => void;
}

/* ═══════════════════════════════════════
   COLOR ENGINE
   ═══════════════════════════════════════ */

function rateToColors(rate: number | undefined, clamp = 0.3, colored = false): { bg: string; text: string; glow: string } {
  if (rate === undefined) return { bg: 'rgba(255,255,255,0.02)', text: 'rgba(255,255,255,0.12)', glow: 'transparent' };
  if (rate === 0) return { bg: 'rgba(255,255,255,0.02)', text: 'rgba(255,255,255,0.35)', glow: 'transparent' };

  const abs = Math.min(Math.abs(rate), clamp);
  const t = Math.pow(abs / clamp, 0.55); // gamma for perceptual linearity

  if (rate > 0) {
    return {
      bg: colored ? `rgba(16, 185, 129, ${(0.05 + t * 0.2).toFixed(3)})` : 'rgba(255,255,255,0.02)',
      text: `rgba(52, 211, 153, ${(0.5 + t * 0.5).toFixed(3)})`,
      glow: colored ? `rgba(16, 185, 129, ${(t * 0.15).toFixed(3)})` : 'transparent',
    };
  } else {
    return {
      bg: colored ? `rgba(244, 63, 94, ${(0.05 + t * 0.2).toFixed(3)})` : 'rgba(255,255,255,0.02)',
      text: `rgba(251, 113, 133, ${(0.5 + t * 0.5).toFixed(3)})`,
      glow: colored ? `rgba(244, 63, 94, ${(t * 0.15).toFixed(3)})` : 'transparent',
    };
  }
}

// Treemap: brighter, more saturated for large blocks
function rateToTreemapColor(rate: number, clamp = 0.25): string {
  const abs = Math.min(Math.abs(rate), clamp);
  const t = Math.pow(abs / clamp, 0.5);
  if (rate >= 0) {
    const r = Math.round(13 + (16 - 13) * t);
    const g = Math.round(30 + (185 - 30) * t);
    const b = Math.round(28 + (129 - 28) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const r = Math.round(50 + (220 - 50) * t);
    const g = Math.round(20 + (50 - 20) * t * 0.4);
    const b = Math.round(28 + (60 - 28) * t * 0.4);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/* ═══════════════════════════════════════
   TREEMAP LAYOUT (squarified)
   ═══════════════════════════════════════ */

interface TreemapRect {
  symbol: string;
  rate: number;
  oi: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify(
  items: { symbol: string; rate: number; oi: number }[],
  x: number, y: number, w: number, h: number
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, y, w, h }];
  }

  const total = items.reduce((s, i) => s + i.oi, 0);
  if (total === 0) return items.map((it, i) => ({ ...it, x: x + (w / items.length) * i, y, w: w / items.length, h }));

  // Find split point that gives best aspect ratio
  const isWide = w >= h;
  let sum = 0;
  let bestIdx = 0;
  let bestRatio = Infinity;

  for (let i = 0; i < items.length - 1; i++) {
    sum += items[i].oi;
    const frac = sum / total;
    const r1 = isWide ? (w * frac) / h : w / (h * frac);
    const r2 = isWide ? (w * (1 - frac)) / h : w / (h * (1 - frac));
    const worstRatio = Math.max(r1, 1 / r1, r2, 1 / r2);
    if (worstRatio < bestRatio) {
      bestRatio = worstRatio;
      bestIdx = i;
    }
  }

  const leftItems = items.slice(0, bestIdx + 1);
  const rightItems = items.slice(bestIdx + 1);
  const leftTotal = leftItems.reduce((s, i) => s + i.oi, 0);
  const frac = leftTotal / total;

  if (isWide) {
    const splitX = w * frac;
    return [
      ...squarify(leftItems, x, y, splitX, h),
      ...squarify(rightItems, x + splitX, y, w - splitX, h),
    ];
  } else {
    const splitY = h * frac;
    return [
      ...squarify(leftItems, x, y, w, splitY),
      ...squarify(rightItems, x, y + splitY, w, h - splitY),
    ];
  }
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */

const SPACING_MAP: Record<string, string> = {
  compact: '1px 1px',
  normal: '3px 2px',
  spacious: '5px 3px',
};

const FONT_SIZE_MAP: Record<string, { rate: string; sub: string; ls: string }> = {
  small:  { rate: 'text-[11px]', sub: 'text-[7px]', ls: 'text-[9px]' },
  medium: { rate: 'text-[13px]', sub: 'text-[8px]', ls: 'text-[11px]' },
  large:  { rate: 'text-[15px]', sub: 'text-[9px]', ls: 'text-[13px]' },
};

export default function FundingHeatmapView({
  symbols, visibleExchanges, heatmapData, intervalMap, oiMap, longShortMap, predictedMap, accumulatedMap, fundingPeriod,
  fundingPrefs, onUpdatePrefs,
}: FundingHeatmapViewProps) {
  // Period-scaled color clamps
  const periodScale = PERIOD_HOURS[fundingPeriod] / 8;
  const gridClamp = 0.3 * periodScale;
  const treemapClamp = 0.25 * periodScale;
  const cellColors = fundingPrefs?.cellColors ?? false;
  const gridSpacing = fundingPrefs?.gridSpacing ?? 'normal';
  const fontSize = fundingPrefs?.fontSize ?? 'medium';
  const showPredicted = fundingPrefs?.showPredicted ?? false;
  const showLongShort = fundingPrefs?.showLongShort ?? true;
  const showAccumulated = fundingPrefs?.showAccumulated ?? true;
  const [mode, setMode] = useState<HeatmapMode>('grid');
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [exchangeSort, setExchangeSort] = useState<ExchangeSort | null>(null);
  const [coinSearch, setCoinSearch] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [hoveredTreemapSym, setHoveredTreemapSym] = useState<string | null>(null);
  const treemapRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [treemapSize, setTreemapSize] = useState({ w: 900, h: 520 });

  // Measure treemap container
  useEffect(() => {
    if (mode !== 'treemap' || !treemapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setTreemapSize({ w: width, h: Math.max(400, Math.min(600, width * 0.55)) });
    });
    ro.observe(treemapRef.current);
    return () => ro.disconnect();
  }, [mode]);

  // Close settings dropdown on Escape or click outside
  useEffect(() => {
    if (!showSettings) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSettings(false); };
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => { window.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); };
  }, [showSettings]);

  // Sync top scrollbar ↔ table scroll
  useEffect(() => {
    if (mode !== 'grid') return;
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    // Measure table scroll width (deferred to avoid setState-during-render)
    let rafId: number;
    const updateWidth = () => { rafId = requestAnimationFrame(() => setScrollWidth(tableEl.scrollWidth)); };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(tableEl);
    let syncing = false;
    const syncFromTop = () => { if (!syncing) { syncing = true; tableEl.scrollLeft = topEl.scrollLeft; syncing = false; } };
    const syncFromTable = () => { if (!syncing) { syncing = true; topEl.scrollLeft = tableEl.scrollLeft; syncing = false; } };
    topEl.addEventListener('scroll', syncFromTop);
    tableEl.addEventListener('scroll', syncFromTable);
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); topEl.removeEventListener('scroll', syncFromTop); tableEl.removeEventListener('scroll', syncFromTable); };
  }, [mode, visibleExchanges.length, symbols.length, coinSearch]);

  const handleExchangeClick = useCallback((exchange: string) => {
    setExchangeSort(prev => {
      if (!prev || prev.exchange !== exchange) return { exchange, direction: 'desc' };
      if (prev.direction === 'desc') return { exchange, direction: 'asc' };
      return null;
    });
    setCurrentPage(1);
  }, []);

  // ── Coin search filter ──
  const filteredSymbols = useMemo(() => {
    if (!coinSearch) return symbols;
    const q = coinSearch.toUpperCase();
    return symbols.filter(s => s.includes(q));
  }, [symbols, coinSearch]);

  // ── Computed data ──

  const avgRates = useMemo(() => {
    const map = new Map<string, number>();
    filteredSymbols.forEach(sym => {
      const rates = heatmapData.get(sym);
      if (!rates) return;
      let sum = 0, count = 0;
      visibleExchanges.forEach(ex => {
        const r = rates.get(ex);
        if (r !== undefined) {
          const interval = intervalMap?.get(`${sym}|${ex}`);
          sum += r * periodMultiplier(interval, fundingPeriod);
          count++;
        }
      });
      if (count > 0) map.set(sym, sum / count);
    });
    return map;
  }, [filteredSymbols, visibleExchanges, heatmapData, intervalMap, fundingPeriod]);

  const symbolOI = useMemo(() => {
    const map = new Map<string, number>();
    if (!oiMap) return map;
    filteredSymbols.forEach(sym => {
      let total = 0;
      visibleExchanges.forEach(ex => {
        const val = oiMap.get(`${sym}|${ex}`);
        if (val) total += val;
      });
      if (total > 0) map.set(sym, total);
    });
    return map;
  }, [filteredSymbols, visibleExchanges, oiMap]);

  const listingCounts = useMemo(() => {
    const map = new Map<string, number>();
    filteredSymbols.forEach(sym => {
      const rates = heatmapData.get(sym);
      if (!rates) return;
      let count = 0;
      visibleExchanges.forEach(ex => { if (rates.get(ex) !== undefined) count++; });
      map.set(sym, count);
    });
    return map;
  }, [filteredSymbols, visibleExchanges, heatmapData]);

  const sortedSymbols = useMemo(() => {
    if (!exchangeSort) return filteredSymbols;
    const { exchange, direction } = exchangeSort;
    if (exchange === '__avg__') {
      return [...filteredSymbols].sort((a, b) => {
        const rateA = avgRates.get(a);
        const rateB = avgRates.get(b);
        if (rateA === undefined && rateB === undefined) return 0;
        if (rateA === undefined) return 1;
        if (rateB === undefined) return -1;
        return direction === 'desc' ? rateB - rateA : rateA - rateB;
      });
    }
    // When sorting by a specific exchange, symbols with data first, sorted by base funding rate
    const withData = filteredSymbols.filter(s => heatmapData.get(s)?.get(exchange) !== undefined);
    const withoutData = filteredSymbols.filter(s => heatmapData.get(s)?.get(exchange) === undefined);
    withData.sort((a, b) => {
      const rateA = heatmapData.get(a)!.get(exchange)!;
      const rateB = heatmapData.get(b)!.get(exchange)!;
      // Apply period normalization for sorting
      const multA = periodMultiplier(intervalMap?.get(`${a}|${exchange}`), fundingPeriod);
      const multB = periodMultiplier(intervalMap?.get(`${b}|${exchange}`), fundingPeriod);
      return direction === 'desc' ? rateB * multB - rateA * multA : rateA * multA - rateB * multB;
    });
    return [...withData, ...withoutData];
  }, [filteredSymbols, exchangeSort, heatmapData, avgRates, intervalMap, fundingPeriod]);

  const totalPages = Math.max(1, Math.ceil(sortedSymbols.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageSymbols = sortedSymbols.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Market summary
  const { bullish, bearish } = useMemo(() => {
    let b = 0, br = 0;
    filteredSymbols.forEach(sym => {
      const avg = avgRates.get(sym);
      if (avg !== undefined) { if (avg > 0) b++; else if (avg < 0) br++; }
    });
    return { bullish: b, bearish: br };
  }, [filteredSymbols, avgRates]);

  // Treemap data
  const treemapRects = useMemo(() => {
    if (mode !== 'treemap') return [];
    const items = filteredSymbols
      .map(sym => ({
        symbol: sym,
        rate: avgRates.get(sym) ?? 0,
        oi: symbolOI.get(sym) ?? 1, // fallback to 1 so everything shows
      }))
      .sort((a, b) => b.oi - a.oi)
      .slice(0, TREEMAP_MAX);
    return squarify(items, 0, 0, treemapSize.w, treemapSize.h);
  }, [mode, filteredSymbols, avgRates, symbolOI, treemapSize]);

  const formatOI = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--hub-darker)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 16px rgba(0,0,0,0.3)' }}>

      {/* ── Toolbar ── */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
                mode === 'grid' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-3 h-3" />
              Grid
            </button>
            <button
              onClick={() => setMode('treemap')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
                mode === 'treemap' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Treemap view"
            >
              <LayoutGrid className="w-3 h-3" />
              Map
            </button>
          </div>

          <div className="h-3.5 w-px bg-white/[0.06]" />
          <span className="text-neutral-600 text-[11px] font-mono tabular-nums">{filteredSymbols.length}{coinSearch && `/${symbols.length}`} <span className="text-neutral-700">pairs</span></span>

          {/* Settings gear */}
          {onUpdatePrefs && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(p => !p)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 ${
                  showSettings ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-neutral-300'
                }`}
                title="Display settings"
              >
                <Settings2 className="w-3 h-3" />
              </button>

              {showSettings && (
                <div className="absolute left-0 top-full mt-2 z-50 rounded-xl shadow-2xl shadow-black/90 min-w-[230px] overflow-hidden" style={{ background: 'linear-gradient(180deg, #141414 0%, #0c0c0c 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-white font-semibold text-[12px]">Display</span>
                  </div>
                  <div className="p-3 space-y-3">
                    {/* Cell Colors Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400">Cell colors</span>
                      <button
                        onClick={() => onUpdatePrefs({ cellColors: !cellColors })}
                        className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${cellColors ? 'bg-hub-yellow' : 'bg-white/[0.08]'}`}
                      >
                        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200 ${cellColors ? 'left-[15px] bg-black' : 'left-[2px] bg-neutral-500'}`} />
                      </button>
                    </div>

                    {/* Show Predicted Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400">Predicted rates</span>
                      <button
                        onClick={() => onUpdatePrefs({ showPredicted: !showPredicted })}
                        className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${showPredicted ? 'bg-hub-yellow' : 'bg-white/[0.08]'}`}
                      >
                        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200 ${showPredicted ? 'left-[15px] bg-black' : 'left-[2px] bg-neutral-500'}`} />
                      </button>
                    </div>

                    {/* Show L/S Breakdown Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400">L/S breakdown</span>
                      <button
                        onClick={() => onUpdatePrefs({ showLongShort: !showLongShort })}
                        className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${showLongShort ? 'bg-hub-yellow' : 'bg-white/[0.08]'}`}
                      >
                        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200 ${showLongShort ? 'left-[15px] bg-black' : 'left-[2px] bg-neutral-500'}`} />
                      </button>
                    </div>

                    {/* Show Accumulated 7D Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400">7D accumulated</span>
                      <button
                        onClick={() => onUpdatePrefs({ showAccumulated: !showAccumulated })}
                        className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${showAccumulated ? 'bg-hub-yellow' : 'bg-white/[0.08]'}`}
                      >
                        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200 ${showAccumulated ? 'left-[15px] bg-black' : 'left-[2px] bg-neutral-500'}`} />
                      </button>
                    </div>

                    <div className="h-px bg-white/[0.04]" />

                    {/* Grid Spacing */}
                    <div>
                      <span className="text-[11px] text-neutral-400 block mb-1.5">Spacing</span>
                      <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {(['compact', 'normal', 'spacious'] as const).map(opt => (
                          <button
                            key={opt}
                            onClick={() => onUpdatePrefs({ gridSpacing: opt })}
                            className={`flex-1 px-2 py-1.5 text-[10px] font-semibold capitalize transition-all duration-150 ${
                              gridSpacing === opt ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font Size */}
                    <div>
                      <span className="text-[11px] text-neutral-400 block mb-1.5">Font size</span>
                      <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {(['small', 'medium', 'large'] as const).map(opt => (
                          <button
                            key={opt}
                            onClick={() => onUpdatePrefs({ fontSize: opt })}
                            className={`flex-1 px-2 py-1.5 text-[10px] font-semibold capitalize transition-all duration-150 ${
                              fontSize === opt ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Coin search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600 pointer-events-none" />
            <input
              type="text"
              value={coinSearch}
              onChange={e => { setCoinSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search coin..."
              className="w-[130px] sm:w-[160px] pl-7 pr-7 py-1.5 rounded-lg text-[11px] text-white placeholder-neutral-600 outline-none transition-all focus:ring-1 focus:ring-hub-yellow/40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            />
            {coinSearch && (
              <button
                onClick={() => { setCoinSearch(''); setCurrentPage(1); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="h-3.5 w-px bg-white/[0.06] hidden sm:block" />

          {/* Sentiment bar */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-400/80 font-mono tabular-nums font-medium">{bullish}</span>
            <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(bullish / Math.max(bullish + bearish, 1)) * 100}%`, background: 'linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.9))' }}
              />
            </div>
            <span className="text-[10px] text-rose-400/80 font-mono tabular-nums font-medium">{bearish}</span>
          </div>

          {/* Legend blocks */}
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[8px] text-rose-400/40 font-semibold">SHORT</span>
            <div className="flex gap-[1px]">
              {[0.35, 0.18, 0.08, 0.03, 0.08, 0.18, 0.35].map((a, i) => {
                const isGreen = i >= 4;
                const isNeutral = i === 3;
                return (
                  <div
                    key={i}
                    className="w-3 h-2 rounded-[2px]"
                    style={{
                      background: isNeutral
                        ? 'rgba(255,255,255,0.04)'
                        : isGreen
                        ? `rgba(16,185,129,${a})`
                        : `rgba(244,63,94,${a})`,
                    }}
                  />
                );
              })}
            </div>
            <span className="text-[8px] text-emerald-400/40 font-semibold">LONG</span>
          </div>

          {/* Interval dots */}
          <div className="hidden md:flex items-center gap-2.5 text-[9px] text-neutral-600">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 inline-block" /> <span className="font-medium">1h</span></span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400/70 inline-block" /> <span className="font-medium">4h</span></span>
          </div>
        </div>
      </div>

      {/* ═══════ TREEMAP VIEW ═══════ */}
      {mode === 'treemap' && (
        <div className="p-3">
          <div
            ref={treemapRef}
            className="relative w-full rounded-lg overflow-hidden"
            style={{ height: treemapSize.h, background: 'rgba(0,0,0,0.2)' }}
          >
            {treemapRects.map(rect => {
              const isHovered = hoveredTreemapSym === rect.symbol;
              const color = rateToTreemapColor(rect.rate, treemapClamp);
              const showLabel = rect.w > 36 && rect.h > 28;
              const showRate = rect.w > 50 && rect.h > 38;
              const showOI = rect.w > 65 && rect.h > 50;
              const showIcon = rect.w > 50 && rect.h > 50;
              const fontSize = rect.w > 100 && rect.h > 60 ? 13 : rect.w > 60 ? 11 : 9;

              return (
                <Link
                  key={rect.symbol}
                  href={`/funding/${rect.symbol}`}
                  className="absolute flex flex-col items-center justify-center no-underline transition-all duration-100 group"
                  style={{
                    left: rect.x + 1,
                    top: rect.y + 1,
                    width: rect.w - 2,
                    height: rect.h - 2,
                    background: color,
                    borderRadius: 4,
                    zIndex: isHovered ? 10 : 1,
                    outline: isHovered ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.3)',
                    outlineOffset: -1,
                    transform: isHovered ? 'scale(1.01)' : 'none',
                    transformOrigin: 'center',
                  }}
                  onMouseEnter={() => setHoveredTreemapSym(rect.symbol)}
                  onMouseLeave={() => setHoveredTreemapSym(null)}
                  title={`${rect.symbol}\nAvg: ${formatRateAdaptive(rect.rate)}\nOI: ${formatOI(rect.oi)}`}
                >
                  {showIcon && <TokenIconSimple symbol={rect.symbol} size={fontSize > 11 ? 20 : 14} />}
                  {showLabel && (
                    <span
                      className="font-bold text-white leading-none mt-0.5"
                      style={{ fontSize, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                    >
                      {rect.symbol}
                    </span>
                  )}
                  {showRate && (
                    <span
                      className="font-mono tabular-nums leading-none mt-0.5"
                      style={{
                        fontSize: fontSize - 2,
                        color: 'rgba(255,255,255,0.85)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      {formatRateAdaptive(rect.rate)}
                    </span>
                  )}
                  {showOI && (
                    <span
                      className="font-mono tabular-nums leading-none mt-0.5"
                      style={{
                        fontSize: Math.max(fontSize - 4, 8),
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {formatOI(rect.oi)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-700 mt-2 text-center">
            Sized by open interest · Top {Math.min(TREEMAP_MAX, filteredSymbols.length)} symbols · Click to view details
          </p>
        </div>
      )}

      {/* ═══════ GRID VIEW ═══════ */}
      {mode === 'grid' && (
        <>
          {/* Top scrollbar — synced with table */}
          <div ref={topScrollRef} className="overflow-x-auto heatmap-scroll" style={{ marginTop: -1 }}>
            <div style={{ width: scrollWidth, height: 1 }} />
          </div>
          <div className="relative">
          <div ref={tableScrollRef} className="overflow-x-auto heatmap-scroll">
            <table style={{ borderCollapse: 'separate', borderSpacing: SPACING_MAP[gridSpacing], tableLayout: 'fixed', width: 145 + visibleExchanges.length * 81 }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 px-3 py-2 text-left"
                    style={{
                      background: 'var(--hub-darker)',
                      boxShadow: '2px 0 8px -2px rgba(0,0,0,0.6)',
                      width: 145,
                      minWidth: 145,
                      maxWidth: 145,
                    }}
                  >
                    <button
                      onClick={() => handleExchangeClick('__avg__')}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider hover:text-white transition-colors group"
                    >
                      Symbol
                      <span className="text-neutral-700 font-normal lowercase tracking-normal">/avg</span>
                      {exchangeSort?.exchange === '__avg__' ? (
                        exchangeSort.direction === 'desc'
                          ? <ChevronDown className="w-3 h-3 text-hub-yellow" />
                          : <ChevronUp className="w-3 h-3 text-hub-yellow" />
                      ) : null}
                    </button>
                  </th>
                  {visibleExchanges.map(ex => {
                    const isActive = exchangeSort?.exchange === ex;
                    return (
                      <th key={ex} className="px-0.5 py-1.5 text-center select-none" style={{ minWidth: 78 }}>
                        <button
                          onClick={() => handleExchangeClick(ex)}
                          className={`w-full flex flex-col items-center gap-1 py-1 px-0.5 rounded-md transition-all cursor-pointer ${
                            isActive ? 'bg-white/[0.06]' : hoveredCol === ex ? 'bg-white/[0.03]' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <ExchangeLogo exchange={ex.toLowerCase()} size={18} />
                          <div className="flex items-center gap-0.5">
                            <span className={`${ex.length > 8 ? 'text-[9px]' : 'text-[10px]'} font-medium leading-none transition-colors ${
                              isActive ? 'text-hub-yellow' : 'text-neutral-600'
                            }`}>
                              {ex}
                            </span>
                            {isActive && (
                              exchangeSort?.direction === 'desc'
                                ? <ChevronDown className="w-2 h-2 text-hub-yellow" />
                                : <ChevronUp className="w-2 h-2 text-hub-yellow" />
                            )}
                          </div>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {pageSymbols.map(symbol => {
                  const rates = heatmapData.get(symbol);
                  const avg = avgRates.get(symbol);
                  const listings = listingCounts.get(symbol) ?? 0;
                  const isRowHovered = hoveredRow === symbol;
                  const avgColors = rateToColors(avg, gridClamp, cellColors);

                  return (
                    <tr
                      key={symbol}
                      onMouseEnter={() => setHoveredRow(symbol)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ background: isRowHovered ? 'rgba(255,255,255,0.018)' : undefined }}
                    >
                      <td
                        className="sticky left-0 z-10 px-2 py-0"
                        style={{
                          background: isRowHovered ? '#141414' : 'var(--hub-darker)',
                          boxShadow: '2px 0 8px -2px rgba(0,0,0,0.6)',
                          transition: 'background 60ms',
                        }}
                      >
                        <Link href={`/funding/${symbol}`} className="flex items-center gap-2.5 py-2 no-underline group/link">
                          <TokenIconSimple symbol={symbol} size={24} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[14px] font-bold text-white leading-tight truncate group-hover/link:text-hub-yellow transition-colors">
                              {symbol}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono tabular-nums leading-tight font-semibold" style={{ color: avgColors.text }}>
                                {avg !== undefined ? formatRateAdaptive(avg) : '—'}
                              </span>
                              <span className="text-[9px] text-neutral-700 tabular-nums">{listings}/{visibleExchanges.length}</span>
                              {showAccumulated && (() => {
                                const acc = accumulatedMap?.get(symbol);
                                if (!acc || acc.d7 === 0) return null;
                                const color7d = acc.d7 > 0 ? 'text-green-400/60' : 'text-red-400/60';
                                return (
                                  <span className={`text-[9px] font-mono tabular-nums ${color7d}`} title={`7D accumulated: ${acc.d7.toFixed(4)}%\n30D accumulated: ${acc.d30.toFixed(4)}%`}>
                                    7D {acc.d7 > 0 ? '+' : ''}{acc.d7.toFixed(3)}%
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </Link>
                      </td>

                      {visibleExchanges.map(ex => {
                        const rawRate = rates?.get(ex);
                        const interval = intervalMap?.get(`${symbol}|${ex}`);
                        const pMult = periodMultiplier(interval, fundingPeriod);
                        const rate = rawRate !== undefined ? rawRate * pMult : undefined;
                        const rawPredicted = predictedMap?.get(symbol)?.get(ex);
                        const predicted = rawPredicted !== undefined ? rawPredicted * pMult : undefined;
                        const tradeUrl = rawRate !== undefined ? getExchangeTradeUrl(ex, symbol) : null;
                        const isCross = isRowHovered && hoveredCol === ex;
                        const rawLs = longShortMap?.get(`${symbol}|${ex}`);
                        const ls = rawLs ? { long: rawLs.long * pMult, short: rawLs.short * pMult } : undefined;
                        const hasLS = showLongShort && ls !== undefined && rate !== undefined;
                        // Cell background always uses base funding rate (comparable across all exchanges)
                        const colorRate = rate;
                        const colors = rateToColors(colorRate, gridClamp, cellColors);
                        const fs = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.medium;

                        const cellStyle: React.CSSProperties = {
                          background: colors.bg,
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderColor: isCross ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.04)',
                          borderRadius: 4,
                          minHeight: hasLS ? 42 : 38,
                          height: hasLS ? 42 : 38,
                          transition: 'border-color 60ms',
                        };

                        const intervalDot = interval === '1h' ? (
                          <span className="absolute top-[2px] right-[2px] w-[3px] h-[3px] rounded-full bg-amber-400/80" />
                        ) : interval === '4h' ? (
                          <span className="absolute top-[2px] right-[2px] w-[3px] h-[3px] rounded-full bg-sky-400/80" />
                        ) : null;

                        const lsLine = ls ? `\nL: ${formatRateAdaptive(ls.long)} / S: ${formatRateAdaptive(ls.short)}` : '';
                        const predLine = predicted !== undefined ? `\nPredicted: ${formatRateAdaptive(predicted)}` : '';
                        const title = rate !== undefined
                          ? `${symbol} · ${ex} · ${formatRateAdaptive(rate)} (${interval || '8h'})${lsLine}${predLine}\nClick to trade`
                          : `Not on ${ex}`;
                        const showPred = predicted !== undefined && rate !== undefined && (showPredicted || isCross);
                        const inner = hasLS ? (
                          <>
                            <span className="flex flex-col items-center gap-[2px] leading-none">
                              <span className={`${fs.ls} font-mono tabular-nums font-semibold`} style={{ color: rateToColors(ls.long, gridClamp).text }}>
                                <span className="text-white/25 text-[9px]">L</span> {formatRateAdaptive(ls.long)}
                              </span>
                              <span className={`${fs.ls} font-mono tabular-nums font-semibold`} style={{ color: rateToColors(ls.short, gridClamp).text }}>
                                <span className="text-white/25 text-[9px]">S</span> {formatRateAdaptive(ls.short)}
                              </span>
                              {showPred && (
                                <span className={`${fs.sub} font-mono tabular-nums`} style={{ color: rateToColors(predicted, gridClamp).text, opacity: 0.7 }}>
                                  P {formatRateAdaptive(predicted)}
                                </span>
                              )}
                            </span>
                            {intervalDot}
                            {isCross && tradeUrl && (
                              <ExternalLink className="absolute bottom-[1px] right-[1px] w-[7px] h-[7px] text-white/25" />
                            )}
                          </>
                        ) : (
                          <>
                            <span className="flex flex-col items-center gap-[1px] leading-none">
                              <span className={`${fs.rate} font-mono tabular-nums font-semibold`} style={{ color: colors.text }}>
                                {rate !== undefined ? formatRateAdaptive(rate) : '—'}
                              </span>
                              {showPred && (
                                <span className={`${fs.sub} font-mono tabular-nums`} style={{ color: rateToColors(predicted, gridClamp).text, opacity: 0.7 }}>
                                  P {formatRateAdaptive(predicted)}
                                </span>
                              )}
                            </span>
                            {intervalDot}
                            {isCross && rate !== undefined && tradeUrl && (
                              <ExternalLink className="absolute bottom-[1px] right-[1px] w-[7px] h-[7px] text-white/25" />
                            )}
                          </>
                        );

                        return (
                          <td key={ex} className="px-[1px] py-[1px]">
                            {tradeUrl ? (
                              <a
                                href={tradeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative flex items-center justify-center w-full rounded-[3px] no-underline cursor-pointer"
                                style={cellStyle}
                                title={title}
                                onMouseEnter={() => setHoveredCol(ex)}
                                onMouseLeave={() => setHoveredCol(null)}
                              >
                                {inner}
                              </a>
                            ) : (
                              <div
                                className="relative flex items-center justify-center w-full rounded-[3px]"
                                style={cellStyle}
                                title={title}
                                onMouseEnter={() => setHoveredCol(ex)}
                                onMouseLeave={() => setHoveredCol(null)}
                              >
                                {inner}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile scroll hint gradient */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#111] to-transparent pointer-events-none md:hidden" />
          </div>

          {exchangeSort && (
            <div className="px-4 py-1.5 border-t border-white/[0.04] flex items-center gap-2">
              <span className="text-[10px] text-neutral-600">
                Sorted by <span className="text-neutral-400 font-medium">{exchangeSort.exchange === '__avg__' ? 'Average' : exchangeSort.exchange}</span>
                {' '}{exchangeSort.direction === 'desc' ? '↓' : '↑'}
              </span>
              <button onClick={() => setExchangeSort(null)} className="text-[10px] text-neutral-600 hover:text-white transition-colors">✕</button>
            </div>
          )}

          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={sortedSymbols.length}
            rowsPerPage={ROWS_PER_PAGE}
            onPageChange={setCurrentPage}
            label="symbols"
          />
        </>
      )}
    </div>
  );
}
