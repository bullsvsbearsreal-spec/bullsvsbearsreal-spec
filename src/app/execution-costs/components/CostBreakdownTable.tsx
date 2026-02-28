'use client';
import { useState } from 'react';
import { VenueCost } from '@/lib/execution-costs/types';
import { EXCHANGE_BADGE_COLORS, getExchangeTradeUrl } from '@/lib/constants/exchanges';
import { formatUSD } from '@/lib/utils/format';
import { ArrowUpDown, ExternalLink } from 'lucide-react';

interface Props { venues: VenueCost[]; asset: string; }
type SortKey = 'exchange' | 'fee' | 'spread' | 'priceImpact' | 'totalCost' | 'maxFillableSize';

export default function CostBreakdownTable({ venues, asset }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('totalCost');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...venues].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    const mul = sortAsc ? 1 : -1;
    if (sortKey === 'exchange') return mul * a.exchange.localeCompare(b.exchange);
    return mul * ((a[sortKey] as number) - (b[sortKey] as number));
  });

  const th = (label: string, key: SortKey) => (
    <th key={key} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-neutral-300 select-none" onClick={() => handleSort(key)}>
      <span className="flex items-center gap-1">{label}<ArrowUpDown className="w-3 h-3" /></span>
    </th>
  );

  const fmt = (v: number) => v.toFixed(4) + '%';
  const fmtUsd = (v: number) => v === Infinity ? '\u221E' : formatUSD(v, 1);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02]">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-8">#</th>
            {th('Exchange', 'exchange')}
            {th('Fee', 'fee')}
            {th('Spread', 'spread')}
            {th('Impact', 'priceImpact')}
            {th('Total Cost', 'totalCost')}
            {th('Max Fill', 'maxFillableSize')}
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Method</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((v, i) => {
            const badgeColor = EXCHANGE_BADGE_COLORS[v.exchange] || 'bg-neutral-500/20 text-neutral-400';
            const tradeUrl = getExchangeTradeUrl(v.exchange, asset);
            return (
              <tr key={v.exchange} className={`border-t border-white/[0.04] ${!v.available ? 'opacity-40' : 'hover:bg-white/[0.02]'}`}>
                <td className="px-3 py-2 text-neutral-600 font-mono text-xs">{i + 1}</td>
                <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{v.exchange}</span></td>
                <td className="px-3 py-2 text-neutral-300 font-mono text-xs">{v.available ? fmt(v.fee) : '\u2014'}</td>
                <td className="px-3 py-2 text-neutral-300 font-mono text-xs">{v.available ? fmt(v.spread) : '\u2014'}</td>
                <td className="px-3 py-2 text-neutral-300 font-mono text-xs">{v.available ? fmt(v.priceImpact) : '\u2014'}</td>
                <td className="px-3 py-2 font-mono text-xs font-semibold text-white">{v.available ? fmt(v.totalCost) : '\u2014'}</td>
                <td className="px-3 py-2 text-neutral-400 font-mono text-xs">{v.available ? fmtUsd(v.maxFillableSize) : '\u2014'}</td>
                <td className="px-3 py-2 text-neutral-600 text-[10px] uppercase">{v.method.replace('_', ' ')}</td>
                <td className="px-3 py-2">{tradeUrl && v.available && <a href={tradeUrl} target="_blank" rel="noopener noreferrer" className="text-hub-yellow/60 hover:text-hub-yellow"><ExternalLink className="w-3.5 h-3.5" /></a>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
