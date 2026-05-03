'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Zap, Info, TrendingUp, TrendingDown } from 'lucide-react';

interface MomentumRow {
  symbol: string;
  lastPrice: number;
  change24hPct: number;
  volume24hUsd: number;
  aggregateOiUsd: number;
  oiWeightedFunding8h: number;
  venueCount: number;
  score: number;
  setup: string;
}

interface MomentumResponse {
  data: MomentumRow[];
  summary: { longBiased: number; shortBiased: number; medianVolume: number };
  meta: { timestamp: number; minScore: number; returned: number };
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function scoreColor(s: number): string {
  if (s >= 80) return 'text-red-400';
  if (s >= 60) return 'text-orange-400';
  if (s >= 40) return 'text-yellow-400';
  return 'text-neutral-400';
}

export default function MomentumPage() {
  const [minScore, setMinScore] = useState(40);

  const { data, isLoading, isRefreshing, error, refresh } = useApi<MomentumResponse>({
    key: `momentum:${minScore}`,
    fetcher: async () => {
      const res = await fetch(`/api/momentum?min_score=${minScore}&limit=100`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 90_000,
  });

  const rows = data?.data ?? [];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-orange-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Momentum Screener</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={data?.meta?.returned ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['Aggregated']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Setups where multiple momentum signals converge: price move, volume surge, funding aligned with direction, real OI backing. Scored 0-100.
          </p>
        </div>

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-green-400/80 mb-1 font-medium">Long-biased (score 60+)</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-green-400">
                {data.summary.longBiased}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-red-400/80 mb-1 font-medium">Short-biased (score 60+)</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-red-400">
                {data.summary.shortBiased}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Showing</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.meta.returned}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">min score {data.meta.minScore}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Median 24h vol</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-neutral-300">
                <UsdDisplay amount={data.summary.medianVolume} />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3">
          {[40, 60, 80].map(v => (
            <button
              key={v}
              onClick={() => setMinScore(v)}
              className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                minScore === v ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Score ≥ {v}
            </button>
          ))}
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,80px,100px,90px,110px,110px,120px,70px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Symbol</div>
            <div className="text-right">Price</div>
            <div className="text-right">24h Δ</div>
            <div className="text-right">Volume</div>
            <div className="text-right">OI</div>
            <div>Setup</div>
            <div className="text-right">Score</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No setups at this score threshold. Try a lower one.</div>
          )}

          {rows.map((r, i) => (
            <div
              key={r.symbol}
              className="md:grid md:grid-cols-[40px,80px,100px,90px,110px,110px,120px,70px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
            >
              <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
              <div className="text-sm text-white font-bold">{r.symbol}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                <UsdDisplay amount={r.lastPrice} />
              </div>
              <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${r.change24hPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {r.change24hPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {fmtPct(r.change24hPct)}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-white">
                <UsdDisplay amount={r.volume24hUsd} />
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                {r.aggregateOiUsd > 0 ? <UsdDisplay amount={r.aggregateOiUsd} /> : '—'}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono truncate">{r.setup}</div>
              <div className={`text-right font-mono tabular-nums text-sm font-bold ${scoreColor(r.score)}`}>
                {r.score}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Score formula:</strong> up to 40 pts for 24h price change magnitude (full at 15%), 25 pts for volume surge vs median (full at 3x),
            20 pts if funding direction aligns with the move (squeeze setup), 15 pts if aggregate OI exceeds $10M. Composite 80+ is rare and aggressive.
            Setup description flags the specific signals firing per row.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
