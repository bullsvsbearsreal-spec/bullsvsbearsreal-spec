'use client';

import { useState, useMemo } from 'react';
import {
  ExternalLink, GitCompareArrows, Star,
  Clock, DollarSign, Zap, Droplets, AlertTriangle,
  ShieldCheck, ShieldAlert, Filter,
} from 'lucide-react';
import Pagination from '@/app/funding/components/Pagination';
import type { PredictionArbitrage, PredictionMarket, PredictionPlatform } from '@/lib/api/prediction-markets/types';

interface ArbitrageViewProps {
  arbitrage: PredictionArbitrage[];
  searchTerm: string;
  categoryFilter: string;
}

type SortKey = 'spread' | 'volume' | 'quality';

const ROWS_PER_PAGE = 20;

const PLATFORM_STYLE: Record<PredictionPlatform, { dot: string; text: string; bg: string; label: string }> = {
  polymarket: { dot: 'bg-purple-400', text: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Polymarket' },
  kalshi: { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Kalshi' },
};

// ─── Liquidity quality scoring ────────────────────────────────
// Uses available signals: liquidity, volume24h, OI, totalVolume
// Returns 0-100 score + label

interface QualityScore {
  score: number;       // 0-100
  label: string;       // 'High' | 'Medium' | 'Low' | 'Very Low'
  color: string;       // tailwind text color
  bgColor: string;     // tailwind bg color
  icon: typeof ShieldCheck;
  executable: boolean;  // likely executable at reasonable size
  warning?: string;     // optional warning message
}

function depthSignal(market: PredictionMarket): number {
  // Combine available signals into a 0-1 depth score
  // Each platform reports different fields, so we use what's available
  let score = 0;
  let signals = 0;

  // Liquidity (Polymarket reports this)
  if (market.liquidity > 0) {
    signals++;
    if (market.liquidity >= 100000) score += 1;
    else if (market.liquidity >= 10000) score += 0.7;
    else if (market.liquidity >= 1000) score += 0.3;
    else score += 0.1;
  }

  // 24h volume
  if (market.volume24h > 0) {
    signals++;
    if (market.volume24h >= 100000) score += 1;
    else if (market.volume24h >= 10000) score += 0.7;
    else if (market.volume24h >= 1000) score += 0.3;
    else score += 0.1;
  }

  // Open interest (Kalshi reports this)
  if (market.openInterest > 0) {
    signals++;
    if (market.openInterest >= 100000) score += 1;
    else if (market.openInterest >= 10000) score += 0.7;
    else if (market.openInterest >= 1000) score += 0.3;
    else score += 0.1;
  }

  // Total volume (historical depth indicator)
  if (market.totalVolume > 0) {
    signals++;
    if (market.totalVolume >= 1000000) score += 1;
    else if (market.totalVolume >= 100000) score += 0.7;
    else if (market.totalVolume >= 10000) score += 0.3;
    else score += 0.1;
  }

  return signals > 0 ? score / signals : 0;
}

function computeQuality(item: PredictionArbitrage): QualityScore {
  const depthA = depthSignal(item.platformA);
  const depthB = depthSignal(item.platformB);
  // Use the WEAKER side — arb is only as good as the thinnest book
  const minDepth = Math.min(depthA, depthB);
  const avgDepth = (depthA + depthB) / 2;

  // Score 0-100, weighted toward the weaker side
  const raw = (minDepth * 0.7 + avgDepth * 0.3) * 100;
  const score = Math.round(Math.min(100, raw));

  // Check for specific warnings
  const bothNoLiq = item.platformA.liquidity === 0 && item.platformB.liquidity === 0;
  const oneNoVol = item.platformA.volume24h === 0 || item.platformB.volume24h === 0;

  let warning: string | undefined;
  if (bothNoLiq && score < 30) warning = 'No liquidity data on one or both sides';
  else if (oneNoVol && score < 40) warning = 'No 24h volume on one side';

  if (score >= 60) {
    return { score, label: 'High', color: 'text-green-400', bgColor: 'bg-green-500/10', icon: ShieldCheck, executable: true, warning };
  }
  if (score >= 35) {
    return { score, label: 'Medium', color: 'text-hub-yellow', bgColor: 'bg-hub-yellow/10', icon: ShieldCheck, executable: true, warning };
  }
  if (score >= 15) {
    return { score, label: 'Low', color: 'text-orange-400', bgColor: 'bg-orange-500/10', icon: ShieldAlert, executable: false, warning };
  }
  return { score, label: 'Very Low', color: 'text-red-400', bgColor: 'bg-red-500/10', icon: AlertTriangle, executable: false, warning: warning || 'Likely not executable at meaningful size' };
}

// ─── Helpers ──────────────────────────────────────────────────

function cents(v: number): string {
  const c = Math.round(v * 100);
  if (c >= 100) return '$1';
  return `${c}¢`;
}

function profitPerThousand(spreadPct: number): string {
  return `$${((spreadPct / 100) * 1000).toFixed(0)}`;
}

function overround(yes: number, no: number): number {
  return (yes + no) * 100;
}

function consensus(a: number, b: number): number {
  return ((a + b) / 2) * 100;
}

function formatVolume(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  if (v === 0) return '-';
  return `$${v.toFixed(0)}`;
}

function formatEndDate(d: string): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    const diff = date.getTime() - Date.now();
    if (diff < 0) return 'Expired';
    if (diff < 86400000) return '<1d left';
    if (diff < 604800000) return `${Math.ceil(diff / 86400000)}d left`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return null; }
}

// ─── Sub-components ───────────────────────────────────────────

function PlatformRow({ market }: { market: PredictionMarket }) {
  const style = PLATFORM_STYLE[market.platform];
  const liq = market.liquidity;
  const vol = market.volume24h;
  const oi = market.openInterest;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      <span className={`text-[10px] font-semibold flex-shrink-0 w-[72px] ${style.text}`}>
        {style.label}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[10px] font-mono font-bold text-green-400 bg-green-500/8 px-1.5 py-0.5 rounded">
          Y {cents(market.yesPrice)}
        </span>
        <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/8 px-1.5 py-0.5 rounded">
          N {cents(market.noPrice)}
        </span>
      </div>
      {/* Depth indicators inline */}
      <div className="flex items-center gap-2 ml-auto text-[9px] text-neutral-600">
        {liq > 0 && <span>Liq {formatVolume(liq)}</span>}
        {vol > 0 && <span>Vol {formatVolume(vol)}</span>}
        {oi > 0 && <span>OI {formatVolume(oi)}</span>}
      </div>
      <a
        href={market.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-neutral-600 hover:text-hub-yellow transition-colors flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function SpreadBar({ spread }: { spread: number }) {
  const width = Math.min(spread * 5, 100);
  const color = spread >= 5 ? 'bg-hub-yellow' : spread >= 2 ? 'bg-green-400' : spread >= 1 ? 'bg-emerald-400' : 'bg-neutral-600';
  return (
    <div className="h-1 w-full rounded-full bg-white/[0.04] overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${width}%` }} />
    </div>
  );
}

function QualityBadge({ quality }: { quality: QualityScore }) {
  const Icon = quality.icon;
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${quality.bgColor} ${quality.color}`}
      title={quality.warning || `Execution quality: ${quality.label} (${quality.score}/100)`}
    >
      <Icon className="w-2.5 h-2.5" />
      {quality.label}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function ArbitrageView({ arbitrage, searchTerm, categoryFilter }: ArbitrageViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spread');
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('pm-favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [hideIlliquid, setHideIlliquid] = useState(false);
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem('pm-favorites', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  // Pre-compute quality scores
  const withQuality = useMemo(() => {
    return arbitrage.map(a => ({ ...a, quality: computeQuality(a) }));
  }, [arbitrage]);

  const filtered = useMemo(() => {
    let data = withQuality;
    if (categoryFilter !== 'all') {
      data = data.filter(a => a.category.toLowerCase() === categoryFilter.toLowerCase());
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(a => a.question.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
    }
    if (hideIlliquid) {
      data = data.filter(a => a.quality.executable);
    }
    if (showFavsOnly && favorites.size > 0) {
      data = data.filter(a => favorites.has(a.id));
    }
    return data;
  }, [withQuality, searchTerm, categoryFilter, hideIlliquid, showFavsOnly, favorites]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      if (sortKey === 'volume') {
        const volA = (a.platformA.volume24h || 0) + (a.platformB.volume24h || 0);
        const volB = (b.platformA.volume24h || 0) + (b.platformB.volume24h || 0);
        return volB - volA;
      }
      if (sortKey === 'quality') {
        // Sort by quality score descending, then spread
        if (a.quality.score !== b.quality.score) return b.quality.score - a.quality.score;
        return b.spreadPercent - a.spreadPercent;
      }
      return b.spreadPercent - a.spreadPercent;
    });
  }, [filtered, favorites, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pageData = sorted.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Stats for header
  const executableCount = withQuality.filter(a => a.quality.executable).length;
  const illiquidCount = withQuality.length - executableCount;
  const top5Profit = sorted.slice(0, 5).reduce((s, a) => s + a.spreadPercent * 10, 0); // $ profit on $1K each

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-purple-500/20">
            <GitCompareArrows className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Arbitrage Opportunities</h3>
            <p className="text-neutral-600 text-[10px]">
              {executableCount} executable · {illiquidCount} low liquidity
              {top5Profit > 0 && <> · Top 5: <span className="text-hub-yellow font-mono">${top5Profit.toFixed(0)}</span> on $5K</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Favorites filter */}
          {favorites.size > 0 && (
            <button
              onClick={() => setShowFavsOnly(p => !p)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                showFavsOnly
                  ? 'bg-hub-yellow/20 text-hub-yellow ring-1 ring-hub-yellow/30'
                  : 'text-neutral-600 hover:text-neutral-400 bg-white/[0.04]'
              }`}
              title="Show only favorited opportunities"
            >
              <Star className="w-2.5 h-2.5" fill={showFavsOnly ? 'currentColor' : 'none'} />
              {favorites.size}
            </button>
          )}
          {/* Liquidity filter */}
          <button
            onClick={() => setHideIlliquid(p => !p)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
              hideIlliquid
                ? 'bg-hub-yellow/20 text-hub-yellow ring-1 ring-hub-yellow/30'
                : 'text-neutral-600 hover:text-neutral-400 bg-white/[0.04]'
            }`}
            title="Hide opportunities with low execution quality"
          >
            <Droplets className="w-2.5 h-2.5" />
            Liquid Only
          </button>
          {/* Sort buttons */}
          {(['spread', 'quality', 'volume'] as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                sortKey === k
                  ? 'bg-white/[0.08] text-white'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {k === 'spread' ? 'Spread' : k === 'quality' ? 'Quality' : 'Volume'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {pageData.map((item, index) => {
          const rank = startIdx + index + 1;
          const isFav = favorites.has(item.id);
          const profit = profitPerThousand(item.spreadPercent);
          const quality = item.quality;

          const spreadColor = item.spreadPercent >= 5 ? 'text-hub-yellow'
            : item.spreadPercent >= 2 ? 'text-green-400'
            : item.spreadPercent >= 1 ? 'text-emerald-400'
            : 'text-neutral-400';

          const spreadGlow = item.spreadPercent >= 5
            ? { textShadow: '0 0 8px rgba(255, 165, 0, 0.4)' }
            : item.spreadPercent >= 2
            ? { textShadow: '0 0 6px rgba(34, 197, 94, 0.3)' }
            : undefined;

          const endDate = formatEndDate(item.platformA.endDate) || formatEndDate(item.platformB.endDate);
          const isExpiring = endDate?.includes('left') && (endDate.includes('<1d') || endDate.includes('1d') || endDate.includes('2d'));
          const cons = consensus(item.platformA.yesPrice, item.platformB.yesPrice);
          const vigA = overround(item.platformA.yesPrice, item.platformA.noPrice);
          const vigB = overround(item.platformB.yesPrice, item.platformB.noPrice);

          return (
            <div
              key={item.id}
              className={`bg-hub-darker border rounded-xl overflow-hidden transition-colors group ${
                quality.executable
                  ? 'border-white/[0.06] hover:border-white/[0.10]'
                  : 'border-white/[0.04] opacity-80'
              }`}
            >
              {/* Top: question + spread */}
              <div className="px-4 pt-3 pb-2 flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                  <button
                    onClick={() => toggleFav(item.id)}
                    className={`transition-colors ${isFav ? 'text-hub-yellow' : 'text-neutral-700 hover:text-neutral-500'}`}
                  >
                    <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                  <span className="text-neutral-600 text-[10px] font-mono font-bold">#{rank}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-medium leading-snug line-clamp-2">{item.question}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] text-neutral-500 font-medium">
                      {item.category}
                    </span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                      item.matchType === 'curated'
                        ? 'bg-hub-yellow/15 text-hub-yellow'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {item.matchType === 'curated' ? 'CURATED' : 'AUTO'}
                    </span>
                    <QualityBadge quality={quality} />
                    {endDate && (
                      <span className={`flex items-center gap-0.5 text-[9px] ${isExpiring ? 'text-red-400' : 'text-neutral-600'}`}>
                        <Clock className="w-2.5 h-2.5" />
                        {endDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end flex-shrink-0 pl-3">
                  <span className={`text-xl font-black font-mono tabular-nums ${spreadColor}`} style={spreadGlow}>
                    {item.spreadPercent.toFixed(1)}%
                  </span>
                  <SpreadBar spread={item.spreadPercent} />
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign className="w-2.5 h-2.5 text-neutral-600" />
                    <span className="text-xs font-bold font-mono text-white">{profit}</span>
                    <span className="text-[8px] text-neutral-600">/ 1K</span>
                  </div>
                </div>
              </div>

              {/* Platform comparison with per-row depth data */}
              <div className="px-4 py-2.5 bg-white/[0.01] border-t border-white/[0.04] space-y-1.5">
                <PlatformRow market={item.platformA} />
                <PlatformRow market={item.platformB} />
              </div>

              {/* Bottom: meta + quality warning + direction */}
              <div className="px-4 py-2 border-t border-white/[0.03] flex items-center gap-3 flex-wrap text-[9px]">
                <span className="text-neutral-500">
                  Consensus <span className="text-white font-mono font-semibold">{cons.toFixed(0)}%</span> YES
                </span>

                {(vigA > 101 || vigB > 101) && (
                  <span className="text-neutral-600">
                    Vig: {vigA > 101 && <span>{PLATFORM_STYLE[item.platformA.platform].label} {vigA.toFixed(1)}%</span>}
                    {vigA > 101 && vigB > 101 && ' / '}
                    {vigB > 101 && <span>{PLATFORM_STYLE[item.platformB.platform].label} {vigB.toFixed(1)}%</span>}
                  </span>
                )}

                {/* Quality warning inline */}
                {quality.warning && (
                  <span className={`flex items-center gap-0.5 ${quality.color}`}>
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {quality.warning}
                  </span>
                )}

                <span className="text-hub-yellow font-semibold ml-auto flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" />
                  {item.direction.replace('buy-', 'Buy ').replace('-yes', ' YES').replace('-no', ' NO')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-12 text-center">
          <GitCompareArrows className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
          <p className="text-neutral-500 text-sm">
            {hideIlliquid
              ? 'No liquid arbitrage opportunities found. Try disabling the "Liquid Only" filter.'
              : `No arbitrage opportunities found${searchTerm ? ` for "${searchTerm}"` : ''}.`
            }
          </p>
          <p className="text-neutral-600 text-xs mt-1">
            Cross-platform matches appear when the same event is listed on multiple platforms with different pricing.
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
