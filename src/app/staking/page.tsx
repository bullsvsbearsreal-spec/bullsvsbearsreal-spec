'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Layers, Info, TrendingUp, TrendingDown } from 'lucide-react';

interface StakingRow {
  poolId: string;
  project: string;
  symbol: string;
  chain: string;
  category: 'LST' | 'LRT' | 'SYN' | 'Other';
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  apyMean30d: number;
  apyChange7d: number;
}

interface StakingResponse {
  data: StakingRow[];
  summary: {
    totalTvlUsd: number;
    topApy: number;
    topApyProtocol: string | null;
    lstTvl: number;
    lrtTvl: number;
    synTvl: number;
    protocolCount: number;
  };
  meta: { timestamp: number; category: string; windowDays: number; returned: number };
}

type Cat = 'all' | 'LST' | 'LRT' | 'SYN' | 'OTHER';

function fmtApy(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K%`;
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function badgeColor(c: StakingRow['category']): string {
  if (c === 'LST') return 'bg-blue-400/15 text-blue-400';
  if (c === 'LRT') return 'bg-purple-400/15 text-purple-400';
  if (c === 'SYN') return 'bg-green-400/15 text-green-400';
  return 'bg-neutral-500/15 text-neutral-400';
}

export default function StakingPage() {
  const [cat, setCat] = useState<Cat>('all');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<StakingResponse>({
    key: `staking:${cat}`,
    fetcher: async () => {
      const res = await fetch(`/api/staking?category=${cat}&limit=60`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Staking + Restaking Yields</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={data?.summary?.protocolCount ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['DeFiLlama']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Liquid staking (LST), liquid restaking (LRT), and synthetic-yield protocols (Ethena, Usual) ranked by TVL. Base + reward APY, 30d mean, 7d change.
          </p>
        </div>

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total TVL</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.totalTvlUsd} />
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{data.summary.protocolCount} pools</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-blue-400/80 mb-1 font-medium">LST TVL</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-blue-400">
                <UsdDisplay amount={data.summary.lstTvl} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-purple-400/80 mb-1 font-medium">LRT TVL</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-purple-400">
                <UsdDisplay amount={data.summary.lrtTvl} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-green-400/80 mb-1 font-medium">Synthetic TVL</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-green-400">
                <UsdDisplay amount={data.summary.synTvl} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Highest APY</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {fmtApy(data.summary.topApy)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono truncate">
                {data.summary.topApyProtocol || '—'}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3">
          {([
            ['all', 'All'],
            ['LST', 'LST'],
            ['LRT', 'LRT'],
            ['SYN', 'Synthetic'],
            ['OTHER', 'Other'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                cat === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,70px,110px,90px,90px,100px,90px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Pool</div>
            <div>Type</div>
            <div className="text-right">TVL</div>
            <div className="text-right">APY</div>
            <div className="text-right">Base</div>
            <div className="text-right">30d mean</div>
            <div className="text-right">7d Δ</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No pools match current filter.</div>
          )}

          {rows.map((r, i) => (
            <div
              key={r.poolId}
              className="md:grid md:grid-cols-[40px,1fr,70px,110px,90px,90px,100px,90px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
            >
              <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
              <div className="min-w-0">
                <div className="text-sm text-white font-semibold truncate">{r.symbol}</div>
                <div className="text-[10px] text-neutral-600 truncate">{r.project} · {r.chain}</div>
              </div>
              <div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeColor(r.category)}`}>
                  {r.category}
                </span>
              </div>
              <div className="text-right font-mono text-sm tabular-nums text-white font-semibold">
                <UsdDisplay amount={r.tvlUsd} />
              </div>
              <div className={`text-right font-mono text-sm tabular-nums font-semibold ${r.apy > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                {fmtApy(r.apy)}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                {fmtApy(r.apyBase)}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                {fmtApy(r.apyMean30d)}
              </div>
              <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${r.apyChange7d > 0 ? 'text-green-400' : r.apyChange7d < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                {r.apyChange7d > 0 ? <TrendingUp className="w-3 h-3" /> : r.apyChange7d < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                {fmtApy(r.apyChange7d)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Categories:</strong>{' '}
            <span className="text-blue-400">LST</span> = ETH liquid staking (Lido, Rocket Pool, cbETH).{' '}
            <span className="text-purple-400">LRT</span> = liquid restaking on EigenLayer (Ether.fi, Renzo, Kelp).{' '}
            <span className="text-green-400">Synthetic</span> = delta-neutral yield (Ethena USDe/sUSDe, Usual USD0).{' '}
            APY is the current reported yield, base is without external rewards, 30d mean smooths short-term spikes. Source: DeFiLlama.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
