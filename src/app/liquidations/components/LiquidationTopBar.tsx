'use client';

import { Zap } from 'lucide-react';
import { formatLiqValue } from '@/lib/utils/format';
import { useFlash } from '@/hooks/useFlash';

type Timeframe = '1h' | '4h' | '8h' | '12h' | '24h';

interface LiquidationTopBarProps {
  stats: { longValue: number; shortValue: number; total: number; count: number };
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

const TIMEFRAMES: Timeframe[] = ['1h', '4h', '8h', '12h', '24h'];

/** Trader slang based on rekt volume */
function getRektSlang(total: number, longPct: number): string | null {
  if (total >= 1_000_000_000) return 'Unprecedented liquidation event';
  if (total >= 500_000_000) return 'Total bloodbath';
  if (total >= 200_000_000) return 'Absolute carnage';
  if (total >= 100_000_000) {
    if (longPct >= 75) return 'Longs getting destroyed';
    if (longPct <= 25) return 'Massive short squeeze';
    return 'Major liquidation wave';
  }
  if (total >= 50_000_000) {
    if (longPct >= 70) return 'Bulls getting rekt';
    if (longPct <= 30) return 'Bears getting squeezed';
    return 'Both sides rekt';
  }
  if (total >= 20_000_000) return 'Elevated liquidation activity';
  return null;
}

export default function LiquidationTopBar({
  stats,
  timeframe,
  onTimeframeChange,
}: LiquidationTopBarProps) {
  const longPct = stats.total > 0 ? (stats.longValue / stats.total) * 100 : 0;
  const shortPct = 100 - longPct;
  const isHeavy = stats.total >= 50_000_000;
  const slang = getRektSlang(stats.total, longPct);
  const totalFlash = useFlash(stats.total);

  return (
    <div className="px-3 sm:px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex-shrink-0">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Title */}
        <div className="flex items-center gap-2 shrink-0">
          <Zap className="w-4 h-4 text-hub-yellow" />
          <h1 className="text-white font-bold text-base tracking-tight">Liquidations</h1>
          <span className="heartbeat-dot" style={{ width: 6, height: 6 }} />
        </div>

        {/* Center: Stat cards */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono">
          {/* Total value */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-1">
            <span className="text-neutral-500 text-[10px]">Vol</span>
            <span className={`font-black ${isHeavy ? 'text-base text-rekt-hot' : 'text-sm text-white'} ${totalFlash}`}
              style={isHeavy ? { textShadow: '0 0 6px rgba(255, 23, 68, 0.3)' } : undefined}>
              {formatLiqValue(stats.total)}
            </span>
          </div>
          {/* Count */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-1">
            <span className="text-neutral-500 text-[10px]">Liqs</span>
            <span className="text-white font-bold">{stats.count.toLocaleString()}</span>
          </div>
          {/* Long / Short split */}
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg px-2.5 py-1">
            <span className={`font-bold ${longPct >= 60 ? 'text-red-400' : 'text-red-400/70'}`}>
              L {longPct.toFixed(1)}%
            </span>
            <span className="text-neutral-700">/</span>
            <span className={`font-bold ${shortPct >= 60 ? 'text-green-400' : 'text-green-400/70'}`}>
              S {shortPct.toFixed(1)}%
            </span>
          </div>
          {slang && (
            <span className="text-[10px] italic text-amber-500/70">{slang}</span>
          )}
        </div>

        {/* Right: Timeframe pills */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" role="tablist" aria-label="Timeframe">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              role="tab"
              aria-selected={timeframe === tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-colors ${
                timeframe === tf
                  ? 'bg-hub-yellow/20 text-hub-yellow ring-1 ring-hub-yellow/30'
                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile stats row */}
      <div className="flex md:hidden items-center gap-2 text-[10px] font-mono mt-1.5">
        <span className={`font-bold px-1.5 py-0.5 rounded bg-white/[0.04] ${isHeavy ? 'text-rekt-hot' : 'text-white'} ${totalFlash}`}>{formatLiqValue(stats.total)}</span>
        <span className="text-neutral-400 font-bold">{stats.count.toLocaleString()} liqs</span>
        <span className="ml-auto text-red-400 font-bold">L {longPct.toFixed(0)}%</span>
        <span className="text-neutral-700">/</span>
        <span className="text-green-400 font-bold">S {shortPct.toFixed(0)}%</span>
      </div>

      {/* Low-data recovery notice */}
      {stats.total > 0 && stats.total < 100_000 && stats.count < 50 && (
        <div className="mt-1.5 text-[9px] text-neutral-600 bg-neutral-900/50 rounded px-2 py-1 flex items-center gap-1">
          <span className="text-amber-600">ⓘ</span>
          <span>Data pipeline recently optimized — totals may appear lower than usual while accumulating</span>
        </div>
      )}
    </div>
  );
}
