'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useSWRApi';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Skull, Info, ExternalLink } from 'lucide-react';

interface RektRow {
  rank: number;
  address: string;
  totalNotional: number;
  count: number;
  score: number;
  avgLiquidation: number;
}

interface RektResponse {
  data: RektRow[];
  summary: {
    totalRekt: number;
    totalWallets: number;
    totalLiquidations: number;
    biggestLoser: string | null;
    biggestLoserNotional: number;
    biggestScore: number;
  };
  meta: { timestamp: number };
}

type Sort = 'notional' | 'count' | 'score';

function short(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function BounceLeaderboardPage() {
  const [sort, setSort] = useState<Sort>('notional');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<RektResponse>({
    key: `bounce-leaderboard:${sort}`,
    fetcher: async () => {
      const res = await fetch(`/api/rekt-leaderboard?limit=100&sort=${sort}`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  return (
    <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Rekt Leaderboard</h2>
          <div className="ml-auto flex items-center gap-1">
            <DataFreshness exchangeCount={data?.summary?.totalWallets ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['bounce.tech']} />
            <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
          </div>
        </div>
        <p className="text-sm text-neutral-500">
          Biggest historical liquidations on Hyperliquid. Scored 0-1000 by bounce.tech — the worse you got rekt, the bigger the potential BOUNCE claim.
        </p>
      </div>

      {data?.summary && (
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total liquidated</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-red-400">
              <UsdDisplay amount={data.summary.totalRekt} />
            </div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Events</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-white">
              {data.summary.totalLiquidations.toLocaleString()}
            </div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Biggest loser</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
              {data.summary.biggestLoser ? short(data.summary.biggestLoser) : '—'}
            </div>
            <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
              {data.summary.biggestLoserNotional > 0 && <><UsdDisplay amount={data.summary.biggestLoserNotional} /> rekt</>}
            </div>
          </div>
          <div className="card-premium p-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Max score</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-white">
              {data.summary.biggestScore}<span className="text-neutral-600">/1000</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3">
        {([
          ['notional', 'By notional'],
          ['count', 'By # events'],
          ['score', 'By score'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
              sort === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card-premium p-3 min-h-[500px]">
        <div className="hidden md:grid md:grid-cols-[40px,200px,140px,100px,100px,120px,50px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
          <div>#</div>
          <div>Wallet</div>
          <div className="text-right">Total Rekt</div>
          <div className="text-right">Events</div>
          <div className="text-right">Avg Liq</div>
          <div className="text-right">Score</div>
          <div className="text-right"></div>
        </div>

        {isLoading && (
          <div className="space-y-1.5 p-1">
            {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
        )}

        {rows.map((r, i) => {
          const rankColor = i === 0 ? 'text-red-400' : i === 1 ? 'text-orange-400' : i === 2 ? 'text-yellow-400' : 'text-neutral-500';
          return (
            <div
              key={r.address}
              className="md:grid md:grid-cols-[40px,200px,140px,100px,100px,120px,50px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
            >
              <div className={`text-right font-mono text-sm tabular-nums font-semibold ${rankColor} inline-flex items-center justify-end gap-1`}>
                {i < 3 && <Skull className="w-3 h-3" aria-hidden />}
                {i + 1}
              </div>
              <div className="min-w-0">
                <Link
                  href={`/bounce/${r.address}`}
                  className="text-sm text-white font-mono font-semibold hover:text-hub-yellow transition-colors truncate inline-block"
                  title={r.address}
                >
                  {short(r.address)}
                </Link>
              </div>
              <div className="text-right font-mono text-sm tabular-nums text-red-400 font-semibold">
                <UsdDisplay amount={r.totalNotional} />
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                {r.count.toLocaleString()}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                <UsdDisplay amount={r.avgLiquidation} />
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums text-xs text-white">
                  {r.score}<span className="text-neutral-600">/1000</span>
                </div>
                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-red-400/60 rounded-full" style={{ width: `${(r.score / 1000) * 100}%` }} aria-hidden />
                </div>
              </div>
              <div className="text-right">
                <a
                  href={`https://app.hyperliquid.xyz/explorer/address/${r.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-end text-neutral-500 hover:text-hub-yellow transition-colors"
                  aria-label={`Open ${short(r.address)} on Hyperliquid explorer`}
                  title="View on Hyperliquid explorer"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div>
          Score combines total notional, event count, and recency (0-1000). Click any address for the per-wallet rekt profile.
        </div>
      </div>
    </main>
  );
}
