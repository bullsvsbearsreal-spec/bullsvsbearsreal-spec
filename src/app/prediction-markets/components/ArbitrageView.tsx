'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import Pagination from '@/app/funding/components/Pagination';
import type { PredictionArbitrage, PredictionPlatform } from '@/lib/api/prediction-markets/types';

interface ArbitrageViewProps {
  arbitrage: PredictionArbitrage[];
  searchTerm: string;
  categoryFilter: string;
}

type SortKey = 'spread' | 'question' | 'category' | 'priceA' | 'priceB';

const ROWS_PER_PAGE = 30;

const PLATFORM_LABELS: Record<PredictionPlatform, string> = {
  polymarket: 'Polymarket',
  kalshi: 'Kalshi',
  manifold: 'Manifold',
  metaculus: 'Metaculus',
};

const PLATFORM_COLORS: Record<PredictionPlatform, string> = {
  polymarket: 'text-purple-400',
  kalshi: 'text-blue-400',
  manifold: 'text-green-400',
  metaculus: 'text-orange-400',
};

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function vol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  if (v === 0) return '-';
  return `$${v.toFixed(0)}`;
}

export default function ArbitrageView({ arbitrage, searchTerm, categoryFilter }: ArbitrageViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spread');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    let data = arbitrage;
    if (categoryFilter !== 'all') {
      data = data.filter(a => a.category.toLowerCase() === categoryFilter.toLowerCase());
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(a => a.question.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
    }
    return data;
  }, [arbitrage, searchTerm, categoryFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'spread': cmp = a.spreadPercent - b.spreadPercent; break;
        case 'question': cmp = a.question.localeCompare(b.question); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'priceA': cmp = a.platformA.yesPrice - b.platformA.yesPrice; break;
        case 'priceB': cmp = a.platformB.yesPrice - b.platformB.yesPrice; break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageData = sorted.slice(startIdx, startIdx + ROWS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-hub-yellow" /> : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  };

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-white font-semibold text-sm">Arbitrage Opportunities</h3>
        <p className="text-neutral-600 text-xs">
          Same events priced differently across platforms
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-8">#</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white min-w-[200px]" onClick={() => handleSort('question')}>
                <div className="flex items-center gap-1">Event <SortIcon k="question" /></div>
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('category')}>
                <div className="flex items-center gap-1">Category <SortIcon k="category" /></div>
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Platforms</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('priceA')}>
                <div className="flex items-center gap-1 justify-end">Price A <SortIcon k="priceA" /></div>
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('priceB')}>
                <div className="flex items-center gap-1 justify-end">Price B <SortIcon k="priceB" /></div>
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-white" onClick={() => handleSort('spread')}>
                <div className="flex items-center gap-1 justify-end">Spread <SortIcon k="spread" /></div>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Match</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((item, index) => {
              const isExpanded = expandedRow === item.id;
              const labelA = PLATFORM_LABELS[item.platformA.platform];
              const labelB = PLATFORM_LABELS[item.platformB.platform];
              const colorA = PLATFORM_COLORS[item.platformA.platform];
              const colorB = PLATFORM_COLORS[item.platformB.platform];
              const cheaper = item.platformA.yesPrice < item.platformB.yesPrice ? labelA : labelB;

              return (
                <>
                  <tr
                    key={item.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                  >
                    <td className="px-3 py-2 text-neutral-600 text-xs font-mono">
                      <div className="flex items-center gap-1">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {startIdx + index + 1}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-white text-sm leading-tight line-clamp-2">{item.question}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-neutral-400">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 text-[10px]">
                        <span className={colorA}>{labelA}</span>
                        <span className="text-neutral-600">vs</span>
                        <span className={colorB}>{labelB}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`font-mono text-sm font-semibold ${item.platformA.yesPrice < item.platformB.yesPrice ? 'text-green-400' : 'text-white'}`}>
                          {pct(item.platformA.yesPrice)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`font-mono text-sm font-semibold ${item.platformB.yesPrice < item.platformA.yesPrice ? 'text-green-400' : 'text-white'}`}>
                          {pct(item.platformB.yesPrice)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono text-sm font-bold ${item.spreadPercent >= 5 ? 'text-hub-yellow' : item.spreadPercent >= 2 ? 'text-green-400' : 'text-neutral-400'}`}>
                        {item.spreadPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${
                        item.matchType === 'curated'
                          ? 'bg-hub-yellow/20 text-hub-yellow'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {item.matchType === 'curated' ? 'CURATED' : 'AUTO'}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${item.id}-detail`} className="bg-white/[0.01]">
                      <td colSpan={8} className="px-6 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <PlatformDetail market={item.platformA} url={item.urlA} />
                          <PlatformDetail market={item.platformB} url={item.urlB} />
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500">Strategy:</span>
                          <span className="text-[11px] text-green-400 font-medium">
                            Buy YES on {cheaper} ({pct(Math.min(item.platformA.yesPrice, item.platformB.yesPrice))})
                          </span>
                        </div>

                        <div className="mt-2">
                          <p className="text-[11px] text-neutral-600 leading-relaxed">
                            <span className={`font-medium ${colorA}`}>{labelA}:</span> {item.platformA.question}
                          </p>
                          <p className="text-[11px] text-neutral-600 leading-relaxed">
                            <span className={`font-medium ${colorB}`}>{labelB}:</span> {item.platformB.question}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center text-neutral-600 text-sm">
          No arbitrage opportunities found{searchTerm ? ` for "${searchTerm}"` : ''}.
        </div>
      )}

      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={sorted.length}
        rowsPerPage={ROWS_PER_PAGE}
        onPageChange={setCurrentPage}
        label="opportunities"
      />
    </div>
  );
}

function PlatformDetail({ market, url }: { market: PredictionArbitrage['platformA']; url: string }) {
  const label = PLATFORM_LABELS[market.platform];
  const color = PLATFORM_COLORS[market.platform];

  return (
    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold ${color}`}>{label}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-hub-yellow text-[10px] flex items-center gap-1 hover:underline"
          onClick={e => e.stopPropagation()}
        >
          Open <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-500">YES</span>
          <span className="text-white font-mono">{pct(market.yesPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">NO</span>
          <span className="text-white font-mono">{pct(market.noPrice)}</span>
        </div>
        {market.volume24h > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-500">24h Volume</span>
            <span className="text-neutral-300 font-mono">{vol(market.volume24h)}</span>
          </div>
        )}
        {market.totalVolume > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-500">Total Volume</span>
            <span className="text-neutral-300 font-mono">{vol(market.totalVolume)}</span>
          </div>
        )}
        {market.liquidity > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-500">Liquidity</span>
            <span className="text-neutral-300 font-mono">{vol(market.liquidity)}</span>
          </div>
        )}
        {market.openInterest > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-500">Open Interest</span>
            <span className="text-neutral-300 font-mono">{vol(market.openInterest)}</span>
          </div>
        )}
        {market.forecasters != null && market.forecasters > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-500">Forecasters</span>
            <span className="text-neutral-300 font-mono">{market.forecasters.toLocaleString()}</span>
          </div>
        )}
        {market.endDate && (
          <div className="flex justify-between">
            <span className="text-neutral-500">Expires</span>
            <span className="text-neutral-300">{new Date(market.endDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
