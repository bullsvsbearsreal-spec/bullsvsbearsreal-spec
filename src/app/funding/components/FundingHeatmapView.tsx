'use client';

import { useState, useMemo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate, getHeatmapColor } from '../utils';
import Pagination from './Pagination';
import { ArrowUp, ArrowDown } from 'lucide-react';

const ROWS_PER_PAGE = 50;

interface ExchangeSort {
  exchange: string;
  direction: 'desc' | 'asc';
}

interface FundingHeatmapViewProps {
  symbols: string[];
  visibleExchanges: string[];
  heatmapData: Map<string, Map<string, number>>;
  intervalMap?: Map<string, string>; // "SYMBOL|EXCHANGE" → "1h" | "4h"
}

export default function FundingHeatmapView({ symbols, visibleExchanges, heatmapData, intervalMap }: FundingHeatmapViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [exchangeSort, setExchangeSort] = useState<ExchangeSort | null>(null);

  // Three-click cycle: click 1 → desc (highest first), click 2 → asc (lowest first), click 3 → reset
  const handleExchangeClick = (exchange: string) => {
    setExchangeSort(prev => {
      if (!prev || prev.exchange !== exchange) return { exchange, direction: 'desc' };
      if (prev.direction === 'desc') return { exchange, direction: 'asc' };
      return null; // Third click resets
    });
    setCurrentPage(1); // Reset to page 1 when sorting changes
  };

  // Sort symbols by selected exchange's funding rate
  const sortedSymbols = useMemo(() => {
    if (!exchangeSort) return symbols;

    const { exchange, direction } = exchangeSort;
    return [...symbols].sort((a, b) => {
      const rateA = heatmapData.get(a)?.get(exchange);
      const rateB = heatmapData.get(b)?.get(exchange);

      // Symbols without a rate on this exchange go to the bottom
      if (rateA === undefined && rateB === undefined) return 0;
      if (rateA === undefined) return 1;
      if (rateB === undefined) return 1;

      return direction === 'desc' ? rateB - rateA : rateA - rateB;
    });
  }, [symbols, exchangeSort, heatmapData]);

  const totalPages = Math.max(1, Math.ceil(sortedSymbols.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageSymbols = sortedSymbols.slice(startIdx, startIdx + ROWS_PER_PAGE);

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Funding Rate Heatmap</h3>
          <p className="text-neutral-600 text-xs">
            {exchangeSort
              ? `Sorted by ${exchangeSort.exchange} — ${exchangeSort.direction === 'desc' ? 'highest' : 'lowest'} first`
              : 'Click an exchange name to sort by its funding rate'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-neutral-500">&lt;-0.1%</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-neutral-700" /><span className="text-neutral-500">~0%</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-neutral-500">&gt;+0.1%</span></div>
          <span className="text-neutral-700">|</span>
          <span className="text-amber-400 font-bold">*</span><span className="text-neutral-500">1h</span>
          <span className="text-blue-400 font-bold">**</span><span className="text-neutral-500">4h</span>
          <span className="text-neutral-600">no mark=8h</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th scope="col" className="px-3 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider sticky left-0 bg-[#0d0d0d] z-10">Symbol</th>
              {visibleExchanges.map(ex => {
                const isActive = exchangeSort?.exchange === ex;
                return (
                  <th
                    key={ex}
                    scope="col"
                    className="px-1 py-2 text-center text-[10px] font-medium text-neutral-600 cursor-pointer select-none"
                    onClick={() => handleExchangeClick(ex)}
                  >
                    <div className={`flex items-center justify-center gap-1 rounded-md px-1 py-1 transition-colors ${
                      isActive ? 'bg-hub-yellow/10 text-hub-yellow' : 'hover:bg-white/[0.04] hover:text-neutral-400'
                    }`}>
                      <ExchangeLogo exchange={ex.toLowerCase()} size={14} />
                      <span className="hidden lg:inline">{ex}</span>
                      {isActive && (
                        exchangeSort.direction === 'desc'
                          ? <ArrowDown className="w-3 h-3 text-hub-yellow flex-shrink-0" />
                          : <ArrowUp className="w-3 h-3 text-hub-yellow flex-shrink-0" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageSymbols.map(symbol => {
              const rates = heatmapData.get(symbol);
              return (
                <tr key={symbol} className="border-b border-white/[0.02]">
                  <td className="px-3 py-1.5 sticky left-0 bg-[#0d0d0d] z-10">
                    <div className="flex items-center gap-1.5">
                      <TokenIconSimple symbol={symbol} size={18} />
                      <span className="text-white font-medium text-xs">{symbol}</span>
                    </div>
                  </td>
                  {visibleExchanges.map(ex => {
                    const rate = rates?.get(ex);
                    const isActiveCol = exchangeSort?.exchange === ex;
                    const interval = intervalMap?.get(`${symbol}|${ex}`);
                    return (
                      <td key={ex} className="px-0.5 py-0.5">
                        <div
                          className={`${getHeatmapColor(rate)} rounded px-1.5 py-1.5 text-center text-[11px] font-mono text-white/80 ${
                            isActiveCol ? 'ring-1 ring-hub-yellow/30' : ''
                          }`}
                          title={rate !== undefined && interval
                            ? `${formatRate(rate)} funding fee every ${interval === '1h' ? '1 hour' : '4 hours'}`
                            : `${symbol} on ${ex}: ${rate !== undefined ? formatRate(rate) : 'N/A'} (8h payout)`}
                        >
                          {rate !== undefined ? formatRate(rate) : '-'}
                          {interval === '1h' && <span className="text-amber-400 text-[8px] ml-0.5 font-bold">*</span>}
                          {interval === '4h' && <span className="text-blue-400 text-[8px] ml-0.5 font-bold">**</span>}
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
