'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FundingRateData } from '@/lib/api/types';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatRate, getRateColor, getExchangeColor } from '../utils';
import { isValidNumber } from '@/lib/utils/format';
import { isExchangeDex } from '@/lib/constants';
import FundingSparkline from './FundingSparkline';
import Pagination from './Pagination';
import type { HistoryPoint } from '@/lib/storage/fundingHistory';

type SortField = 'symbol' | 'fundingRate' | 'exchange' | 'predictedRate';
type SortOrder = 'asc' | 'desc';

const ROWS_PER_PAGE = 100;

interface AccumulatedData {
  d1: number;
  d7: number;
  d30: number;
}

interface FundingTableViewProps {
  data: FundingRateData[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  oiMap?: Map<string, number>;
  historyMap?: Map<string, HistoryPoint[]>;
  accumulatedMap?: Map<string, AccumulatedData>;
}

function formatOI(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function FundingTableView({ data, sortField, sortOrder, onSort, oiMap, historyMap, accumulatedMap }: FundingTableViewProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const hasOI = oiMap && oiMap.size > 0;
  const hasHistory = historyMap && historyMap.size > 0;
  const hasAccumulated = accumulatedMap && accumulatedMap.size > 0;

  const totalPages = Math.max(1, Math.ceil(data.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const visibleData = data.slice(startIdx, startIdx + ROWS_PER_PAGE);

  const hasPredicted = visibleData.some(fr => fr.predictedRate !== undefined && fr.predictedRate !== null);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-hub-yellow" />
      : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  type ColumnDef = { field: SortField | null; label: string; align: string };
  const columns: ColumnDef[] = [
    { field: 'symbol', label: 'Symbol', align: 'left' },
    { field: 'exchange', label: 'Exchange', align: 'left' },
    { field: null, label: 'Interval', align: 'center' },
    { field: 'fundingRate', label: 'Funding Rate', align: 'right' },
    ...(hasPredicted ? [{ field: 'predictedRate' as SortField, label: 'Predicted', align: 'right' }] : []),
    ...(hasHistory ? [{ field: null as SortField | null, label: '7d Trend', align: 'center' }] : []),
    ...(hasAccumulated ? [
      { field: null as SortField | null, label: 'Cumul. 1D', align: 'right' },
      { field: null as SortField | null, label: 'Cumul. 7D', align: 'right' },
    ] : []),
    { field: null, label: 'Annualized', align: 'right' },
    ...(hasOI ? [{ field: null as SortField | null, label: 'Open Interest', align: 'right' }] : []),
    { field: null, label: 'Mark Price', align: 'right' },
  ];

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map(({ field, label, align }) => (
                <th
                  key={label}
                  scope="col"
                  className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 ${
                    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                  } ${field ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                  onClick={field ? () => onSort(field) : undefined}
                  onKeyDown={field ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(field); } } : undefined}
                  tabIndex={field ? 0 : undefined}
                  role={field ? 'button' : undefined}
                  aria-sort={field && sortField === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                    {label}
                    {field && <SortIcon field={field} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((fr, index) => {
              const periodsPerDay = fr.fundingInterval === '1h' ? 24 : fr.fundingInterval === '4h' ? 6 : 3;
              const annualized = fr.fundingRate * periodsPerDay * 365;
              const hasMarkPrice = isValidNumber(fr.markPrice) && fr.markPrice > 0;
              const pairKey = `${fr.symbol}|${fr.exchange}`;
              const accumulated = hasAccumulated ? accumulatedMap.get(pairKey) : undefined;
              return (
                <tr
                  key={`${fr.symbol}-${fr.exchange}-${index}`}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-2">
                    <Link href={`/funding/${fr.symbol}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <TokenIconSimple symbol={fr.symbol} size={20} />
                      <span className="text-white font-medium text-sm hover:text-hub-yellow transition-colors">{fr.symbol}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <ExchangeLogo exchange={fr.exchange.toLowerCase()} size={16} />
                      <span className={`text-xs font-medium ${getExchangeColor(fr.exchange)}`}>
                        {fr.exchange}
                      </span>
                      {isExchangeDex(fr.exchange) && (
                        <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
                      fr.fundingInterval === '1h'
                        ? 'bg-amber-500/15 text-amber-400'
                        : fr.fundingInterval === '4h'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-white/[0.04] text-neutral-500'
                    }`} title={`Funding fee settled every ${fr.fundingInterval === '1h' ? '1 hour' : fr.fundingInterval === '4h' ? '4 hours' : '8 hours'}`}>
                      {fr.fundingInterval === '1h' ? '1H' : fr.fundingInterval === '4h' ? '4H' : '8H'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-mono font-semibold text-sm ${getRateColor(fr.fundingRate)}`}>
                      {formatRate(fr.fundingRate)}
                    </span>
                  </td>
                  {hasPredicted && (
                    <td className="px-4 py-2 text-right">
                      {fr.predictedRate !== undefined && fr.predictedRate !== null ? (
                        <span className={`font-mono text-xs ${getRateColor(fr.predictedRate)}`}>
                          {formatRate(fr.predictedRate)}
                        </span>
                      ) : (
                        <span className="text-neutral-700 text-xs">&mdash;</span>
                      )}
                    </td>
                  )}
                  {hasHistory && (
                    <td className="px-4 py-2 text-center">
                      <FundingSparkline
                        history={historyMap.get(pairKey) || []}
                        width={72}
                        height={22}
                      />
                    </td>
                  )}
                  {hasAccumulated && (
                    <>
                      <td className="px-4 py-2 text-right">
                        {accumulated && accumulated.d1 !== 0 ? (
                          <span className={`font-mono text-xs ${getRateColor(accumulated.d1)}`}>
                            {accumulated.d1 >= 0 ? '+' : ''}{accumulated.d1.toFixed(4)}%
                          </span>
                        ) : (
                          <span className="text-neutral-700 text-xs">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {accumulated && accumulated.d7 !== 0 ? (
                          <span className={`font-mono text-xs ${getRateColor(accumulated.d7)}`}>
                            {accumulated.d7 >= 0 ? '+' : ''}{accumulated.d7.toFixed(4)}%
                          </span>
                        ) : (
                          <span className="text-neutral-700 text-xs">&mdash;</span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2 text-right">
                    <span className={`font-mono text-xs ${getRateColor(annualized)}`}>
                      {annualized >= 0 ? '+' : ''}{annualized.toFixed(2)}%
                    </span>
                  </td>
                  {hasOI && (
                    <td className="px-4 py-2 text-right">
                      {(() => {
                        const oiVal = oiMap.get(pairKey);
                        return oiVal ? (
                          <span className="text-neutral-400 font-mono text-xs">{formatOI(oiVal)}</span>
                        ) : (
                          <span className="text-neutral-700 text-xs">-</span>
                        );
                      })()}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right">
                    <span className="text-neutral-400 font-mono text-xs">
                      {hasMarkPrice
                        ? `$${fr.markPrice!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                        : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Funding interval legend */}
      <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-4 text-xs">
        <span className="text-neutral-400 font-medium">Payout interval:</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/[0.04] text-neutral-500">8H</span>
          <span className="text-neutral-300">Standard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">1H</span>
          <span className="text-neutral-300">Hourly payout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400">4H</span>
          <span className="text-neutral-300">4-hour payout</span>
        </div>
      </div>

      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={data.length}
        rowsPerPage={ROWS_PER_PAGE}
        onPageChange={setCurrentPage}
        label="results"
      />

      {data.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-neutral-500 text-sm">No results match your filters</p>
          <p className="text-neutral-600 text-xs mt-1">Try adjusting your search, category, or exchange filters</p>
        </div>
      )}
    </div>
  );
}
