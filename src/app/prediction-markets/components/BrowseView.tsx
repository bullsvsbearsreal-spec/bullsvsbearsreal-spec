'use client';

import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Pagination from '@/app/funding/components/Pagination';
import type { PredictionMarket, PredictionPlatform } from '@/lib/api/prediction-markets/types';

interface BrowseViewProps {
  markets: Record<PredictionPlatform, PredictionMarket[]>;
  searchTerm: string;
  categoryFilter: string;
}

const ROWS_PER_PAGE = 20;

const PLATFORM_CONFIG: { key: PredictionPlatform; label: string; color: string; dotColor: string }[] = [
  { key: 'polymarket', label: 'Polymarket', color: 'text-purple-400', dotColor: 'bg-purple-400' },
  { key: 'kalshi', label: 'Kalshi', color: 'text-blue-400', dotColor: 'bg-blue-400' },
  { key: 'manifold', label: 'Manifold', color: 'text-green-400', dotColor: 'bg-green-400' },
  { key: 'metaculus', label: 'Metaculus', color: 'text-orange-400', dotColor: 'bg-orange-400' },
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
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
      <div
        className="bg-green-500/60 rounded-l-full"
        style={{ width: `${yesPct}%` }}
      />
      <div
        className="bg-red-500/40 rounded-r-full"
        style={{ width: `${100 - yesPct}%` }}
      />
    </div>
  );
}

function MarketColumn({ title, markets, color, dotColor }: { title: string; markets: PredictionMarket[]; color: string; dotColor: string }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(markets.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageData = markets.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            <h3 className={`font-semibold text-sm ${color}`}>{title}</h3>
          </div>
          <p className="text-neutral-600 text-xs ml-4">{markets.length} active markets</p>
        </div>
      </div>

      <div className="divide-y divide-white/[0.03]">
        {pageData.map(m => (
          <div key={m.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-white text-xs leading-tight line-clamp-2 flex-1">{m.question}</p>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-hub-yellow transition-colors flex-shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <PriceBar yes={m.yesPrice} />

            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-3 text-[10px]">
                <span>
                  <span className="text-green-400 font-mono font-semibold">{pct(m.yesPrice)}</span>
                  <span className="text-neutral-600 ml-0.5">YES</span>
                </span>
                <span>
                  <span className="text-red-400 font-mono font-semibold">{pct(m.noPrice)}</span>
                  <span className="text-neutral-600 ml-0.5">NO</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                {m.volume24h > 0 && (
                  <span>Vol: <span className="text-neutral-400 font-mono">{vol(m.volume24h)}</span></span>
                )}
                {m.forecasters != null && m.forecasters > 0 && (
                  <span><span className="text-neutral-400 font-mono">{m.forecasters.toLocaleString()}</span> forecasters</span>
                )}
                {m.endDate && (
                  <span>{new Date(m.endDate).toLocaleDateString()}</span>
                )}
              </div>
            </div>

            <div className="mt-1">
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] text-neutral-500">
                {m.category}
              </span>
            </div>
          </div>
        ))}
      </div>

      {markets.length === 0 && (
        <div className="p-6 text-center text-neutral-600 text-xs">No markets found.</div>
      )}

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        totalItems={markets.length}
        rowsPerPage={ROWS_PER_PAGE}
        onPageChange={setPage}
        label="markets"
      />
    </div>
  );
}

export default function BrowseView({ markets, searchTerm, categoryFilter }: BrowseViewProps) {
  const filtered = useMemo(() => {
    const result: { key: PredictionPlatform; label: string; color: string; dotColor: string; markets: PredictionMarket[] }[] = [];
    for (const cfg of PLATFORM_CONFIG) {
      const list = markets[cfg.key] || [];
      const f = filterMarkets(list, searchTerm, categoryFilter);
      if (list.length > 0) {
        result.push({ ...cfg, markets: f });
      }
    }
    return result;
  }, [markets, searchTerm, categoryFilter]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {filtered.map(p => (
        <MarketColumn key={p.key} title={p.label} markets={p.markets} color={p.color} dotColor={p.dotColor} />
      ))}
    </div>
  );
}
