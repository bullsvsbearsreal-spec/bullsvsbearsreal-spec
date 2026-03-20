'use client';

import { useState, useMemo } from 'react';
import { ExternalLink, GitCompareArrows, Star, ArrowUpDown, Clock, DollarSign } from 'lucide-react';
import Pagination from '@/app/funding/components/Pagination';
import type { PredictionArbitrage, PredictionPlatform } from '@/lib/api/prediction-markets/types';

interface ArbitrageViewProps {
  arbitrage: PredictionArbitrage[];
  searchTerm: string;
  categoryFilter: string;
}

type SortKey = 'spread' | 'profit';

const ROWS_PER_PAGE = 20;

const PLATFORM_COLORS: Record<PredictionPlatform, { bg: string; text: string; icon: string }> = {
  polymarket: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: '🔵' },
  kalshi: { bg: 'bg-red-500/10', text: 'text-red-400', icon: '🔴' },
};

function cents(v: number): string {
  const c = Math.round(v * 100);
  if (c >= 100) return '$1';
  return `${c}¢`;
}

function profitPerThousand(spreadPct: number): string {
  const profit = (spreadPct / 100) * 1000;
  return `$${profit.toFixed(2)}`;
}

function formatVolume(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatEndDate(d: string): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    const now = Date.now();
    const diff = date.getTime() - now;
    if (diff < 0) return 'Expired';
    if (diff < 86400000) return '<1d left';
    if (diff < 604800000) return `${Math.ceil(diff / 86400000)}d left`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return null; }
}

export default function ArbitrageView({ arbitrage, searchTerm, categoryFilter }: ArbitrageViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spread');
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
      // Favorites first
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return b.spreadPercent - a.spreadPercent;
    });
  }, [filtered, favorites, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageData = sorted.slice(startIdx, startIdx + ROWS_PER_PAGE);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <GitCompareArrows className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Arbitrage Opportunities</h3>
            <p className="text-neutral-600 text-xs">Same events priced differently across platforms</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-600">
          <span>Profit based on $1,000 position</span>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {pageData.map((item, index) => {
          const rank = startIdx + index + 1;
          const isFav = favorites.has(item.id);
          const colA = PLATFORM_COLORS[item.platformA.platform];
          const colB = PLATFORM_COLORS[item.platformB.platform];
          const profit = profitPerThousand(item.spreadPercent);

          const spreadColor = item.spreadPercent >= 5 ? 'text-hub-yellow'
            : item.spreadPercent >= 2 ? 'text-green-400'
            : item.spreadPercent >= 1 ? 'text-emerald-400'
            : 'text-neutral-400';

          const spreadGlow = item.spreadPercent >= 5
            ? { textShadow: '0 0 8px rgba(255, 165, 0, 0.4)' }
            : item.spreadPercent >= 2
            ? { textShadow: '0 0 6px rgba(34, 197, 94, 0.3)' }
            : undefined;

          return (
            <div
              key={item.id}
              className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-stretch">
                {/* Left: Rank + Star */}
                <div className="flex flex-col items-center justify-center w-14 flex-shrink-0 border-r border-white/[0.04] py-2">
                  <button
                    onClick={() => toggleFav(item.id)}
                    className={`mb-1 transition-colors ${isFav ? 'text-hub-yellow' : 'text-neutral-700 hover:text-neutral-500'}`}
                  >
                    <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                  <span className="text-neutral-600 text-[10px] font-mono font-bold">#{rank}</span>
                  <span className={`text-[8px] font-bold mt-0.5 px-1.5 rounded ${
                    item.matchType === 'curated'
                      ? 'bg-hub-yellow/15 text-hub-yellow'
                      : 'bg-blue-500/15 text-blue-400'
                  }`}>
                    {item.matchType === 'curated' ? 'C' : 'A'}
                  </span>
                </div>

                {/* Middle: Platform rows */}
                <div className="flex-1 min-w-0 py-2 px-3">
                  {/* Platform A row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] flex-shrink-0 ${colA.bg}`}>
                      {colA.icon}
                    </span>
                    <a
                      href={item.urlA}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-[12px] font-medium truncate hover:text-hub-yellow transition-colors flex items-center gap-1 min-w-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="truncate">{item.platformA.question}</span>
                      <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 text-neutral-600" />
                    </a>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                      <span className="text-[10px] font-mono font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                        Y {cents(item.platformA.yesPrice)}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                        N {cents(item.platformA.noPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Platform B row */}
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] flex-shrink-0 ${colB.bg}`}>
                      {colB.icon}
                    </span>
                    <a
                      href={item.urlB}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-[12px] font-medium truncate hover:text-hub-yellow transition-colors flex items-center gap-1 min-w-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="truncate">{item.platformB.question}</span>
                      <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 text-neutral-600" />
                    </a>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                      <span className="text-[10px] font-mono font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                        Y {cents(item.platformB.yesPrice)}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                        N {cents(item.platformB.noPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Info row: volume + end date + direction */}
                  <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-white/[0.03]">
                    {(item.platformA.volume24h > 0 || item.platformB.volume24h > 0) && (
                      <span className="flex items-center gap-1 text-[9px] text-neutral-600">
                        <DollarSign className="w-2.5 h-2.5" />
                        Vol: {formatVolume(item.platformA.volume24h)} / {formatVolume(item.platformB.volume24h)}
                      </span>
                    )}
                    {(() => {
                      const endA = formatEndDate(item.platformA.endDate);
                      const endB = formatEndDate(item.platformB.endDate);
                      const end = endA || endB;
                      if (!end) return null;
                      const isExpiring = end.includes('left') && (end.includes('<1d') || end.includes('1d') || end.includes('2d'));
                      return (
                        <span className={`flex items-center gap-1 text-[9px] ${isExpiring ? 'text-red-400' : 'text-neutral-600'}`}>
                          <Clock className="w-2.5 h-2.5" />
                          {end}
                        </span>
                      );
                    })()}
                    <span className="text-[9px] text-neutral-600 ml-auto">
                      {item.direction.replace('buy-', 'Buy ').replace('-yes', ' YES').replace('-no', ' NO')}
                    </span>
                  </div>
                </div>

                {/* Right: Spread + Profit */}
                <div className="flex flex-col items-end justify-center w-24 flex-shrink-0 border-l border-white/[0.04] px-3 py-2"
                  style={{ background: item.spreadPercent >= 2 ? 'rgba(34,197,94,0.03)' : undefined }}>
                  <span className={`text-lg font-black font-mono ${spreadColor}`} style={spreadGlow}>
                    {item.spreadPercent.toFixed(2)}%
                  </span>
                  <span className="text-[8px] text-neutral-600 uppercase tracking-wider font-semibold">Spread</span>
                  <span className="text-sm font-bold font-mono text-white mt-1">{profit}</span>
                  <span className="text-[8px] text-neutral-600 uppercase tracking-wider font-semibold">Profit</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-12 text-center">
          <GitCompareArrows className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
          <p className="text-neutral-600 text-sm">
            No arbitrage opportunities found{searchTerm ? ` for "${searchTerm}"` : ''}.
          </p>
          <p className="text-neutral-700 text-xs mt-1">
            Cross-platform matches appear when the same event is listed on both Polymarket and Kalshi with different pricing.
          </p>
        </div>
      )}

      {sorted.length > ROWS_PER_PAGE && (
        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={sorted.length}
          rowsPerPage={ROWS_PER_PAGE}
          onPageChange={setCurrentPage}
          label="opportunities"
        />
      )}
    </div>
  );
}
