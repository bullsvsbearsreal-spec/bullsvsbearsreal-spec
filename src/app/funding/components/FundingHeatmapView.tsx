'use client';

import { useState } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRate, getHeatmapColor } from '../utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ROWS_PER_PAGE = 50;

interface FundingHeatmapViewProps {
  symbols: string[];
  visibleExchanges: string[];
  heatmapData: Map<string, Map<string, number>>;
}

export default function FundingHeatmapView({ symbols, visibleExchanges, heatmapData }: FundingHeatmapViewProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(symbols.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageSymbols = symbols.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Build page number buttons: show 1, 2, ..., current-1, current, current+1, ..., last
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    const current = safeCurrentPage;

    pages.push(1);
    if (current > 3) pages.push('...');

    const rangeStart = Math.max(2, current - 1);
    const rangeEnd = Math.min(totalPages - 1, current + 1);
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);

    if (current < totalPages - 2) pages.push('...');
    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Funding Rate Heatmap</h3>
          <p className="text-neutral-600 text-xs">Compare rates across exchanges</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-neutral-500">&lt;-0.1%</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-neutral-700" /><span className="text-neutral-500">~0%</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-neutral-500">&gt;+0.1%</span></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th scope="col" className="px-3 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider sticky left-0 bg-[#0d0d0d] z-10">Symbol</th>
              {visibleExchanges.map(ex => (
                <th key={ex} scope="col" className="px-1 py-2 text-center text-[10px] font-medium text-neutral-600">
                  <div className="flex items-center justify-center gap-1">
                    <ExchangeLogo exchange={ex.toLowerCase()} size={14} />
                    <span className="hidden lg:inline">{ex}</span>
                  </div>
                </th>
              ))}
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
                    return (
                      <td key={ex} className="px-0.5 py-0.5">
                        <div
                          className={`${getHeatmapColor(rate)} rounded px-1.5 py-1.5 text-center text-[11px] font-mono text-white/80`}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-neutral-600 text-xs">
            {startIdx + 1}–{Math.min(startIdx + ROWS_PER_PAGE, symbols.length)} of {symbols.length} symbols
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              aria-label="Previous page"
              className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {getPageNumbers().map((page, i) =>
              page === '...' ? (
                <span key={`dots-${i}`} className="px-1 text-neutral-600 text-xs">…</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors ${
                    page === safeCurrentPage
                      ? 'bg-hub-yellow text-black'
                      : 'text-neutral-500 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              aria-label="Next page"
              className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
