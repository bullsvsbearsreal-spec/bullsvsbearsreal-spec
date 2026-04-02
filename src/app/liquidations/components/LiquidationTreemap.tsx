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

/** Returns bg style + text class based on long/short dominance and intensity */
function getTileStyle(item: TreemapItem, maxValue: number): { bg: string; text: string; border: string } {
  const total = item.longValue + item.shortValue;
  if (total === 0) return { bg: 'rgba(255,255,255,0.03)', text: 'text-neutral-500', border: 'border-white/[0.04]' };

  // Intensity 0-1 based on relative size to the max
  const intensity = maxValue > 0 ? Math.min(1, Math.pow(item.totalValue / maxValue, 0.6)) : 0.3;
  const alpha = 0.15 + intensity * 0.55; // 0.15 to 0.7

  if (item.longValue > item.shortValue) {
    return {
      bg: `rgba(239, 68, 68, ${alpha})`,
      text: intensity > 0.4 ? 'text-white' : 'text-red-200',
      border: `border-red-500/${Math.round(10 + intensity * 25)}`,
    };
  }
  return {
    bg: `rgba(34, 197, 94, ${alpha})`,
    text: intensity > 0.4 ? 'text-white' : 'text-green-200',
    border: `border-green-500/${Math.round(10 + intensity * 25)}`,
  };
}

export default function LiquidationTreemap({
  data,
  isLoading,
  onSymbolClick,
}: LiquidationTreemapProps) {
  const topItems = data.slice(0, 3);
  const remainingItems = data.slice(3, 20);
  const maxValue = data.length > 0 ? data[0].totalValue : 0;

  if (isLoading) {
    return (
      <div className="border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
          <Grid3X3 className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-medium text-neutral-400">Liquidation Heatmap</span>
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
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
          <Grid3X3 className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs font-medium text-neutral-400">Liquidation Heatmap</span>
        </div>
        <div className="flex flex-col items-center justify-center h-48 gap-1">
          <Grid3X3 className="w-6 h-6 text-neutral-800" />
          <p className="text-xs text-neutral-600">No liquidation data yet</p>
          <p className="text-[10px] text-neutral-700">
            Waiting for liquidation events from connected exchanges
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
        <Grid3X3 className="w-3.5 h-3.5 text-neutral-500" />
        <span className="text-xs font-medium text-neutral-400">Liquidation Heatmap</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] text-neutral-600">
            <span className="w-2 h-2 rounded-sm bg-red-500/50" /> Long-heavy
          </span>
          <span className="flex items-center gap-1 text-[9px] text-neutral-600">
            <span className="w-2 h-2 rounded-sm bg-green-500/50" /> Short-heavy
          </span>
          <span className="text-[10px] font-mono text-neutral-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
            {data.length}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-2" role="grid" aria-label="Liquidation heatmap tiles">
        {/* Top 3 large tiles */}
        {topItems.length > 0 && (() => {
          const topTotal = topItems.reduce((s, i) => s + i.totalValue, 0);
          return (
          <div className="flex gap-1.5 mb-1.5">
            {topItems.map((item) => {
              const widthPct = topTotal > 0 ? Math.max(20, (item.totalValue / topTotal) * 100) : 33;
              const style = getTileStyle(item, maxValue);
              const total = item.longValue + item.shortValue;
              const longPct = total > 0 ? (item.longValue / total) * 100 : 50;
              const shortPct = 100 - longPct;
              const dominant = longPct >= 50 ? 'Long' : 'Short';
              const dominantPct = longPct >= 50 ? longPct : shortPct;

              return (
                <button
                  key={item.symbol}
                  onClick={() => onSymbolClick?.(item.symbol)}
                  style={{ width: `${widthPct}%`, background: style.bg }}
                  className={`${style.text} border ${style.border} h-[100px] rounded-lg p-2.5 flex flex-col justify-between hover:brightness-125 hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-hub-yellow/60 focus-visible:outline-none transition-all text-left flex-shrink-0`}
                >
                  <div className="flex items-center gap-1.5">
                    <TokenIconSimple symbol={item.symbol} size={18} />
                    <span className="text-sm font-bold truncate">{item.symbol}</span>
                    <span className="text-[9px] opacity-50 ml-auto shrink-0">
                      {item.count} liqs
                    </span>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-mono font-bold tabular-nums">
                        {formatLiqValue(item.totalValue)}
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${longPct >= 50 ? 'text-red-300' : 'text-green-300'}`}>
                        {dominantPct.toFixed(0)}% {dominant}
                      </span>
                    </div>
                    {/* Long/Short ratio bar */}
                    <div className="h-1.5 rounded-full overflow-hidden bg-black/40 mt-1.5 flex">
                      <div className="bg-red-400/90 h-full transition-all" style={{ width: `${longPct}%` }} />
                      <div className="bg-green-400/90 h-full transition-all" style={{ width: `${shortPct}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          );
        })()}

        {/* Remaining items compact grid */}
        {remainingItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
            {remainingItems.map((item) => {
              const style = getTileStyle(item, maxValue);
              const total = item.longValue + item.shortValue;
              const longPct = total > 0 ? (item.longValue / total) * 100 : 50;

              return (
                <button
                  key={item.symbol}
                  onClick={() => onSymbolClick?.(item.symbol)}
                  style={{ background: style.bg }}
                  className={`${style.text} border border-white/[0.04] h-[52px] rounded-lg p-2 flex flex-col justify-between hover:brightness-125 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-hub-yellow/60 focus-visible:outline-none transition-all text-left`}
                >
                  <div className="flex items-center gap-1">
                    <TokenIconSimple symbol={item.symbol} size={12} />
                    <span className="text-[10px] font-bold truncate">{item.symbol}</span>
                    <span className="text-[8px] opacity-50 ml-auto shrink-0">{item.count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold tabular-nums">
                      {formatLiqValue(item.totalValue)}
                    </span>
                    {/* Mini ratio dot */}
                    <span className={`w-1.5 h-1.5 rounded-full ${longPct >= 50 ? 'bg-red-400/80' : 'bg-green-400/80'}`} />
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
