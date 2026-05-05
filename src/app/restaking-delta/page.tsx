'use client';

/**
 * /restaking-delta — pure-frontend tool that reuses /api/validators data
 * to surface the *delta* between liquid-staking yields and restaking yields
 * per asset. Answers: "How much extra yield am I getting by adding the
 * restaking layer vs. just holding the LST?"
 *
 * No new endpoint — all logic in the page.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Layers, RefreshCw, TrendingUp } from 'lucide-react';

interface ValidatorRow {
  project: string;
  symbol: string;
  chain: string;
  asset: string;
  apy: number;
  apyBase: number;
  apyReward: number;
  tvlUsd: number;
  category: 'liquid-staking' | 'restaking' | 'native-staking';
}

interface ApiResponse {
  byAsset: Record<string, ValidatorRow[]>;
  totalTvl: number;
  ts: number;
}

interface AssetSummary {
  asset: string;
  lstAvgApy: number | null;
  lstTopApy: number | null;
  lstTopProject: string | null;
  restakingAvgApy: number | null;
  restakingTopApy: number | null;
  restakingTopProject: string | null;
  /** Restaking − LST in percentage points. */
  deltaPct: number | null;
  lstTvl: number;
  restakingTvl: number;
  totalTvl: number;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function summarize(asset: string, rows: ValidatorRow[]): AssetSummary {
  const lst = rows.filter(r => r.category === 'liquid-staking');
  const restaking = rows.filter(r => r.category === 'restaking');

  const lstApys = lst.map(r => r.apy);
  const restakingApys = restaking.map(r => r.apy);
  const lstAvg = avg(lstApys);
  const restakingAvg = avg(restakingApys);

  const lstTop = lst.slice().sort((a, b) => b.apy - a.apy)[0] ?? null;
  const restakingTop = restaking.slice().sort((a, b) => b.apy - a.apy)[0] ?? null;

  return {
    asset,
    lstAvgApy: lstAvg,
    lstTopApy: lstTop?.apy ?? null,
    lstTopProject: lstTop?.project ?? null,
    restakingAvgApy: restakingAvg,
    restakingTopApy: restakingTop?.apy ?? null,
    restakingTopProject: restakingTop?.project ?? null,
    deltaPct: (lstAvg != null && restakingAvg != null) ? restakingAvg - lstAvg : null,
    lstTvl: lst.reduce((s, r) => s + r.tvlUsd, 0),
    restakingTvl: restaking.reduce((s, r) => s + r.tvlUsd, 0),
    totalTvl: rows.reduce((s, r) => s + r.tvlUsd, 0),
  };
}

const ASSET_ORDER = ['ETH', 'SOL', 'BTC', 'POL', 'AVAX', 'ATOM', 'NEAR'];

export default function RestakingDeltaPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/validators', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const summaries = useMemo<AssetSummary[]>(() => {
    if (!data) return [];
    const present = Object.keys(data.byAsset);
    const ordered = ASSET_ORDER.filter(a => present.includes(a));
    const rest = present.filter(a => !ASSET_ORDER.includes(a));
    return [...ordered, ...rest]
      .map(a => summarize(a, data.byAsset[a] ?? []))
      .filter(s => s.lstTvl > 0 || s.restakingTvl > 0);
  }, [data]);

  const withDelta = summaries.filter(s => s.deltaPct != null);
  const bestDelta = withDelta.slice().sort((a, b) => (b.deltaPct ?? -999) - (a.deltaPct ?? -999))[0];

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Restaking Yield Delta</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {summaries.length} assets · LST vs restaking
            </span>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            How much extra yield does the restaking layer add per asset? Compares
            average APY of liquid-staking pools vs restaking pools. Positive delta =
            restaking is paying more than vanilla LST. Negative = the slashing
            risk premium isn&apos;t showing up yet.
          </p>
        </div>

        {/* Best delta banner */}
        {bestDelta && bestDelta.deltaPct != null && bestDelta.deltaPct > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200 flex items-center gap-3 flex-wrap">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <div className="text-sm">
              Highest restaking premium right now:{' '}
              <span className="font-bold">{bestDelta.asset}</span> at{' '}
              <span className="font-bold font-mono">+{bestDelta.deltaPct.toFixed(2)} pp</span>{' '}
              ({bestDelta.restakingAvgApy?.toFixed(2)}% restaking avg vs {bestDelta.lstAvgApy?.toFixed(2)}% LST avg).
            </div>
          </div>
        )}

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading staking pools…</div>
        )}

        {summaries.length === 0 && data && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            No staking pool data available right now. <a href="/validators" className="text-hub-yellow hover:underline">Check the validator page</a>.
          </div>
        )}

        {summaries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summaries.map(s => {
              const deltaPositive = (s.deltaPct ?? 0) >= 0;
              return (
                <div key={s.asset} className="card-premium p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-2xl font-bold text-white">{s.asset}</h2>
                    {s.deltaPct != null ? (
                      <div className={`text-right ${deltaPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <div className="text-[10px] uppercase tracking-wider opacity-70 font-medium">Delta</div>
                        <div className="font-mono text-2xl font-bold">
                          {deltaPositive ? '+' : ''}{s.deltaPct.toFixed(2)} pp
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-500 italic">restaking not available</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-emerald-500/[0.04] border border-emerald-400/15 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1 font-medium">LST avg</div>
                      <div className="font-mono text-lg font-bold text-emerald-300">
                        {s.lstAvgApy != null ? `${s.lstAvgApy.toFixed(2)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                        TVL {fmtUsd(s.lstTvl)}
                      </div>
                      {s.lstTopProject && (
                        <div className="text-[10px] text-neutral-400 mt-1 truncate">
                          best: <span className="text-white font-bold">{s.lstTopProject}</span> at {s.lstTopApy?.toFixed(2)}%
                        </div>
                      )}
                    </div>

                    <div className="bg-violet-500/[0.04] border border-violet-400/15 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wider text-violet-400 mb-1 font-medium">Restaking avg</div>
                      <div className="font-mono text-lg font-bold text-violet-300">
                        {s.restakingAvgApy != null ? `${s.restakingAvgApy.toFixed(2)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                        TVL {fmtUsd(s.restakingTvl)}
                      </div>
                      {s.restakingTopProject && (
                        <div className="text-[10px] text-neutral-400 mt-1 truncate">
                          best: <span className="text-white font-bold">{s.restakingTopProject}</span> at {s.restakingTopApy?.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {s.deltaPct != null && (
                    <div className="text-[11px] text-neutral-500 leading-relaxed">
                      {s.deltaPct > 0.5 ? 'Restaking paying meaningfully more — extra yield justifies the slashing risk.'
                        : s.deltaPct > 0.1 ? 'Modest premium for restaking — incremental but real.'
                        : s.deltaPct > -0.1 ? 'Roughly equivalent — points / future airdrops are the unstated motive.'
                        : 'Restaking yields below LST — risk premium not showing up in APY today.'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">Methodology:</strong> averages computed
          across DefiLlama-tracked pools per asset, filtered to TVL &gt; $5M. Restaking
          delta = restaking_avg_APY − liquid_staking_avg_APY in percentage points.
          Note that many restaking protocols pay heavily in points / future airdrops on
          top of the displayed APY — those upside surprises don&apos;t show up here.
          Source: <a href="/validators" className="text-hub-yellow hover:underline">/validators</a> data
          (DefiLlama Yields). Cached 30 minutes.
        </div>
      </main>
      <Footer />
    </>
  );
}
