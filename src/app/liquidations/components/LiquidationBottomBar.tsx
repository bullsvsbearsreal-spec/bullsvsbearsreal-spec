'use client';

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
  const longPct = stats.total > 0 ? (stats.longValue / stats.total) * 100 : 50;
  const shortPct = 100 - longPct;

  return (
    <div className="px-3 py-1.5 border-t border-white/[0.06] bg-[#0a0a0a] flex-shrink-0">
      <div className="flex items-center gap-2 sm:gap-4 h-[28px]">
        {/* Left: Long/Short ratio bar */}
        <div className="flex-1 flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <span className="text-red-400 text-[10px] font-mono font-bold whitespace-nowrap shrink-0">
            <span className="hidden sm:inline">{longPct.toFixed(1)}% </span>
            <span className="sm:hidden">{longPct.toFixed(0)}%</span>
            <span className="hidden sm:inline">Long</span>
            <span className="sm:hidden"> L</span>
          </span>
          <div className="h-2 rounded-full overflow-hidden bg-white/[0.06] flex-1 flex min-w-0">
            <div
              className="bg-red-500/80 transition-all duration-700 rounded-l-full"
              style={{ width: `${longPct}%` }}
            />
            <div
              className="bg-green-500/80 transition-all duration-700 rounded-r-full"
              style={{ width: `${shortPct}%` }}
            />
          </div>
          <span className="text-green-400 text-[10px] font-mono font-bold whitespace-nowrap shrink-0">
            <span className="hidden sm:inline">{shortPct.toFixed(1)}% </span>
            <span className="sm:hidden">{shortPct.toFixed(0)}%</span>
            <span className="hidden sm:inline">Short</span>
            <span className="sm:hidden"> S</span>
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-white/[0.06] shrink-0" />

        {/* Right: Exchange filter chips */}
        <div className="flex items-center gap-1 shrink-0">
          {FILTERS.map((f) => {
            const isActive = exchangeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onExchangeFilterChange(f.key)}
                className={`px-1.5 sm:px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
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
