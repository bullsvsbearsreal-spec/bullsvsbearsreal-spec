'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate } from '../utils';
import Pagination from './Pagination';
import { ChevronUp, ChevronDown, ExternalLink, Grid3X3, LayoutGrid } from 'lucide-react';
import { getExchangeTradeUrl } from '@/lib/constants';

const ROWS_PER_PAGE = 50;
const TREEMAP_MAX = 100;

interface ExchangeSort {
  exchange: string;
  direction: 'desc' | 'asc';
}

type HeatmapMode = 'grid' | 'treemap';

interface FundingHeatmapViewProps {
  symbols: string[];
  visibleExchanges: string[];
  heatmapData: Map<string, Map<string, number>>;
  intervalMap?: Map<string, string>;
  oiMap?: Map<string, number>;
  longShortMap?: Map<string, { long: number; short: number }>;
}

/* ═══════════════════════════════════════
   COLOR ENGINE
   ═══════════════════════════════════════ */

function rateToColors(rate: number | undefined): { bg: string; text: string; glow: string } {
  if (rate === undefined) return { bg: 'rgba(255,255,255,0.02)', text: 'rgba(255,255,255,0.12)', glow: 'transparent' };
  if (rate === 0) return { bg: 'rgba(255,255,255,0.035)', text: 'rgba(255,255,255,0.35)', glow: 'transparent' };

  const abs = Math.min(Math.abs(rate), 0.3);
  const t = Math.pow(abs / 0.3, 0.55); // gamma for perceptual linearity

  if (rate > 0) {
    return {
      bg: `rgba(16, 185, 129, ${(0.07 + t * 0.38).toFixed(3)})`,
      text: `rgba(52, 211, 153, ${(0.5 + t * 0.5).toFixed(3)})`,
      glow: t > 0.25 ? `rgba(16, 185, 129, ${(t * 0.15).toFixed(3)})` : 'transparent',
    };
  } else {
    return {
      bg: `rgba(244, 63, 94, ${(0.07 + t * 0.38).toFixed(3)})`,
      text: `rgba(251, 113, 133, ${(0.5 + t * 0.5).toFixed(3)})`,
      glow: t > 0.25 ? `rgba(244, 63, 94, ${(t * 0.15).toFixed(3)})` : 'transparent',
    };
  }
}

// Treemap: brighter, more saturated for large blocks
function rateToTreemapColor(rate: number): string {
  const abs = Math.min(Math.abs(rate), 0.25);
  const t = Math.pow(abs / 0.25, 0.5);
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

export default function FundingHeatmapView({
  symbols, visibleExchanges, heatmapData, intervalMap, oiMap, longShortMap,
}: FundingHeatmapViewProps) {
  const [mode, setMode] = useState<HeatmapMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [exchangeSort, setExchangeSort] = useState<ExchangeSort | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [hoveredTreemapSym, setHoveredTreemapSym] = useState<string | null>(null);
  const treemapRef = useRef<HTMLDivElement>(null);
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

  const handleExchangeClick = useCallback((exchange: string) => {
    setExchangeSort(prev => {
      if (!prev || prev.exchange !== exchange) return { exchange, direction: 'desc' };
      if (prev.direction === 'desc') return { exchange, direction: 'asc' };
      return null;
    });
    setCurrentPage(1);
  }, []);

  // ── Computed data ──

  const avgRates = useMemo(() => {
    const map = new Map<string, number>();
    symbols.forEach(sym => {
      const rates = heatmapData.get(sym);
      if (!rates) return;
      let sum = 0, count = 0;
      visibleExchanges.forEach(ex => {
        const r = rates.get(ex);
        if (r !== undefined) {
          const interval = intervalMap?.get(`${sym}|${ex}`);
          const mult = interval === '1h' ? 8 : interval === '4h' ? 2 : 1;
          sum += r * mult;
          count++;
        }
      });
      if (count > 0) map.set(sym, sum / count);
    });
    return map;
  }, [symbols, visibleExchanges, heatmapData, intervalMap]);

  const symbolOI = useMemo(() => {
    const map = new Map<string, number>();
    if (!oiMap) return map;
    symbols.forEach(sym => {
      let total = 0;
      visibleExchanges.forEach(ex => {
        const val = oiMap.get(`${sym}|${ex}`);
        if (val) total += val;
      });
      if (total > 0) map.set(sym, total);
    });
    return map;
  }, [symbols, visibleExchanges, oiMap]);

  const listingCounts = useMemo(() => {
    const map = new Map<string, number>();
    symbols.forEach(sym => {
      const rates = heatmapData.get(sym);
      if (!rates) return;
      let count = 0;
      visibleExchanges.forEach(ex => { if (rates.get(ex) !== undefined) count++; });
      map.set(sym, count);
    });
    return map;
  }, [symbols, visibleExchanges, heatmapData]);

  const sortedSymbols = useMemo(() => {
    if (!exchangeSort) return symbols;
    const { exchange, direction } = exchangeSort;
    if (exchange === '__avg__') {
      return [...symbols].sort((a, b) => {
        const rateA = avgRates.get(a) ?? (direction === 'desc' ? -Infinity : Infinity);
        const rateB = avgRates.get(b) ?? (direction === 'desc' ? -Infinity : Infinity);
        return direction === 'desc' ? rateB - rateA : rateA - rateB;
      });
    }
    return [...symbols].sort((a, b) => {
      const rateA = heatmapData.get(a)?.get(exchange);
      const rateB = heatmapData.get(b)?.get(exchange);
      if (rateA === undefined && rateB === undefined) return 0;
      if (rateA === undefined) return 1;
      if (rateB === undefined) return -1;
      return direction === 'desc' ? rateB - rateA : rateA - rateB;
    });
  }, [symbols, exchangeSort, heatmapData, avgRates]);

  const totalPages = Math.max(1, Math.ceil(sortedSymbols.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageSymbols = sortedSymbols.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Market summary
  const { bullish, bearish } = useMemo(() => {
    let b = 0, br = 0;
    symbols.forEach(sym => {
      const avg = avgRates.get(sym);
      if (avg !== undefined) { if (avg > 0) b++; else if (avg < 0) br++; }
    });
    return { bullish: b, bearish: br };
  }, [symbols, avgRates]);

  // Treemap data
  const treemapRects = useMemo(() => {
    if (mode !== 'treemap') return [];
    const items = symbols
      .map(sym => ({
        symbol: sym,
        rate: avgRates.get(sym) ?? 0,
        oi: symbolOI.get(sym) ?? 1, // fallback to 1 so everything shows
      }))
      .sort((a, b) => b.oi - a.oi)
      .slice(0, TREEMAP_MAX);
    return squarify(items, 0, 0, treemapSize.w, treemapSize.h);
  }, [mode, symbols, avgRates, symbolOI, treemapSize]);

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
    <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: 'var(--hub-darker)' }}>

      {/* ── Toolbar ── */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            <button
              onClick={() => setMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                mode === 'grid' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-3 h-3" />
              Grid
            </button>
            <button
              onClick={() => setMode('treemap')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                mode === 'treemap' ? 'bg-hub-yellow text-black' : 'text-neutral-500 hover:text-white'
              }`}
              title="Treemap view"
            >
              <LayoutGrid className="w-3 h-3" />
              Map
            </button>
          </div>

          <div className="h-3.5 w-px bg-white/[0.08]" />
          <span className="text-neutral-600 text-xs font-mono tabular-nums">{symbols.length}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Sentiment bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-emerald-400/70 font-mono tabular-nums">{bullish}</span>
            <div className="w-10 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${(bullish / Math.max(bullish + bearish, 1)) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-rose-400/70 font-mono tabular-nums">{bearish}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          </div>

          {/* Legend blocks */}
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[9px] text-rose-400/50">−</span>
            <div className="flex gap-[1px]">
              {[0.35, 0.18, 0.08, 0.03, 0.08, 0.18, 0.35].map((a, i) => {
                const isGreen = i >= 4;
                const isNeutral = i === 3;
                return (
                  <div
                    key={i}
                    className="w-2.5 h-2 rounded-[1px]"
                    style={{
                      background: isNeutral
                        ? 'rgba(255,255,255,0.03)'
                        : isGreen
                        ? `rgba(16,185,129,${a})`
                        : `rgba(244,63,94,${a})`,
                    }}
                  />
                );
              })}
            </div>
            <span className="text-[9px] text-emerald-400/50">+</span>
          </div>

          {/* Interval dots */}
          <div className="hidden md:flex items-center gap-2 text-[9px] text-neutral-600">
            <span className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-amber-400/70 inline-block" /> 1h</span>
            <span className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-sky-400/70 inline-block" /> 4h</span>
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
              const color = rateToTreemapColor(rect.rate);
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
                  title={`${rect.symbol}\nAvg: ${formatRate(rect.rate)}\nOI: ${formatOI(rect.oi)}`}
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
                      {formatRate(rect.rate)}
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
            Sized by open interest · Top {Math.min(TREEMAP_MAX, symbols.length)} symbols · Click to view details
          </p>
        </div>
      )}

      {/* ═══════ GRID VIEW ═══════ */}
      {mode === 'grid' && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 px-3 py-2 text-left"
                    style={{
                      background: 'var(--hub-darker)',
                      boxShadow: '2px 0 8px -2px rgba(0,0,0,0.6)',
                      minWidth: 130,
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
                      <th key={ex} className="px-0.5 py-1.5 text-center select-none" style={{ minWidth: 60 }}>
                        <button
                          onClick={() => handleExchangeClick(ex)}
                          className={`w-full flex flex-col items-center gap-0.5 py-1 px-0.5 rounded-md transition-all cursor-pointer ${
                            isActive ? 'bg-white/[0.06]' : hoveredCol === ex ? 'bg-white/[0.03]' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <ExchangeLogo exchange={ex.toLowerCase()} size={14} />
                          <div className="flex items-center gap-0.5">
                            <span className={`${ex.length > 8 ? 'text-[7px]' : 'text-[8px]'} font-medium leading-none transition-colors ${
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
                  const avgColors = rateToColors(avg);

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
                        <Link href={`/funding/${symbol}`} className="flex items-center gap-2 py-1.5 no-underline group/link">
                          <TokenIconSimple symbol={symbol} size={18} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-semibold text-white leading-tight truncate group-hover/link:text-hub-yellow transition-colors">
                              {symbol}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono tabular-nums leading-tight font-medium" style={{ color: avgColors.text }}>
                                {avg !== undefined ? formatRate(avg) : '—'}
                              </span>
                              <span className="text-[8px] text-neutral-700 tabular-nums">{listings}/{visibleExchanges.length}</span>
                            </div>
                          </div>
                        </Link>
                      </td>

                      {visibleExchanges.map(ex => {
                        const rate = rates?.get(ex);
                        const interval = intervalMap?.get(`${symbol}|${ex}`);
                        const tradeUrl = rate !== undefined ? getExchangeTradeUrl(ex, symbol) : null;
                        const colors = rateToColors(rate);
                        const isCross = isRowHovered && hoveredCol === ex;
                        const ls = longShortMap?.get(`${symbol}|${ex}`);
                        const hasLS = ls !== undefined && rate !== undefined;

                        const cellStyle: React.CSSProperties = {
                          background: colors.bg,
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderColor: isCross ? 'rgba(255,255,255,0.2)' : colors.glow,
                          minHeight: hasLS ? 32 : 28,
                          height: hasLS ? 32 : 28,
                          transition: 'border-color 60ms',
                        };

                        const intervalDot = interval === '1h' ? (
                          <span className="absolute top-[2px] right-[2px] w-[3px] h-[3px] rounded-full bg-amber-400/80" />
                        ) : interval === '4h' ? (
                          <span className="absolute top-[2px] right-[2px] w-[3px] h-[3px] rounded-full bg-sky-400/80" />
                        ) : null;

                        const lsLine = ls ? `\nL: ${formatRate(ls.long)} / S: ${formatRate(ls.short)}` : '';
                        const title = rate !== undefined
                          ? `${symbol} · ${ex} · ${formatRate(rate)} (${interval || '8h'})${lsLine}\nClick to trade`
                          : `Not on ${ex}`;
                        const inner = hasLS ? (
                          <>
                            <span className="flex flex-col items-center gap-[1px] leading-none">
                              <span className="text-[8px] font-mono tabular-nums font-medium" style={{ color: rateToColors(ls.long).text }}>
                                <span className="text-white/30">L</span> {formatRate(ls.long)}
                              </span>
                              <span className="text-[8px] font-mono tabular-nums font-medium" style={{ color: rateToColors(ls.short).text }}>
                                <span className="text-white/30">S</span> {formatRate(ls.short)}
                              </span>
                            </span>
                            {intervalDot}
                            {isCross && tradeUrl && (
                              <ExternalLink className="absolute bottom-[1px] right-[1px] w-[7px] h-[7px] text-white/25" />
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-mono tabular-nums leading-none font-medium" style={{ color: colors.text }}>
                              {rate !== undefined ? formatRate(rate) : '—'}
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
