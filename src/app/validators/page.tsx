'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Shield, RefreshCw } from 'lucide-react';

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

const ASSET_ORDER = ['ETH', 'SOL', 'BTC', 'POL', 'AVAX', 'ATOM', 'NEAR'];

function fmtUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

const CATEGORY_TONE: Record<string, string> = {
  'liquid-staking': 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20',
  'restaking': 'bg-violet-500/10 text-violet-400 border-violet-400/20',
  'native-staking': 'bg-cyan-500/10 text-cyan-400 border-cyan-400/20',
};

export default function ValidatorsPage() {
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

  const orderedAssets = useMemo(() => {
    if (!data) return [];
    const present = Object.keys(data.byAsset);
    const ordered = ASSET_ORDER.filter(a => present.includes(a));
    const rest = present.filter(a => !ASSET_ORDER.includes(a)).sort();
    return [...ordered, ...rest];
  }, [data]);

  return (
    <>
      <Header />
      <main className="max-w-[1300px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Shield}
          eyebrow={`${data ? Object.values(data.byAsset).flat().length : 0} pools · LST + restaking`}
          title="Validator"
          accentNoun="economics"
          accent="cyan"
          description="Liquid staking and restaking yields per asset. APY = base staking reward + extra token rewards (where applicable). TVL filtered to > $5M to keep noise out."
          actions={
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          }
        />

        {data && (
          <div className="card-premium p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              Total LST + restaking TVL tracked: <span className="text-white font-mono tabular-nums font-bold">{fmtUsd(data.totalTvl)}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-emerald-400/40" />liquid staking
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-violet-400/40" />restaking
              </span>
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

        {/* Per-asset sections */}
        {orderedAssets.map(asset => {
          // `orderedAssets` is derived from `data?.byAsset` so reaching this
          // map iteration implies `data` is non-null, but use optional chaining
          // anyway so a future refactor can't reintroduce a crash.
          const rows = data?.byAsset[asset] ?? [];
          if (rows.length === 0) return null;
          const totalTvl = rows.reduce((s, r) => s + r.tvlUsd, 0);
          const avgApy = rows.reduce((s, r) => s + r.apy, 0) / rows.length;
          return (
            <section key={asset} className="mb-6">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-bold text-white">
                  {asset}
                  <span className="text-neutral-500 font-normal ml-2">{rows.length} pools</span>
                </h2>
                <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
                  TVL <span className="text-white font-bold">{fmtUsd(totalTvl)}</span>
                  <span className="mx-2">·</span>
                  avg APY <span className="text-emerald-300 font-bold">{fmtPct(avgApy)}</span>
                </div>
              </div>
              <div className="card-premium p-2 overflow-x-auto">
                <div className="grid grid-cols-[1fr,90px,80px,90px,80px,80px,140px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
                  <div>Project · pool</div>
                  <div className="text-right">APY</div>
                  <div className="text-right">Base</div>
                  <div className="text-right">Reward</div>
                  <div className="text-right">Chain</div>
                  <div className="text-right">TVL</div>
                  <div>Category</div>
                </div>
                {rows.map(r => (
                  <div
                    key={`${r.project}-${r.symbol}-${r.chain}`}
                    className="grid grid-cols-[1fr,90px,80px,90px,80px,80px,140px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-white font-bold truncate">{r.project}</div>
                      <div className="text-[10px] text-neutral-600 font-mono tabular-nums truncate">{r.symbol}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums text-sm font-bold text-emerald-300">{fmtPct(r.apy)}</div>
                    <div className="text-right font-mono tabular-nums text-xs text-neutral-300">{fmtPct(r.apyBase)}</div>
                    <div className="text-right font-mono tabular-nums text-xs text-amber-300">{r.apyReward > 0 ? `+${fmtPct(r.apyReward)}` : '—'}</div>
                    <div className="text-right font-mono tabular-nums text-[10px] text-neutral-400 uppercase">{r.chain}</div>
                    <div className="text-right font-mono tabular-nums text-xs text-neutral-300">{fmtUsd(r.tvlUsd)}</div>
                    <div>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded border ${CATEGORY_TONE[r.category] ?? CATEGORY_TONE['liquid-staking']}`}>
                        {r.category.replace('-', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-2 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> APY = base staking
          reward + token rewards. Liquid staking gives you a yield-bearing token
          (stETH, jitoSOL) you can use elsewhere; restaking adds an extra reward
          layer on top via EigenLayer / Symbiotic / Karak. APY shown is the gross
          rate before slashing risk and platform fees. Source:{' '}
          <a href="https://defillama.com/yields" target="_blank" rel="noopener noreferrer" className="text-hub-yellow hover:underline">DefiLlama Yields</a>.
        </div>
      </main>
      <Footer />
    </>
  );
}
