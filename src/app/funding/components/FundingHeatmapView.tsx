'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate } from '../utils';
import Pagination from './Pagination';
import { ArrowUpDown, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { getExchangeTradeUrl } from '@/lib/constants';

const ROWS_PER_PAGE = 50;

interface ExchangeSort {
  exchange: string;
  direction: 'desc' | 'asc';
}

interface FundingHeatmapViewProps {
  symbols: string[];
  visibleExchanges: string[];
  heatmapData: Map<string, Map<string, number>>;
  intervalMap?: Map<string, string>;
}

// ── Color system ──
// Clean, readable colors that don't strain the eyes
// Uses opacity + saturation scaling for a "heat" effect
function rateToStyle(rate: number | undefined): { bg: string; text: string; border: string } {
  if (rate === undefined) return {
    bg: 'rgba(255,255,255,0.015)',
    text: 'rgba(255,255,255,0.15)',
    border: 'transparent',
  };
  if (rate === 0) return {
    bg: 'rgba(255,255,255,0.03)',
    text: 'rgba(255,255,255,0.4)',
    border: 'transparent',
  };

  const abs = Math.min(Math.abs(rate), 0.3);
  // Three-tier intensity: subtle < 0.01, medium 0.01-0.05, hot > 0.05
  const t = Math.pow(abs / 0.3, 0.6);

  if (rate > 0) {
    // Positive: emerald tones
    return {
      bg: `rgba(16, 185, 129, ${0.06 + t * 0.35})`,
      text: `rgba(52, 211, 153, ${0.55 + t * 0.45})`,
      border: t > 0.3 ? `rgba(16, 185, 129, ${t * 0.3})` : 'transparent',
    };
  } else {
    // Negative: rose tones
    return {
      bg: `rgba(244, 63, 94, ${0.06 + t * 0.35})`,
      text: `rgba(251, 113, 133, ${0.55 + t * 0.45})`,
      border: t > 0.3 ? `rgba(244, 63, 94, ${t * 0.3})` : 'transparent',
    };
  }
}

export default function FundingHeatmapView({ symbols, visibleExchanges, heatmapData, intervalMap }: FundingHeatmapViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [exchangeSort, setExchangeSort] = useState<ExchangeSort | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleExchangeClick = useCallback((exchange: string) => {
    setExchangeSort(prev => {
      if (!prev || prev.exchange !== exchange) return { exchange, direction: 'desc' };
      if (prev.direction === 'desc') return { exchange, direction: 'asc' };
      return null;
    });
    setCurrentPage(1);
  }, []);

  // Avg rate per symbol (normalized to 8h)
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

  // Listing counts
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

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: 'var(--hub-darker)' }}>

      {/* ── Toolbar ── */}
      <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold text-sm">Heatmap</h3>
          <div className="h-3.5 w-px bg-white/[0.08]" />
          <span className="text-neutral-600 text-xs font-mono tabular-nums">{symbols.length} pairs</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Market tilt indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-emerald-400/80 font-mono tabular-nums">{bullish}</span>
            </div>
            <div className="w-12 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(bullish / Math.max(bullish + bearish, 1)) * 100}%`,
                  background: 'linear-gradient(to right, rgb(16, 185, 129), rgb(52, 211, 153))',
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-rose-400/80 font-mono tabular-nums">{bearish}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            </div>
          </div>

          <div className="h-3.5 w-px bg-white/[0.08]" />

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[10px] text-rose-400/60">−</span>
            <div className="flex gap-px">
              {[
                'rgba(244,63,94,0.35)',
                'rgba(244,63,94,0.18)',
                'rgba(244,63,94,0.08)',
                'rgba(255,255,255,0.03)',
                'rgba(16,185,129,0.08)',
                'rgba(16,185,129,0.18)',
                'rgba(16,185,129,0.35)',
              ].map((bg, i) => (
                <div key={i} className="w-3 h-2.5 rounded-[2px] first:rounded-l last:rounded-r" style={{ background: bg }} />
              ))}
            </div>
            <span className="text-[10px] text-emerald-400/60">+</span>
          </div>

          {/* Interval legend */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-amber-400/70" />
              <span className="text-[9px] text-neutral-600">1h</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-sky-400/70" />
              <span className="text-[9px] text-neutral-600">4h</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto" ref={tableRef}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* Sticky symbol header */}
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
                  <span>Symbol</span>
                  <span className="text-neutral-700 font-normal lowercase tracking-normal">/avg</span>
                  {exchangeSort?.exchange === '__avg__' ? (
                    exchangeSort.direction === 'desc'
                      ? <ChevronDown className="w-3 h-3 text-hub-yellow" />
                      : <ChevronUp className="w-3 h-3 text-hub-yellow" />
                  ) : (
                    <ArrowUpDown className="w-2.5 h-2.5 text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </th>
              {/* Exchange headers */}
              {visibleExchanges.map(ex => {
                const isActive = exchangeSort?.exchange === ex;
                const isColHovered = hoveredCol === ex;
                return (
                  <th
                    key={ex}
                    className="px-0.5 py-1.5 text-center select-none"
                    style={{ minWidth: 58 }}
                  >
                    <button
                      onClick={() => handleExchangeClick(ex)}
                      className={`w-full flex flex-col items-center gap-0.5 py-1 px-0.5 rounded-md transition-all cursor-pointer ${
                        isActive ? 'bg-white/[0.06]' : isColHovered ? 'bg-white/[0.03]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <ExchangeLogo exchange={ex.toLowerCase()} size={14} />
                      <div className="flex items-center gap-0.5">
                        <span className={`text-[8px] font-medium leading-none transition-colors ${
                          isActive ? 'text-hub-yellow' : 'text-neutral-600'
                        }`}>
                          {ex.length > 7 ? ex.slice(0, 6) : ex}
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
            {pageSymbols.map((symbol, rowIdx) => {
              const rates = heatmapData.get(symbol);
              const avg = avgRates.get(symbol);
              const listings = listingCounts.get(symbol) ?? 0;
              const isRowHovered = hoveredRow === symbol;
              const avgStyle = rateToStyle(avg);

              return (
                <tr
                  key={symbol}
                  onMouseEnter={() => setHoveredRow(symbol)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="group"
                  style={{
                    background: isRowHovered ? 'rgba(255,255,255,0.02)' : undefined,
                  }}
                >
                  {/* ── Symbol cell ── */}
                  <td
                    className="sticky left-0 z-10 px-2 py-0"
                    style={{
                      background: isRowHovered ? '#151515' : 'var(--hub-darker)',
                      boxShadow: '2px 0 8px -2px rgba(0,0,0,0.6)',
                      transition: 'background 80ms ease',
                    }}
                  >
                    <Link href={`/funding/${symbol}`} className="flex items-center gap-2 py-1.5 no-underline group/link">
                      <TokenIconSimple symbol={symbol} size={18} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-white leading-tight truncate group-hover/link:text-hub-yellow transition-colors">
                          {symbol}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-mono tabular-nums leading-tight font-medium"
                            style={{ color: avgStyle.text }}
                          >
                            {avg !== undefined ? formatRate(avg) : '—'}
                          </span>
                          <span className="text-[8px] text-neutral-700 tabular-nums">{listings}/{visibleExchanges.length}</span>
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* ── Rate cells ── */}
                  {visibleExchanges.map(ex => {
                    const rate = rates?.get(ex);
                    const interval = intervalMap?.get(`${symbol}|${ex}`);
                    const tradeUrl = rate !== undefined ? getExchangeTradeUrl(ex, symbol) : null;
                    const style = rateToStyle(rate);
                    const isCrossHair = isRowHovered && hoveredCol === ex;

                    const cellContent = (
                      <span
                        className="text-[10px] font-mono tabular-nums leading-none font-medium"
                        style={{ color: style.text }}
                      >
                        {rate !== undefined ? formatRate(rate) : '—'}
                      </span>
                    );

                    // Interval indicator
                    const intervalDot = interval === '1h' ? (
                      <span className="absolute top-[2px] right-[2px] w-[3px] h-[3px] rounded-full bg-amber-400/80" />
                    ) : interval === '4h' ? (
                      <span className="absolute top-[2px] right-[2px] w-[3px] h-[3px] rounded-full bg-sky-400/80" />
                    ) : null;

                    const cellStyle: React.CSSProperties = {
                      background: style.bg,
                      borderColor: isCrossHair ? 'rgba(255,255,255,0.2)' : style.border,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      transition: 'all 80ms ease',
                    };

                    const title = rate !== undefined
                      ? `${symbol} on ${ex}\n${formatRate(rate)} (${interval || '8h'})\nClick to trade`
                      : `${symbol} not listed on ${ex}`;

                    return (
                      <td key={ex} className="px-[1.5px] py-[1.5px]">
                        {tradeUrl ? (
                          <a
                            href={tradeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative flex items-center justify-center w-full rounded-[3px] no-underline cursor-pointer"
                            style={{ ...cellStyle, height: 28 }}
                            title={title}
                            onMouseEnter={() => setHoveredCol(ex)}
                            onMouseLeave={() => setHoveredCol(null)}
                          >
                            {cellContent}
                            {intervalDot}
                            {isCrossHair && rate !== undefined && (
                              <ExternalLink className="absolute bottom-[1px] right-[1px] w-[7px] h-[7px] text-white/30" />
                            )}
                          </a>
                        ) : (
                          <div
                            className="relative flex items-center justify-center w-full rounded-[3px]"
                            style={{ ...cellStyle, height: 28 }}
                            title={title}
                            onMouseEnter={() => setHoveredCol(ex)}
                            onMouseLeave={() => setHoveredCol(null)}
                          >
                            {cellContent}
                            {intervalDot}
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

      {/* ── Sort info + Pagination ── */}
      {exchangeSort && (
        <div className="px-4 py-1.5 border-t border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] text-neutral-600">
            Sorted by{' '}
            <span className="text-neutral-400 font-medium">
              {exchangeSort.exchange === '__avg__' ? 'Average' : exchangeSort.exchange}
            </span>
            {' '}{exchangeSort.direction === 'desc' ? '↓' : '↑'}
          </span>
          <button
            onClick={() => setExchangeSort(null)}
            className="text-[10px] text-neutral-600 hover:text-white transition-colors ml-1"
          >
            ✕ clear
          </button>
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
    </div>
  );
}
