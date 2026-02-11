import { FundingRateData } from '@/lib/api/types';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatRate, getRateColor, getExchangeColor } from '../utils';
import { isValidNumber } from '@/lib/utils/format';

type SortField = 'symbol' | 'fundingRate' | 'exchange' | 'predictedRate';
type SortOrder = 'asc' | 'desc';

interface FundingTableViewProps {
  data: FundingRateData[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

export default function FundingTableView({ data, sortField, sortOrder, onSort }: FundingTableViewProps) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-hub-yellow" />
      : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {[
                { field: 'symbol' as SortField, label: 'Symbol', align: 'left' },
                { field: 'exchange' as SortField, label: 'Exchange', align: 'left' },
                { field: 'fundingRate' as SortField, label: 'Funding Rate', align: 'right' },
                { field: null, label: 'Annualized', align: 'right' },
                { field: null, label: 'Mark Price', align: 'right' },
              ].map(({ field, label, align }) => (
                <th
                  key={label}
                  className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 ${
                    align === 'right' ? 'text-right' : 'text-left'
                  } ${field ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                  onClick={field ? () => onSort(field) : undefined}
                >
                  <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
                    {label}
                    {field && <SortIcon field={field} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((fr, index) => {
              const annualized = fr.fundingRate * 3 * 365;
              const hasMarkPrice = isValidNumber(fr.markPrice) && fr.markPrice > 0;
              return (
                <tr
                  key={`${fr.symbol}-${fr.exchange}-${index}`}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <TokenIconSimple symbol={fr.symbol} size={20} />
                      <span className="text-white font-medium text-sm">{fr.symbol}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <ExchangeLogo exchange={fr.exchange.toLowerCase()} size={16} />
                      <span className={`text-xs font-medium ${getExchangeColor(fr.exchange)}`}>
                        {fr.exchange}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-mono font-semibold text-sm ${getRateColor(fr.fundingRate)}`}>
                      {formatRate(fr.fundingRate)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-mono text-xs ${getRateColor(annualized)}`}>
                      {annualized >= 0 ? '+' : ''}{annualized.toFixed(2)}%
                    </span>
                  </td>
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
