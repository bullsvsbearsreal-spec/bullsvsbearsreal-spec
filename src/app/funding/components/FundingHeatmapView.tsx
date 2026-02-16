'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate } from '../utils';
import Pagination from './Pagination';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

// ── Color engine: smooth perceptual gradient ──
// Maps funding rate to an RGB color with smooth interpolation
function rateToColor(rate: number | undefined): string {
  if (rate === undefined) return 'rgba(255,255,255,0.02)';
  if (rate === 0) return 'rgba(255,255,255,0.04)';
  // Clamp to ±0.25 for color range, with log-ish curve for better low-range resolution
  const sign = rate > 0 ? 1 : -1;
  const abs = Math.min(Math.abs(rate), 0.25);
  const t = Math.pow(abs / 0.25, 0.7); // gamma curve: more resolution in low range
  if (sign > 0) {
    // Neutral → vivid green: rgb(22,27,34) → rgb(0,210,106)
    const r = Math.round(22 * (1 - t));
    const g = Math.round(27 + (210 - 27) * t);
    const b = Math.round(34 + (106 - 34) * t * 0.6);
    return `rgb(${r},${g},${b})`;
  } else {
    // Neutral → vivid red: rgb(22,27,34) → rgb(234,57,67)
    const r = Math.round(22 + (234 - 22) * t);
    const g = Math.round(27 + (57 - 27) * t * 0.3);
    const b = Math.round(34 + (67 - 34) * t * 0.3);
    return `rgb(${r},${g},${b})`;
  }
}

function rateToTextOpacity(rate: number | undefined): string {
  if (rate === undefined) return 'opacity-20';
  const abs = Math.abs(rate);
  if (abs > 0.08) return 'opacity-100';
  if (abs > 0.03) return 'opacity-90';
  if (abs > 0.005) return 'opacity-70';
  return 'opacity-50';
}

export default function FundingHeatmapView({ symbols, visibleExchanges, heatmapData, intervalMap }: FundingHeatmapViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [exchangeSort, setExchangeSort] = useState<ExchangeSort | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ sym: string; ex: string } | null>(null);

  const handleExchangeClick = useCallback((exchange: string) => {
    setExchangeSort(prev => {
      if (!prev || prev.exchange !== exchange) return { exchange, direction: 'desc' };
      if (prev.direction === 'desc') return { exchange, direction: 'asc' };
      return null;
    });
    setCurrentPage(1);
  }, []);

  // Average rate per symbol (normalized to 8h)
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

  // Count how many exchanges list each symbol
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
      if (rateB === undefined) return 1;
      return direction === 'desc' ? rateB - rateA : rateA - rateB;
    });
  }, [symbols, exchangeSort, heatmapData, avgRates]);

  const totalPages = Math.max(1, Math.ceil(sortedSymbols.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageSymbols = sortedSymbols.slice(startIdx, startIdx + ROWS_PER_PAGE);
  const isAvgSort = exchangeSort?.exchange === '__avg__';

  // Summary stats
  const totalPositive = useMemo(() => {
    let count = 0;
    symbols.forEach(sym => {
      const avg = avgRates.get(sym);
      if (avg !== undefined && avg > 0) count++;
    });
    return count;
  }, [symbols, avgRates]);

  const SortIndicator = ({ active, dir }: { active: boolean; dir?: 'desc' | 'asc' }) => {
    if (!active) return null;
    return dir === 'desc'
      ? <ArrowDown className="w-2.5 h-2.5 flex-shrink-0" />
      : <ArrowUp className="w-2.5 h-2.5 flex-shrink-0" />;
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: 'var(--hub-darker)' }}>

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 rounded-full" style={{ background: 'var(--hub-accent)' }} />
              <h3 className="text-white font-bold text-sm tracking-tight">Funding Heatmap</h3>
              <span className="text-[10px] text-neutral-600 font-mono">{symbols.length} pairs</span>
            </div>
            <p className="text-neutral-600 text-[11px] pl-3">
              {exchangeSort
                ? <>Sorted by <span className="text-neutral-400">{exchangeSort.exchange === '__avg__' ? 'Average' : exchangeSort.exchange}</span> {exchangeSort.direction === 'desc' ? '(high to low)' : '(low to high)'}</>
                : 'Click cells to open trade · Click headers to sort'}
            </p>
          </div>

          {/* Market sentiment pill */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-bold text-green-400 tabular-nums">{totalPositive}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <TrendingDown className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-bold text-red-400 tabular-nums">{symbols.length - totalPositive}</span>
            </div>
          </div>
        </div>

        {/* Legend bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-red-400/80 font-mono tabular-nums w-10 text-right">shorts pay</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div
              className="h-full w-full rounded-full"
              style={{ background: `linear-gradient(to right, ${rateToColor(-0.25)}, ${rateToColor(-0.1)}, ${rateToColor(-0.02)}, rgba(255,255,255,0.04), ${rateToColor(0.02)}, ${rateToColor(0.1)}, ${rateToColor(0.25)})` }}
            />
          </div>
          <span className="text-[9px] text-green-400/80 font-mono tabular-nums w-10">longs pay</span>
        </div>

        {/* Interval markers */}
        <div className="flex items-center gap-3 mt-2 pl-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <span className="text-[9px] text-neutral-600">1h interval</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
            <span className="text-[9px] text-neutral-600">4h interval</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="w-2.5 h-2.5 text-neutral-700" />
            <span className="text-[9px] text-neutral-600">not listed</span>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr className="border-t border-b border-white/[0.06]">
              {/* Sticky symbol header */}
              <th
                className="px-3 py-2 text-left text-[9px] font-bold text-neutral-500 uppercase tracking-[0.1em] sticky left-0 z-20 min-w-[110px]"
                style={{ background: 'var(--hub-darker)', boxShadow: '4px 0 12px -2px rgba(0,0,0,0.5)' }}
              >
                <div className="flex items-center gap-1">
                  Token
                  <span className="text-neutral-700 normal-case tracking-normal font-normal">/ avg</span>
                </div>
              </th>
              {/* Exchange headers */}
              {visibleExchanges.map(ex => {
                const isActive = exchangeSort?.exchange === ex;
                return (
                  <th
                    key={ex}
                    className="px-0 py-1.5 text-center cursor-pointer select-none"
                    onClick={() => handleExchangeClick(ex)}
                  >
                    <div className={`flex flex-col items-center gap-0.5 mx-auto px-1 py-1 rounded-md transition-all ${
                      isActive
                        ? 'bg-white/[0.06]'
                        : 'hover:bg-white/[0.03]'
                    }`}>
                      <ExchangeLogo exchange={ex.toLowerCase()} size={16} />
                      <div className="flex items-center gap-0.5">
                        <span className={`text-[8px] font-medium leading-none ${isActive ? 'text-white' : 'text-neutral-600'}`}>
                          {ex.length > 6 ? ex.slice(0, 5) : ex}
                        </span>
                        <SortIndicator active={isActive} dir={exchangeSort?.direction} />
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageSymbols.map((symbol) => {
              const rates = heatmapData.get(symbol);
              const avg = avgRates.get(symbol);
              const listings = listingCounts.get(symbol) ?? 0;
              const isRowHovered = hoveredCell?.sym === symbol;

              return (
                <tr
                  key={symbol}
                  className={`transition-colors duration-75 ${isRowHovered ? 'bg-white/[0.02]' : ''}`}
                >
                  {/* ── Symbol + avg cell ── */}
                  <td
                    className="px-2 py-0 sticky left-0 z-10"
                    style={{ background: 'var(--hub-darker)', boxShadow: '4px 0 12px -2px rgba(0,0,0,0.5)' }}
                  >
                    <Link href={`/funding/${symbol}`} className="flex items-center gap-1.5 py-1.5 group">
                      <TokenIconSimple symbol={symbol} size={16} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-white group-hover:text-hub-yellow transition-colors leading-tight truncate">
                          {symbol}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[9px] font-mono leading-tight tabular-nums ${
                              avg === undefined ? 'text-neutral-700' : avg > 0 ? 'text-green-400/70' : avg < 0 ? 'text-red-400/70' : 'text-neutral-600'
                            }`}
                          >
                            {avg !== undefined ? formatRate(avg) : '-'}
                          </span>
                          <span className="text-[8px] text-neutral-700">{listings}/{visibleExchanges.length}</span>
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* ── Rate cells ── */}
                  {visibleExchanges.map(ex => {
                    const rate = rates?.get(ex);
                    const interval = intervalMap?.get(`${symbol}|${ex}`);
                    const tradeUrl = rate !== undefined ? getExchangeTradeUrl(ex, symbol) : null;
                    const isActiveCol = exchangeSort?.exchange === ex;
                    const isCellHovered = hoveredCell?.sym === symbol && hoveredCell?.ex === ex;
                    const bg = rateToColor(rate);
                    const textOp = rateToTextOpacity(rate);

                    const title = rate !== undefined
                      ? `${symbol} · ${ex} · ${formatRate(rate)} ${interval || '8h'}\nClick to trade on ${ex}`
                      : `Not listed on ${ex}`;

                    const intervalDot = interval === '1h'
                      ? <span className="absolute top-[2px] right-[2px] w-[4px] h-[4px] rounded-full bg-amber-400/70" />
                      : interval === '4h'
                      ? <span className="absolute top-[2px] right-[2px] w-[4px] h-[4px] rounded-full bg-blue-400/70" />
                      : null;

                    const cellInner = (
                      <>
                        <span className={`relative z-[1] text-[10px] font-mono tabular-nums leading-none ${textOp}`}>
                          {rate !== undefined ? formatRate(rate) : <Minus className="w-2.5 h-2.5 text-neutral-800 mx-auto" />}
                        </span>
                        {intervalDot}
                      </>
                    );

                    const cellStyle: React.CSSProperties = {
                      background: bg,
                      boxShadow: isCellHovered ? `0 0 0 1px rgba(255,255,255,0.25), 0 4px 16px -4px rgba(0,0,0,0.5)` : isActiveCol ? `inset 0 0 0 1px rgba(255,255,255,0.06)` : 'none',
                      transform: isCellHovered ? 'scale(1.06)' : 'none',
                    };

                    const sharedClass = `relative block w-full h-full rounded-[3px] px-0.5 py-[5px] text-center text-white no-underline transition-all duration-100`;

                    return (
                      <td key={ex} className="px-[1px] py-[1px]">
                        {tradeUrl ? (
                          <a
                            href={tradeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${sharedClass} cursor-pointer`}
                            style={cellStyle}
                            title={title}
                            onMouseEnter={() => setHoveredCell({ sym: symbol, ex })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {cellInner}
                          </a>
                        ) : (
                          <div
                            className={sharedClass}
                            style={{ ...cellStyle, cursor: 'default' }}
                            title={title}
                            onMouseEnter={() => setHoveredCell({ sym: symbol, ex })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {cellInner}
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
