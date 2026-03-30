'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getCoinIcon } from '@/lib/coinIcons';
import { fp } from '../../lib/spread-math';
import { useFlash } from '../../hooks/useFlash';
import type { SpreadStats, WsPrice, TfKey } from '../../lib/types';

interface StickySpreadBarProps {
  stats: SpreadStats;
  sym: string;
  tf: TfKey;
  wsPrices: Record<string, WsPrice>;
  wsCount: number;
  selCount: number;
}

function StickySpreadBarInner({ stats, sym, tf, wsPrices, wsCount, selCount }: StickySpreadBarProps) {
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const spreadFlash = useFlash(stats.cur);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel element — when this scrolls out of view, the bar becomes sticky */}
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />

      <div
        className={`transition-all duration-200 z-30 ${
          stuck
            ? 'fixed top-0 left-0 right-0 bg-[#0a0c10]/95 backdrop-blur-lg border-b border-white/[0.06] shadow-lg shadow-black/30'
            : 'hidden'
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-4 overflow-x-auto scrollbar-none">
          {/* Symbol */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getCoinIcon(sym)} alt="" className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-sm font-bold text-white">{sym}</span>
            <span className="text-[10px] text-neutral-500">Perp</span>
          </div>

          <div className="w-px h-5 bg-white/[0.06] flex-shrink-0" />

          {/* Spread */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ArrowLeftRight className="w-3.5 h-3.5 text-hub-yellow" />
            <span className="text-[10px] text-neutral-500">Spread</span>
            <span className={`font-mono text-sm font-bold text-hub-yellow tabular-nums ${spreadFlash}`}>
              ${fp(stats.cur)}
            </span>
            <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
              {stats.pct.toFixed(3)}% · {(stats.pct * 100).toFixed(1)} bps
            </span>
          </div>

          <div className="w-px h-5 bg-white/[0.06] flex-shrink-0" />

          {/* High exchange */}
          {stats.hi && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[9px] text-green-400/60 uppercase font-semibold">High</span>
              <ExchangeLogo exchange={stats.hi.e} size={14} />
              <span className="text-[11px] text-neutral-400">{stats.hi.e}</span>
              <span className="font-mono text-[11px] text-white tabular-nums">${fp(stats.hi.p)}</span>
            </div>
          )}

          {/* Low exchange */}
          {stats.lo && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[9px] text-red-400/60 uppercase font-semibold">Low</span>
              <ExchangeLogo exchange={stats.lo.e} size={14} />
              <span className="text-[11px] text-neutral-400">{stats.lo.e}</span>
              <span className="font-mono text-[11px] text-white tabular-nums">${fp(stats.lo.p)}</span>
            </div>
          )}

          {/* Live status */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {wsCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
            )}
            <span className="text-[10px] text-neutral-500 tabular-nums">
              {wsCount}/{selCount} live
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-500 font-medium">
              {tf === 'live' ? 'LIVE' : tf.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export const StickySpreadBar = memo(StickySpreadBarInner);
