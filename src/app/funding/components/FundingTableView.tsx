import { FundingRateData } from '@/lib/api/types';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatRate, getRateColor, getExchangeColor } from '../utils';

type SortField = 'symbol' | 'fundingRate' | 'exchange' | 'predictedRate';
type SortOrder = 'asc' | 'desc';

interface FundingTableViewProps {
  data: FundingRateData[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

export default function FundingTableView({ data, sortField, sortOrder, onSort }: FundingTableViewProps) {
  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hub-gray/30">
              <th
                className="px-6 py-4 text-left text-sm font-semibold text-hub-gray-text cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('symbol')}
                aria-sort={sortField === 'symbol' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Symbol
                  {sortField === 'symbol' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-hub-yellow" /> : <ArrowDown className="w-4 h-4 text-hub-yellow" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                </div>
              </th>
              <th
                className="px-6 py-4 text-left text-sm font-semibold text-hub-gray-text cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('exchange')}
                aria-sort={sortField === 'exchange' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Exchange
                  {sortField === 'exchange' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-hub-yellow" /> : <ArrowDown className="w-4 h-4 text-hub-yellow" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                </div>
              </th>
              <th
                className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text cursor-pointer hover:text-white transition-colors"
                onClick={() => onSort('fundingRate')}
                aria-sort={sortField === 'fundingRate' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2 justify-end">
                  Funding Rate
                  {sortField === 'fundingRate' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-hub-yellow" /> : <ArrowDown className="w-4 h-4 text-hub-yellow" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                </div>
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">
                Annualized
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-hub-gray-text">
                Mark Price
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((fr, index) => {
              const annualized = fr.fundingRate * 3 * 365;
              return (
                <tr
                  key={`${fr.symbol}-${fr.exchange}-${index}`}
                  className="border-b border-hub-gray/20 hover:bg-hub-gray/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <TokenIconSimple symbol={fr.symbol} size={28} />
                      <span className="text-white font-semibold">{fr.symbol}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getExchangeColor(fr.exchange)}`}>
                      {fr.exchange}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono font-semibold ${getRateColor(fr.fundingRate)}`}>
                      {formatRate(fr.fundingRate)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono text-sm ${getRateColor(annualized)}`}>
                      {annualized >= 0 ? '+' : ''}{annualized.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-white font-mono">
                      ${fr.markPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) || '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
