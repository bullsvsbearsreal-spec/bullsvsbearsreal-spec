'use client';

import { Zap, Volume2, VolumeX } from 'lucide-react';
import { formatLiqValue } from '@/lib/utils/format';

type Timeframe = '4h' | '8h' | '12h' | '24h';

interface LiquidationTopBarProps {
  stats: { longValue: number; shortValue: number; total: number; count: number };
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
}

const TIMEFRAMES: Timeframe[] = ['4h', '8h', '12h', '24h'];

export default function LiquidationTopBar({
  stats,
  timeframe,
  onTimeframeChange,
  soundEnabled,
  onSoundToggle,
}: LiquidationTopBarProps) {
  const longPct = stats.total > 0 ? ((stats.longValue / stats.total) * 100).toFixed(1) : '0.0';
  const shortPct = stats.total > 0 ? ((stats.shortValue / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex-shrink-0">
      <div className="flex items-center justify-between">
        {/* Left: Title */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-hub-yellow" />
          <span className="text-white font-bold text-base tracking-tight">Liquidations</span>
        </div>

        {/* Center: Inline stats */}
        <div className="hidden md:flex items-center gap-1.5 text-xs font-mono">
          <span className="text-white font-semibold">{formatLiqValue(stats.total)}</span>
          <span className="text-neutral-600">total</span>
          <span className="text-neutral-700">|</span>
          <span className="text-neutral-300">{stats.count.toLocaleString()}</span>
          <span className="text-neutral-600">liqs</span>
          <span className="text-neutral-700">|</span>
          <span className="text-red-400">L {longPct}%</span>
          <span className="text-neutral-700">/</span>
          <span className="text-green-400">S {shortPct}%</span>
        </div>

        {/* Right: Timeframe pills + Sound toggle */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-colors ${
                timeframe === tf
                  ? 'bg-hub-yellow/20 text-hub-yellow ring-1 ring-hub-yellow/30'
                  : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04]'
              }`}
            >
              {tf}
            </button>
          ))}
          <button
            onClick={onSoundToggle}
            className={`ml-1 p-1.5 rounded-md transition-colors ${
              soundEnabled
                ? 'bg-hub-yellow/20 text-hub-yellow'
                : 'text-neutral-600 hover:text-neutral-400'
            }`}
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile stats row */}
      <div className="flex md:hidden items-center gap-1.5 text-[10px] font-mono mt-1">
        <span className="text-white font-semibold">{formatLiqValue(stats.total)}</span>
        <span className="text-neutral-600">|</span>
        <span className="text-neutral-300">{stats.count.toLocaleString()}</span>
        <span className="text-neutral-600">liqs</span>
        <span className="text-neutral-600">|</span>
        <span className="text-red-400">L {longPct}%</span>
        <span className="text-neutral-700">/</span>
        <span className="text-green-400">S {shortPct}%</span>
      </div>
    </div>
  );
}
