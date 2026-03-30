'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, TrendingUp, Clock, DollarSign } from 'lucide-react';
import Pagination from '@/app/funding/components/Pagination';
import type { PredictionMarket, PredictionPlatform } from '@/lib/api/prediction-markets/types';

interface BrowseViewProps {
  markets: Record<PredictionPlatform, PredictionMarket[]>;
  searchTerm: string;
  categoryFilter: string;
}

const ROWS_PER_PAGE = 20;

const PLATFORM_CONFIG: { key: PredictionPlatform; label: string; color: string; dotColor: string; ringColor: string; desc: string }[] = [
  { key: 'polymarket', label: 'Polymarket', color: 'text-purple-400', dotColor: 'bg-purple-400', ringColor: 'ring-purple-500/20', desc: 'Crypto (USDC on Polygon)' },
  { key: 'kalshi', label: 'Kalshi', color: 'text-blue-400', dotColor: 'bg-blue-400', ringColor: 'ring-blue-500/20', desc: 'USD, US-regulated' },
  { key: 'manifold', label: 'Manifold', color: 'text-green-400', dotColor: 'bg-green-400', ringColor: 'ring-green-500/20', desc: 'Play money (Mana)' },
];

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function vol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  if (v === 0) return '-';
  return `$${v.toFixed(0)}`;
}

function filterMarkets(markets: PredictionMarket[], search: string, category: string): PredictionMarket[] {
  let data = markets;
  if (category !== 'all') {
    data = data.filter(m => m.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(m => m.question.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }
  return data;
}

function PriceBar({ yes }: { yes: number }) {
  const yesPct = Math.round(yes * 100);
  const isHigh = yesPct >= 70;
  const isLow = yesPct <= 30;
  return (
    <div className="relative">
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
        <div
          className={`rounded-l-full transition-all duration-300 ${
            isHigh ? 'bg-green-500/70' : isLow ? 'bg-green-500/40' : 'bg-green-500/60'
          }`}
          style={{ width: `${yesPct}%` }}
        />
        <div
          className={`rounded-r-full transition-all duration-300 ${
            isLow ? 'bg-red-500/60' : isHigh ? 'bg-red-500/30' : 'bg-red-500/40'
          }`}
          style={{ width: `${100 - yesPct}%` }}
        />
      </div>
    </div>
  );
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

function MarketCard({ market }: { market: PredictionMarket }) {
  const yesPct = Math.round(market.yesPrice * 100);
  const vig = (market.yesPrice + market.noPrice) * 100;
  const endDate = formatEndDate(market.endDate);
  const isExpiring = endDate?.includes('left') && (endDate.includes('<1d') || endDate.includes('1d') || endDate.includes('2d'));

  return (
    <div className="px-4 py-3 hover:bg-white/[0.02] transition-colors group">
      {/* Question + link */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white text-xs leading-snug line-clamp-2 flex-1 group-hover:text-hub-yellow/90 transition-colors">
          {market.question}
        </p>
        <a
          href={market.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-700 hover:text-hub-yellow transition-colors flex-shrink-0 mt-0.5"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Price bar */}
      <PriceBar yes={market.yesPrice} />

      {/* Prices */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-green-400 text-xs font-mono font-bold tabular-nums">{yesPct}%</span>
            <span className="text-neutral-600 text-[10px]">YES</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-400 text-xs font-mono font-bold tabular-nums">{100 - yesPct}%</span>
            <span className="text-neutral-600 text-[10px]">NO</span>
          </div>
          {vig > 101 && (
            <span className="text-[9px] text-neutral-700 font-mono" title="Overround — YES + NO exceeds 100%">
              Vig {vig.toFixed(1)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-neutral-600">
          {market.volume24h > 0 && (
            <span className="flex items-center gap-0.5">
              <DollarSign className="w-2.5 h-2.5" />
              {vol(market.volume24h)}
            </span>
          )}
          {endDate && (
            <span className={`flex items-center gap-0.5 ${isExpiring ? 'text-red-400' : ''}`}>
              <Clock className="w-2.5 h-2.5" />
              {endDate}
            </span>
          )}
        </div>
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] text-neutral-500">
          {market.category}
        </span>
        {market.liquidity > 0 && (
          <span className="text-[9px] text-neutral-600">Liq {vol(market.liquidity)}</span>
        )}
        {market.openInterest > 0 && (
          <span className="text-[9px] text-neutral-600">OI {vol(market.openInterest)}</span>
        )}
        {market.totalVolume > 0 && (
          <span className="text-[9px] text-neutral-600 ml-auto">Total {vol(market.totalVolume)}</span>
        )}
      </div>
    </div>
  );
}

function MarketColumn({ config, markets }: { config: typeof PLATFORM_CONFIG[number]; markets: PredictionMarket[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(markets.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageData = markets.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Platform header */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ring-1 ${config.ringColor} bg-white/[0.03]`}>
              <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
            </div>
            <div>
              <h3 className={`font-semibold text-sm ${config.color}`}>{config.label}</h3>
              <p className="text-neutral-600 text-[10px]">{config.desc}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-neutral-600 bg-white/[0.04] px-2 py-0.5 rounded">
            {markets.length} markets
          </span>
        </div>
      </div>

      {/* Market list */}
      <div className="divide-y divide-white/[0.03]">
        {pageData.map(m => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>

      {markets.length === 0 && (
        <div className="p-8 text-center text-neutral-600 text-xs">No markets found.</div>
      )}

      {markets.length > ROWS_PER_PAGE && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={markets.length}
          rowsPerPage={ROWS_PER_PAGE}
          onPageChange={setPage}
          label="markets"
        />
      )}
    </div>
  );
}

export default function BrowseView({ markets, searchTerm, categoryFilter }: BrowseViewProps) {
  const filtered = useMemo(() => {
    const result: { config: typeof PLATFORM_CONFIG[number]; markets: PredictionMarket[] }[] = [];
    for (const cfg of PLATFORM_CONFIG) {
      const list = markets[cfg.key] || [];
      const f = filterMarkets(list, searchTerm, categoryFilter);
      if (list.length > 0) {
        result.push({ config: cfg, markets: f });
      }
    }
    return result;
  }, [markets, searchTerm, categoryFilter]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {filtered.map(p => (
        <MarketColumn key={p.config.key} config={p.config} markets={p.markets} />
      ))}
    </div>
  );
}
