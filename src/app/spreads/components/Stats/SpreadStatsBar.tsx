'use client';

import { memo } from 'react';
import { Zap, BarChart3, TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';
import { fp } from '../../lib/spread-math';
import { useFlash } from '../../hooks/useFlash';
import { getSpreadSlang } from '../../lib/trader-slang';
import type { SpreadStats, TfKey, WsPrice } from '../../lib/types';
import { TFS } from '../../lib/types';

function PercentileGauge({ pct, isLive, tfLabel }: { pct: number; isLive: boolean; tfLabel: string }) {
  const isWide = pct >= 50;
  const label = isWide ? 'Wider than usual' : 'Tighter than usual';
  const color = pct >= 80 ? 'text-red-400' : pct >= 50 ? 'text-amber-400' : pct >= 20 ? 'text-green-400' : 'text-cyan-400';
  const barColor = pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-amber-400' : pct >= 20 ? 'bg-green-400' : 'bg-cyan-400';
  return (
    <div className="mt-1.5" title={`${pct}th percentile${isLive ? ' this session' : ` of ${tfLabel}`}`}>
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className={`text-[9px] font-medium ${color}`}>{label}</span>
        <span className="text-[9px] font-mono text-neutral-500 tabular-nums">P{pct}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface SpreadStatsBarProps {
  stats: SpreadStats;
  tf: TfKey;
  exs: string[];
  wsPrices: Record<string, WsPrice>;
  sel: string[];
}

function SpreadStatsBarInner({ stats, tf, exs, wsPrices, sel }: SpreadStatsBarProps) {
  const tfLabel = TFS.find(t => t.key === tf)?.label || tf;
  const isLive = tf === 'live';
  const spreadFlash = useFlash(stats.cur);
  const hiFlash = useFlash(stats.hi?.p);
  const loFlash = useFlash(stats.lo?.p);

  // Spread volatility for DB timeframes
  const spreadRange = stats.max - (stats.min === Infinity ? 0 : stats.min);
  const spreadVolPct = stats.avg > 0 && isFinite(spreadRange) ? (spreadRange / stats.avg * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      {/* Current Spread */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4" title={getSpreadSlang(stats.pct)}>
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
              <p className={`text-xl font-bold font-mono text-hub-yellow ${spreadFlash}`}>${fp(stats.cur)}</p>
              <p className="text-[11px] text-neutral-500">{isFinite(stats.pct) ? `${stats.pct.toFixed(3)}% · ${(stats.pct * 100).toFixed(1)} bps` : '—'}</p>
              {stats.percentile !== null && (
                <PercentileGauge pct={stats.percentile} isLive={isLive} tfLabel={tfLabel} />
              )}
            </div>
          </>
        ) : (
          <>
            <p className={`text-2xl font-bold font-mono text-hub-yellow ${spreadFlash}`}>${fp(stats.cur)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">{isFinite(stats.pct) ? `${stats.pct.toFixed(3)}% · ${(stats.pct * 100).toFixed(1)} bps` : '—'}</p>
            {(() => {
              const fresh = Object.values(wsPrices).filter(p => p.price > 0 && (Date.now() - p.ts) < 20000).length;
              const total = sel.length;
              return (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium tabular-nums inline-block mt-1 ${
                  fresh >= total ? 'bg-green-500/10 text-green-400'
                  : fresh >= total * 0.7 ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
                }`}>
                  {fresh}/{total} live
                </span>
              );
            })()}
            {stats.percentile !== null && (
              <PercentileGauge pct={stats.percentile} isLive={isLive} tfLabel={tfLabel} />
            )}
          </>
        )}
      </div>

      {/* Avg Spread / Spread Stats */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-neutral-500" />
          <span className="text-xs text-neutral-500">
            {isLive ? 'Session Avg' : `${tfLabel} Avg Spread`}
          </span>
        </div>
        <p className="text-2xl font-bold font-mono text-white">${fp(stats.avg)}</p>
        <p className="text-[11px] text-neutral-500 mt-1">
          Range: ${fp(stats.min)} — ${fp(stats.max)}
        </p>
        {!isLive && spreadVolPct > 0 && (
          <p className="text-[10px] text-neutral-600 mt-0.5">
            {spreadVolPct > 200 ? 'High' : spreadVolPct > 80 ? 'Moderate' : 'Low'} variance · {spreadVolPct.toFixed(0)}%
          </p>
        )}
      </div>

      {/* Highest Price */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-xs text-neutral-500">
            {isLive ? 'Highest Price' : `${tfLabel} High`}
          </span>
        </div>
        <p className={`text-2xl font-bold font-mono text-white ${hiFlash}`}>${stats.hi ? fp(stats.hi.p) : '—'}</p>
        <p className="text-[11px] text-green-400 mt-1">{stats.hi?.e}</p>
        {!isLive && stats.maxT > 0 && (
          <p className="text-[10px] text-neutral-600 mt-0.5">
            Peak spread: ${fp(stats.max)}
          </p>
        )}
      </div>

      {/* Lowest Price */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <span className="text-xs text-neutral-500">
            {isLive ? 'Lowest Price' : `${tfLabel} Low`}
          </span>
        </div>
        <p className={`text-2xl font-bold font-mono text-white ${loFlash}`}>${stats.lo ? fp(stats.lo.p) : '—'}</p>
        <p className="text-[11px] text-red-400 mt-1">{stats.lo?.e}</p>
        {!isLive && stats.minT > 0 && (
          <p className="text-[10px] text-neutral-600 mt-0.5">
            Tightest: ${fp(stats.min)}
          </p>
        )}
      </div>

      {/* 5th card: Live = Tightest B/A, DB = Spread Summary */}
      {isLive ? (() => {
        const bidAsks = Object.values(wsPrices)
          .filter(p => p.bid > 0 && p.ask > 0 && p.ask > p.bid && (Date.now() - p.ts) < 15000)
          .map(p => ({ e: p.exchange, bid: p.bid, ask: p.ask, spread: p.ask - p.bid, bps: ((p.ask - p.bid) / p.bid) * 10000 }))
          .filter(p => p.bps >= 0.1)  // Filter out exchanges that echo price as bid=ask
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
      })() : (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-neutral-500">{tfLabel} Overview</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-500">Avg %</span>
              <span className="font-mono text-xs text-white">{stats.avgPct.toFixed(3)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-500">Max %</span>
              <span className="font-mono text-xs text-white">{stats.maxPct.toFixed(3)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-500">Min %</span>
              <span className="font-mono text-xs text-white">{stats.minPct.toFixed(3)}%</span>
            </div>
            {stats.maxHi && stats.maxLo && (
              <p className="text-[10px] text-neutral-600 pt-0.5 border-t border-white/[0.04]">
                Widest: {stats.maxHi} vs {stats.maxLo}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const SpreadStatsBar = memo(SpreadStatsBarInner);
