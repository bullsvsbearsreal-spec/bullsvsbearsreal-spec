'use client';

import { useMemo, useState } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Gauge, Info, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { ALL_EXCHANGES } from '@/lib/constants';

interface LeverageSymbolRow {
  symbol: string;
  aggregateOiUsd: number;
  venueCount: number;
  oiWeightedFunding8h: number;
  simpleAvgFunding8h: number;
  spread: number;
  perpVolume24h: number;
  spotVolume24h: number;
  spotPerpRatio: number;
}

interface LeverageResponse {
  data: LeverageSymbolRow[];
  summary: {
    totalOiUsd: number;
    aggregateFunding8h: number;
    perpVolume24h: number;
    spotVolume24h: number;
    spotPerpRatio: number;
    leverageBias: 'heavy_long' | 'heavy_short' | 'neutral';
    perpDominant: boolean;
  };
  meta: { timestamp: number; symbolsTracked: number };
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(4)}%`;
}
function fmtShortPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(3)}%`;
}

type Sort = 'oi' | 'weighted' | 'spread' | 'ratio';

export default function LeveragePage() {
  const [sort, setSort] = useState<Sort>('oi');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<LeverageResponse>({
    key: 'leverage',
    fetcher: async () => {
      const res = await fetch('/api/leverage', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const sorted = useMemo(() => {
    if (!data?.data) return [];
    const rows = [...data.data];
    if (sort === 'weighted') rows.sort((a, b) => Math.abs(b.oiWeightedFunding8h) - Math.abs(a.oiWeightedFunding8h));
    else if (sort === 'spread') rows.sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread));
    else if (sort === 'ratio') rows.sort((a, b) => a.spotPerpRatio - b.spotPerpRatio);
    else rows.sort((a, b) => b.aggregateOiUsd - a.aggregateOiUsd);
    return rows;
  }, [data, sort]);

  const summary = data?.summary;
  const biasLabel =
    summary?.leverageBias === 'heavy_long' ? 'Heavy long' :
    summary?.leverageBias === 'heavy_short' ? 'Heavy short' : 'Neutral';
  const biasColor =
    summary?.leverageBias === 'heavy_long' ? 'text-green-400' :
    summary?.leverageBias === 'heavy_short' ? 'text-red-400' : 'text-neutral-300';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-pink-500/10 flex items-center justify-center">
              <Gauge className="w-4 h-4 text-pink-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Leverage Dashboard</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={data?.meta?.symbolsTracked ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['Aggregated', 'CoinGecko']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            OI-weighted funding (what the heavy money actually pays) and spot-vs-perp volume — a single lens on leverage pressure across {ALL_EXCHANGES.length} venues.
          </p>
        </div>

        {summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total OI</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={summary.totalOiUsd} />
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{data?.meta?.symbolsTracked ?? 0} top symbols</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Aggregate funding · 8h</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${biasColor}`}>
                {fmtShortPct(summary.aggregateFunding8h)}
              </div>
              <div className={`text-[10px] mt-0.5 font-mono uppercase tracking-wider ${biasColor}`}>
                {biasLabel}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Perp volume 24h</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={summary.perpVolume24h} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Spot volume 24h</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={summary.spotVolume24h} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Spot / Perp ratio</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${summary.perpDominant ? 'text-red-400' : 'text-green-400'}`}>
                {summary.spotPerpRatio > 0 ? summary.spotPerpRatio.toFixed(2) : '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {summary.perpDominant ? 'perp-dominant' : 'healthy'}
              </div>
            </div>
          </div>
        )}

        {summary?.perpDominant && (
          <div className="card-premium p-3 mb-4 flex items-start gap-2 border border-red-400/30 bg-red-500/[0.04]">
            <Scale className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-red-200">
              <span className="font-semibold">Perp volume is dominating spot</span>
              <span className="text-red-200/70"> — spot/perp ratio below 0.7 means short-term price action is driven by leveraged speculation rather than real demand. Often precedes liquidation cascades in either direction.</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3">
          {([
            ['oi', 'OI size'],
            ['weighted', 'Weighted funding'],
            ['spread', 'Simple vs weighted spread'],
            ['ratio', 'Most perp-driven'],
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
          <div className="hidden md:grid md:grid-cols-[40px,80px,120px,130px,130px,110px,120px,90px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Symbol</div>
            <div className="text-right">Agg OI</div>
            <div className="text-right">Weighted · 8h</div>
            <div className="text-right">Simple · 8h</div>
            <div className="text-right">W−S</div>
            <div className="text-right">Perp 24h</div>
            <div className="text-right">Spot/Perp</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {sorted.map((r, i) => {
            const spreadColor = Math.abs(r.spread) < 0.002 ? 'text-neutral-500' : r.spread > 0 ? 'text-green-400' : 'text-red-400';
            const ratioColor = r.spotPerpRatio === 0 ? 'text-neutral-500' : r.spotPerpRatio < 0.5 ? 'text-red-400' : r.spotPerpRatio < 1 ? 'text-yellow-400' : 'text-green-400';
            return (
              <div
                key={r.symbol}
                className="md:grid md:grid-cols-[40px,80px,120px,130px,130px,110px,120px,90px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="text-sm text-white font-semibold">{r.symbol}</div>
                <div className="text-right font-mono text-xs tabular-nums text-white">
                  <UsdDisplay amount={r.aggregateOiUsd} />
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${r.oiWeightedFunding8h > 0 ? 'text-green-400' : r.oiWeightedFunding8h < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                  {r.oiWeightedFunding8h > 0 ? <TrendingUp className="w-3 h-3" /> : r.oiWeightedFunding8h < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {fmtPct(r.oiWeightedFunding8h)}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  {fmtPct(r.simpleAvgFunding8h)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${spreadColor}`}>
                  {fmtPct(r.spread)}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                  <UsdDisplay amount={r.perpVolume24h} />
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold ${ratioColor}`}>
                  {r.spotPerpRatio > 0 ? r.spotPerpRatio.toFixed(2) : '—'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">How to read it:</strong>&nbsp;
            <span className="text-neutral-400">Weighted &gt; Simple</span> = big exchanges are more bullish than small ones (smart money confirming a trend).&nbsp;
            <span className="text-neutral-400">Weighted &lt; Simple</span> = small venues are frothier than whales, typical late-stage euphoria.
            Spot/Perp ratio under 0.5 = perp-dominant market (fragile); over 1.5 = spot-driven accumulation (stronger).
            All funding is 8h-equivalent for cross-venue comparison.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
