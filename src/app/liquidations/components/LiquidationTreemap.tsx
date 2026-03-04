'use client';

import { Grid3X3 } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { formatLiqValue } from '@/lib/utils/format';

interface TreemapItem {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}

interface LiquidationTreemapProps {
  data: TreemapItem[];
  isLoading: boolean;
  onSymbolClick?: (symbol: string) => void;
}

function getTileColors(item: TreemapItem): string {
  const total = item.longValue + item.shortValue;
  if (total === 0) return 'bg-white/[0.05] text-neutral-400';

  const longRatio = item.longValue / total;
  const shortRatio = item.shortValue / total;

  if (item.longValue > item.shortValue) {
    return longRatio > 0.7
      ? 'bg-red-500/80 text-white'
      : 'bg-red-600/60 text-red-100';
  }

  return shortRatio > 0.7
    ? 'bg-green-500/80 text-white'
    : 'bg-green-600/60 text-green-100';
}

export default function LiquidationTreemap({
  data,
  isLoading,
  onSymbolClick,
}: LiquidationTreemapProps) {
  const topItems = data.slice(0, 3);
  const remainingItems = data.slice(3, 20);

  if (isLoading) {
    return (
      <div className="border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <Grid3X3 className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-medium text-neutral-400">Heatmap</span>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <Grid3X3 className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-medium text-neutral-400">Heatmap</span>
        </div>
        <div className="flex flex-col items-center justify-center h-48">
          <p className="text-xs text-neutral-600">No liquidation data</p>
          <p className="text-[10px] text-neutral-700 mt-1">
            Heatmap will appear when liquidation events are recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
        <Grid3X3 className="w-3.5 h-3.5 text-neutral-500" />
        <span className="text-xs font-medium text-neutral-400">Heatmap</span>
        <span className="ml-auto text-[10px] font-mono text-neutral-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
          {data.length}
        </span>
      </div>

      {/* Body */}
      <div className="p-2">
        {/* Top 3 large tiles */}
        {topItems.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            {topItems.map((item) => {
              const colors = getTileColors(item);
              const total = item.longValue + item.shortValue;
              const longPct = total > 0 ? (item.longValue / total) * 100 : 50;
              const shortPct = total > 0 ? (item.shortValue / total) * 100 : 50;

              return (
                <button
                  key={item.symbol}
                  onClick={() => onSymbolClick?.(item.symbol)}
                  className={`${colors} h-24 rounded-lg p-2.5 flex flex-col justify-between hover:brightness-110 transition-all text-left`}
                >
                  <div className="flex items-center gap-1.5">
                    <TokenIconSimple symbol={item.symbol} size={16} />
                    <span className="text-xs font-semibold truncate">{item.symbol}</span>
                    <span className="text-[9px] opacity-60 ml-auto shrink-0">
                      {item.count}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-mono font-semibold">
                      {formatLiqValue(item.totalValue)}
                    </div>
                    {/* Long/Short ratio bar */}
                    <div className="h-1 rounded-full overflow-hidden bg-black/30 mt-1.5 flex">
                      <div
                        className="bg-red-400 h-full"
                        style={{ width: `${longPct}%` }}
                      />
                      <div
                        className="bg-green-400 h-full"
                        style={{ width: `${shortPct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Remaining items compact grid */}
        {remainingItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
            {remainingItems.map((item) => {
              const colors = getTileColors(item);

              return (
                <button
                  key={item.symbol}
                  onClick={() => onSymbolClick?.(item.symbol)}
                  className={`${colors} h-14 rounded-lg p-2 flex flex-col justify-between hover:brightness-110 transition-all text-left`}
                >
                  <div className="flex items-center gap-1">
                    <TokenIconSimple symbol={item.symbol} size={12} />
                    <span className="text-[10px] font-semibold truncate">{item.symbol}</span>
                    <span className="text-[8px] opacity-60 ml-auto shrink-0">
                      {item.count}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono font-semibold">
                    {formatLiqValue(item.totalValue)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
