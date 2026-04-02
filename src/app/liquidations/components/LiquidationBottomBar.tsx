'use client';

import { formatLiqValue } from '@/lib/utils/format';

interface LiquidationBottomBarProps {
  stats: { longValue: number; shortValue: number; total: number; count: number };
  exchangeFilter: string;
  onExchangeFilterChange: (f: string) => void;
}

const FILTERS = [
  { key: 'all', label: 'ALL' },
  { key: 'cex', label: 'CEX' },
  { key: 'dex', label: 'DEX' },
] as const;

export default function LiquidationBottomBar({
  stats,
  exchangeFilter,
  onExchangeFilterChange,
}: LiquidationBottomBarProps) {
  const rawLongPct = stats.total > 0 ? (stats.longValue / stats.total) * 100 : 50;
  const longPct = isFinite(rawLongPct) ? rawLongPct : 50;
  const shortPct = 100 - longPct;

  return (
    <div className="px-3 py-2 border-t border-white/[0.06] bg-[#0a0a0a] flex-shrink-0">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Left: Long/Short ratio bar with dollar values */}
        <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="shrink-0 text-right">
            <span className="text-red-400 text-[10px] font-mono font-bold block leading-tight">
              {longPct.toFixed(1)}% <span className="hidden sm:inline">Long</span><span className="sm:hidden">L</span>
            </span>
            {stats.longValue > 0 && (
              <span className="text-red-400/50 text-[9px] font-mono hidden sm:block leading-tight">{formatLiqValue(stats.longValue)}</span>
            )}
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-white/[0.06] flex-1 flex min-w-0" role="meter" aria-label="Long vs Short ratio" aria-valuenow={Math.round(longPct)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="bg-red-500/80 transition-all duration-700 rounded-l-full"
              style={{ width: `${longPct}%` }}
            />
            <div
              className="bg-green-500/80 transition-all duration-700 rounded-r-full"
              style={{ width: `${shortPct}%` }}
            />
          </div>
          <div className="shrink-0">
            <span className="text-green-400 text-[10px] font-mono font-bold block leading-tight">
              {shortPct.toFixed(1)}% <span className="hidden sm:inline">Short</span><span className="sm:hidden">S</span>
            </span>
            {stats.shortValue > 0 && (
              <span className="text-green-400/50 text-[9px] font-mono hidden sm:block leading-tight">{formatLiqValue(stats.shortValue)}</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/[0.06] shrink-0" />

        {/* Right: Exchange filter chips */}
        <div className="flex items-center gap-1 shrink-0" role="tablist" aria-label="Exchange type filter">
          {FILTERS.map((f) => {
            const isActive = exchangeFilter === f.key;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onExchangeFilterChange(f.key)}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-colors ${
                  isActive
                    ? f.key === 'dex'
                      ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30'
                      : 'bg-hub-yellow/20 text-hub-yellow ring-1 ring-hub-yellow/30'
                    : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
