import Link from 'next/link';
import { FundingRateData } from '@/lib/api/types';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatRate, getRateColor, getExchangeColor } from '../utils';
import { isValidNumber } from '@/lib/utils/format';
import { isExchangeDex } from '@/lib/constants';
import FundingSparkline from './FundingSparkline';
import type { HistoryPoint } from '@/lib/storage/fundingHistory';

type SortField = 'symbol' | 'fundingRate' | 'exchange' | 'predictedRate';
type SortOrder = 'asc' | 'desc';

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
  const hasOI = oiMap && oiMap.size > 0;
  const hasHistory = historyMap && historyMap.size > 0;
  const hasAccumulated = accumulatedMap && accumulatedMap.size > 0;
  const visibleData = data.slice(0, 100);
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
    { field: 'fundingRate', label: 'Funding Rate', align: 'right' },
    ...(hasPredicted ? [{ field: 'predictedRate' as SortField, label: 'Predicted', align: 'right' }] : []),
    ...(hasHistory ? [{ field: null as SortField | null, label: '7d', align: 'center' }] : []),
    ...(hasAccumulated ? [
      { field: null as SortField | null, label: 'Acc 1D', align: 'right' },
      { field: null as SortField | null, label: 'Acc 7D', align: 'right' },
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
                  className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 ${
                    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                  } ${field ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                  onClick={field ? () => onSort(field) : undefined}
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
              const annualized = fr.fundingRate * 3 * 365;
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
      {data.length > 100 && (
        <div className="px-4 py-2 border-t border-white/[0.06] text-center">
          <span className="text-neutral-600 text-xs">Showing 100 of {data.length} results</span>
        </div>
      )}
    </div>
  );
}
