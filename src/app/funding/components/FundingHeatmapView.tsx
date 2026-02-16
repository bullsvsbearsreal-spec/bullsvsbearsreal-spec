'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate } from '../utils';
import Pagination from './Pagination';
import { ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
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

// Smooth HSL color from rate: red ← 0 → green with luminosity scaling for intensity
function getCellStyle(rate: number | undefined): React.CSSProperties {
  if (rate === undefined) return { backgroundColor: 'rgba(255,255,255,0.03)' };
  // Clamp to ±0.3% for color range
  const clamped = Math.max(-0.3, Math.min(0.3, rate));
  const abs = Math.abs(clamped);
  // Intensity: 0% → 0 opacity, 0.3% → full
  const intensity = abs / 0.3;
  if (rate > 0) {
    // Green: hue 142, higher saturation + lower lightness for stronger rates
    const sat = 50 + intensity * 30;
    const light = 18 + intensity * 14;
    const alpha = 0.3 + intensity * 0.7;
    return { backgroundColor: `hsla(142, ${sat}%, ${light}%, ${alpha})` };
  }
  if (rate < 0) {
    // Red: hue 0, similar curve
    const sat = 50 + intensity * 30;
    const light = 18 + intensity * 14;
    const alpha = 0.3 + intensity * 0.7;
    return { backgroundColor: `hsla(0, ${sat}%, ${light}%, ${alpha})` };
  }
  return { backgroundColor: 'rgba(255,255,255,0.04)' };
}

function getTextColor(rate: number | undefined): string {
  if (rate === undefined) return 'text-neutral-600';
  const abs = Math.abs(rate);
  if (abs > 0.05) return 'text-white';
  if (abs > 0.01) return 'text-white/80';
  return 'text-white/60';
}

export default function FundingHeatmapView({ symbols, visibleExchanges, heatmapData, intervalMap }: FundingHeatmapViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [exchangeSort, setExchangeSort] = useState<ExchangeSort | null>(null);

  const handleExchangeClick = (exchange: string) => {
    setExchangeSort(prev => {
      if (!prev || prev.exchange !== exchange) return { exchange, direction: 'desc' };
      if (prev.direction === 'desc') return { exchange, direction: 'asc' };
      return null;
    });
    setCurrentPage(1);
  };

  // Compute average rate per symbol across visible exchanges
  const avgRates = useMemo(() => {
    const map = new Map<string, number>();
    symbols.forEach(sym => {
      const rates = heatmapData.get(sym);
      if (!rates) return;
      let sum = 0, count = 0;
      visibleExchanges.forEach(ex => {
        const r = rates.get(ex);
        if (r !== undefined) {
          // Normalize to 8h basis
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

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-white font-semibold text-sm">Funding Rate Heatmap</h3>
            <p className="text-neutral-600 text-xs mt-0.5">
              {exchangeSort
                ? `Sorted by ${exchangeSort.exchange === '__avg__' ? 'average' : exchangeSort.exchange} — ${exchangeSort.direction === 'desc' ? 'highest' : 'lowest'} first`
                : 'Click exchange headers to sort · Click cells to trade'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-[10px]">*</span><span className="text-neutral-600 text-[10px]">1h</span>
            <span className="text-blue-400 font-bold text-[10px]">**</span><span className="text-neutral-600 text-[10px]">4h</span>
          </div>
        </div>
        {/* Gradient legend */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-red-400 font-mono">-0.3%</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden flex">
            <div className="flex-1" style={{ background: 'linear-gradient(to right, hsl(0,80%,32%), hsl(0,50%,18%) 40%, rgba(255,255,255,0.04) 50%, hsl(142,50%,18%) 60%, hsl(142,80%,32%))' }} />
          </div>
          <span className="text-[10px] text-green-400 font-mono">+0.3%</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold text-neutral-500 uppercase tracking-widest sticky left-0 bg-hub-darker z-20 min-w-[100px]" style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.4)' }}>
                Symbol
              </th>
              {/* Avg column */}
              <th
                className="px-1 py-2 text-center text-[10px] font-bold cursor-pointer select-none min-w-[60px]"
                onClick={() => handleExchangeClick('__avg__')}
              >
                <div className={`flex items-center justify-center gap-0.5 rounded-md px-1.5 py-1 transition-colors ${
                  isAvgSort ? 'bg-hub-yellow/10 text-hub-yellow' : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300'
                }`}>
                  <span>AVG</span>
                  {isAvgSort && (
                    exchangeSort!.direction === 'desc'
                      ? <ArrowDown className="w-2.5 h-2.5" />
                      : <ArrowUp className="w-2.5 h-2.5" />
                  )}
                </div>
              </th>
              {visibleExchanges.map(ex => {
                const isActive = exchangeSort?.exchange === ex;
                return (
                  <th
                    key={ex}
                    className="px-0.5 py-2 text-center text-[10px] font-medium text-neutral-600 cursor-pointer select-none"
                    onClick={() => handleExchangeClick(ex)}
                  >
                    <div className={`flex items-center justify-center gap-0.5 rounded-md px-1 py-1 transition-colors ${
                      isActive ? 'bg-hub-yellow/10 text-hub-yellow' : 'hover:bg-white/[0.04] hover:text-neutral-400'
                    }`}>
                      <ExchangeLogo exchange={ex.toLowerCase()} size={14} />
                      <span className="hidden xl:inline text-[9px]">{ex}</span>
                      {isActive && (
                        exchangeSort!.direction === 'desc'
                          ? <ArrowDown className="w-2.5 h-2.5 text-hub-yellow flex-shrink-0" />
                          : <ArrowUp className="w-2.5 h-2.5 text-hub-yellow flex-shrink-0" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageSymbols.map((symbol, rowIdx) => {
              const rates = heatmapData.get(symbol);
              const avg = avgRates.get(symbol);
              return (
                <tr key={symbol} className={rowIdx % 2 === 0 ? '' : 'bg-white/[0.01]'}>
                  {/* Sticky symbol column */}
                  <td className="px-3 py-1 sticky left-0 bg-hub-darker z-10" style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.4)' }}>
                    <Link href={`/funding/${symbol}`} className="flex items-center gap-1.5 group">
                      <TokenIconSimple symbol={symbol} size={16} />
                      <span className="text-white font-medium text-[11px] group-hover:text-hub-yellow transition-colors">{symbol}</span>
                    </Link>
                  </td>
                  {/* Avg cell */}
                  <td className="px-0.5 py-0.5">
                    <div
                      className={`rounded-sm px-1 py-1 text-center text-[10px] font-mono font-semibold ${getTextColor(avg)} border-r border-white/[0.04]`}
                      style={getCellStyle(avg)}
                    >
                      {avg !== undefined ? formatRate(avg) : '-'}
                    </div>
                  </td>
                  {/* Exchange cells */}
                  {visibleExchanges.map(ex => {
                    const rate = rates?.get(ex);
                    const isActiveCol = exchangeSort?.exchange === ex;
                    const interval = intervalMap?.get(`${symbol}|${ex}`);
                    const tradeUrl = rate !== undefined ? getExchangeTradeUrl(ex, symbol) : null;

                    const style = getCellStyle(rate);
                    const textColor = getTextColor(rate);
                    const activeRing = isActiveCol ? 'ring-1 ring-hub-yellow/20' : '';
                    const hoverClass = tradeUrl
                      ? 'cursor-pointer hover:scale-[1.08] hover:z-10 hover:ring-1 hover:ring-white/40 hover:shadow-lg hover:shadow-black/40 active:scale-95'
                      : '';

                    const cellContent = (
                      <>
                        <span>{rate !== undefined ? formatRate(rate) : '-'}</span>
                        {interval === '1h' && <span className="text-amber-400 text-[7px] ml-0.5 font-bold align-top">*</span>}
                        {interval === '4h' && <span className="text-blue-400 text-[7px] ml-0.5 font-bold align-top">**</span>}
                        {tradeUrl && rate !== undefined && (
                          <ExternalLink className="w-2 h-2 opacity-0 group-hover/cell:opacity-40 absolute top-0.5 right-0.5 text-white" />
                        )}
                      </>
                    );

                    const className = `group/cell relative block rounded-sm px-1 py-1 text-center text-[10px] font-mono no-underline transition-all duration-150 ${textColor} ${activeRing} ${hoverClass}`;

                    const title = rate !== undefined
                      ? `${symbol} on ${ex}: ${formatRate(rate)}${interval ? ` (${interval})` : ' (8h)'} — click to trade`
                      : `${symbol} not listed on ${ex}`;

                    return (
                      <td key={ex} className="px-[1px] py-[1px]">
                        {tradeUrl ? (
                          <a href={tradeUrl} target="_blank" rel="noopener noreferrer" className={className} style={style} title={title}>
                            {cellContent}
                          </a>
                        ) : (
                          <div className={className} style={style} title={title}>
                            {cellContent}
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
