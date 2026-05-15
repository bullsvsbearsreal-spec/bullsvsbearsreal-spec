'use client';

import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Sparkles, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface AltRow {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  marketCap: number;
  price: number;
  change30d: number;
  change7d: number;
  outperformsBtc30d: boolean;
  btcRelative30d: number;
}

interface AltseasonResponse {
  data: AltRow[];
  summary: {
    altseasonIndex: number;
    classification: 'Bitcoin Season' | 'Neutral' | 'Altseason';
    totalAlts: number;
    outperformers: number;
    btcChange30d: number;
    btcDominance: number;
    btcDominanceChange24h: number;
    stablecoinShare: number;
  };
  meta: { timestamp: number; sampleSize: number; windowDays?: 7 | 30 };
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function classColor(c: AltseasonResponse['summary']['classification']): string {
  if (c === 'Altseason') return 'text-green-400';
  if (c === 'Bitcoin Season') return 'text-orange-400';
  return 'text-neutral-300';
}

export default function AltseasonPage() {
  const { data, isLoading, isRefreshing, error, refresh } = useApi<AltseasonResponse>({
    key: 'altseason',
    fetcher: async () => {
      const res = await fetch('/api/altseason', { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const summary = data?.summary;
  const idx = summary?.altseasonIndex ?? 0;
  const clsn = summary?.classification ?? 'Neutral';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <header className="mb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/25 to-purple-500/[0.05] border border-purple-400/25 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-300" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Cycle · sentiment</span>
              </div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
                <span className="text-purple-300">Altseason</span> index
              </h1>
              <p className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
                % of top-50 altcoins outperforming BTC over the last{' '}
                <span className="text-white font-medium">{data?.meta?.windowDays ?? 30} days</span>.
                Above 75 = altseason · below 25 = Bitcoin season.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 self-start lg:self-end">
              <DataFreshness exchangeCount={summary?.totalAlts ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['CoinGecko']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
        </header>

        {/* Hero gauge */}
        {summary && (
          <div className="card-premium p-6 mb-4" aria-live="polite" aria-atomic="false">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Altseason Index</div>
                <div className={`font-mono tabular-nums text-5xl font-bold ${classColor(clsn)}`}>
                  {idx}
                </div>
                <div className={`text-xs font-bold uppercase tracking-wider mt-1 ${classColor(clsn)}`}>
                  {clsn}
                </div>
              </div>

              <div className="flex-1 w-full">
                <div className="relative h-3 rounded-full bg-gradient-to-r from-orange-500/70 via-neutral-700 to-green-500/70 overflow-visible">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded"
                    style={{ left: `${Math.max(0, Math.min(100, idx))}%`, transform: 'translate(-50%, -50%)' }}
                    aria-hidden
                  />
                  <div className="absolute left-[25%] top-1/2 -translate-y-1/2 w-px h-3 bg-white/20" />
                  <div className="absolute left-[75%] top-1/2 -translate-y-1/2 w-px h-3 bg-white/20" />
                </div>
                <div className="flex justify-between text-[10px] mt-2 font-mono tabular-nums">
                  <span className="text-orange-400">BTC Season</span>
                  <span className="text-neutral-500">25</span>
                  <span className="text-neutral-500">50</span>
                  <span className="text-neutral-500">75</span>
                  <span className="text-green-400">Altseason</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Outperformers</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {summary.outperformers} / {summary.totalAlts}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">beat BTC · {data?.meta?.windowDays ?? 30}d</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">BTC 30d</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${summary.btcChange30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(summary.btcChange30d)}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">BTC Dominance</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {summary.btcDominance.toFixed(1)}%
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Stablecoin share</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {summary.stablecoinShare.toFixed(2)}%
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">sidelined capital</div>
            </div>
          </div>
        )}

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,100px,110px,110px,100px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Asset</div>
            <div className="text-right">Price</div>
            <div className="text-right">30d Δ</div>
            <div className="text-right">Rel. to BTC</div>
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

          {data?.data?.map((r, i) => {
            const outperform = r.outperformsBtc30d;
            return (
              <div
                key={r.id}
                className={`md:grid md:grid-cols-[40px,1fr,100px,110px,110px,100px] gap-3 px-3 py-2 items-center rounded transition-colors hover:bg-white/[0.02] ${
                  outperform ? 'border-l-2 border-green-400/40' : 'border-l-2 border-transparent'
                }`}
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="flex items-center gap-2 min-w-0">
                  {r.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" className="w-4 h-4 rounded-full flex-shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{r.symbol}</div>
                    <div className="text-[10px] text-neutral-600 truncate">{r.name}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                  <UsdDisplay amount={r.price} />
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold ${r.change30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(r.change30d)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${
                  r.btcRelative30d > 0 ? 'text-green-400' : r.btcRelative30d < 0 ? 'text-red-400' : 'text-neutral-500'
                }`}>
                  {r.btcRelative30d > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {fmtPct(r.btcRelative30d)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${r.change7d >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                  {fmtPct(r.change7d)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Methodology:</strong> Top-50 altcoins by market cap (stablecoins + wrapped BTC excluded).
            For each, we compare its 30-day return vs BTC&apos;s 30-day return.
            Index = outperformers / 50 × 100. Green-lit rows beat BTC in the window.
            Historical altseasons (2017 Q4, 2021 Q1) spent weeks above 75.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
