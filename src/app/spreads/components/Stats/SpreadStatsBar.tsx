'use client';

import { memo } from 'react';
import { Zap, BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { fp } from '../../lib/spread-math';
import type { SpreadStats, TfKey, WsPrice } from '../../lib/types';
import { TFS } from '../../lib/types';

interface SpreadStatsBarProps {
  stats: SpreadStats;
  tf: TfKey;
  exs: string[];
  wsPrices: Record<string, WsPrice>;
  sel: string[];
}

function SpreadStatsBarInner({ stats, tf, exs, wsPrices, sel }: SpreadStatsBarProps) {
  const tfLabel = TFS.find(t => t.key === tf)?.label || tf;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      {/* Current Spread */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-hub-yellow" />
          <span className="text-xs text-neutral-500">
            {exs.length === 2 && stats.hi && stats.lo ? `${stats.hi.e} vs ${stats.lo.e}` : 'Current Spread'}
          </span>
        </div>
        {exs.length === 2 && stats.hi && stats.lo ? (
          <>
            <div className="space-y-0.5 mb-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-green-400 truncate">{stats.hi.e}</span>
                <span className="font-mono text-xs text-white">${fp(stats.hi.p)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-red-400 truncate">{stats.lo.e}</span>
                <span className="font-mono text-xs text-white">${fp(stats.lo.p)}</span>
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-1.5">
              <p className="text-xl font-bold font-mono text-hub-yellow">${fp(stats.cur)}</p>
              <p className="text-[11px] text-neutral-500">{stats.pct.toFixed(3)}% · {(stats.pct * 100).toFixed(1)} bps</p>
              {stats.percentile !== null && (
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {stats.percentile >= 50 ? `Top ${100 - stats.percentile}%` : `Bottom ${stats.percentile}%`}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold font-mono text-hub-yellow">${fp(stats.cur)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">{stats.pct.toFixed(3)}% · {(stats.pct * 100).toFixed(1)} bps</p>
            <div className="flex items-center gap-2 mt-1">
              {stats.percentile !== null && (
                <span className="text-[10px] text-neutral-600">
                  {stats.percentile >= 50 ? `Top ${100 - stats.percentile}%` : `Bottom ${stats.percentile}%`}
                </span>
              )}
              {(() => {
                const fresh = Object.values(wsPrices).filter(p => p.price > 0 && (Date.now() - p.ts) < 20000).length;
                const total = sel.length;
                const pct = total > 0 ? Math.round((fresh / total) * 100) : 0;
                return (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    pct >= 80 ? 'bg-green-500/10 text-green-400'
                    : pct >= 50 ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-red-500/10 text-red-400'
                  }`}>
                    {pct}% accurate
                  </span>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Avg Spread */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-neutral-500" />
          <span className="text-xs text-neutral-500">Avg Spread ({tfLabel})</span>
        </div>
        <p className="text-2xl font-bold font-mono text-white">${fp(stats.avg)}</p>
        <p className="text-[11px] text-neutral-500 mt-1">
          Range: ${fp(stats.min)} — ${fp(stats.max)}
        </p>
      </div>

      {/* Highest Price */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-xs text-neutral-500">{tf === 'live' ? 'Highest Price' : 'Last Highest'}</span>
        </div>
        <p className="text-2xl font-bold font-mono text-white">${stats.hi ? fp(stats.hi.p) : '—'}</p>
        <p className="text-[11px] text-green-400 mt-1">{stats.hi?.e}</p>
      </div>

      {/* Lowest Price */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <span className="text-xs text-neutral-500">{tf === 'live' ? 'Lowest Price' : 'Last Lowest'}</span>
        </div>
        <p className="text-2xl font-bold font-mono text-white">${stats.lo ? fp(stats.lo.p) : '—'}</p>
        <p className="text-[11px] text-red-400 mt-1">{stats.lo?.e}</p>
      </div>

      {/* Tightest Bid/Ask (live only) */}
      {tf === 'live' && (() => {
        const bidAsks = Object.values(wsPrices)
          .filter(p => p.bid > 0 && p.ask > 0 && p.ask > p.bid && (Date.now() - p.ts) < 15000)
          .map(p => ({ e: p.exchange, bid: p.bid, ask: p.ask, spread: p.ask - p.bid, bps: ((p.ask - p.bid) / p.bid) * 10000 }))
          .sort((a, b) => a.bps - b.bps);
        const best = bidAsks[0];
        const worst = bidAsks[bidAsks.length - 1];
        if (!best) return null;
        return (
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-neutral-500">Tightest B/A</span>
            </div>
            <p className="text-xl font-bold font-mono text-cyan-400">{best.bps.toFixed(1)} bps</p>
            <p className="text-[11px] text-neutral-400 mt-1">{best.e}</p>
            {worst && bidAsks.length > 1 && (
              <p className="text-[10px] text-neutral-600 mt-0.5">Widest: {worst.bps.toFixed(1)} bps ({worst.e})</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export const SpreadStatsBar = memo(SpreadStatsBarInner);
