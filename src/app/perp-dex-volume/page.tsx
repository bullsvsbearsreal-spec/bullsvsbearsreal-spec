'use client';

import { useMemo, useState } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Trophy, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface PerpDEXRow {
  name: string;
  logo: string | null;
  chains: string[];
  fees24h: number;
  fees7d: number;
  fees30d: number;
  impliedVolume24h: number;
  impliedVolume7d: number;
  impliedVolume30d: number;
  change24hPct: number;
  change7dPct: number;
  marketShare24h: number;
  marketShare7d: number;
}

interface VolumeResponse {
  data: PerpDEXRow[];
  summary: {
    totalFees24h: number;
    totalImpliedVolume24h: number;
    totalFees7d: number;
    totalImpliedVolume7d: number;
    protocolCount: number;
    leader: string | null;
    leaderShare: number;
    top3Share: number;
  };
  meta: { avgFeeRate: number; timestamp: number };
}

type Timeframe = '24h' | '7d' | '30d';

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function PerpDexVolumePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<VolumeResponse>({
    key: 'perp-dex-volume',
    fetcher: async () => {
      const res = await fetch('/api/perp-dex-volume', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  // Re-sort by chosen timeframe
  const sorted = useMemo(() => {
    if (!data?.data) return [];
    const k =
      timeframe === '24h' ? 'fees24h' : timeframe === '7d' ? 'fees7d' : 'fees30d';
    return [...data.data].sort((a, b) => (b[k] as number) - (a[k] as number));
  }, [data, timeframe]);

  const volKey =
    timeframe === '24h' ? 'impliedVolume24h' : timeframe === '7d' ? 'impliedVolume7d' : 'impliedVolume30d';
  const feeKey =
    timeframe === '24h' ? 'fees24h' : timeframe === '7d' ? 'fees7d' : 'fees30d';
  const changeKey: keyof PerpDEXRow =
    timeframe === '24h' ? 'change24hPct' : 'change7dPct';

  // Total for the selected window — used for share bars
  const windowTotal = sorted.reduce((s, r) => s + (r[feeKey] as number), 0);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Trophy}
          eyebrow="On-chain derivatives · market share"
          title="Perp DEX"
          accentNoun="volume"
          accent="hub-yellow"
          description={
            <>On-chain perp DEX market share — who&apos;s catching the rotation
              out of CEXes. Fee revenue is used as a proxy; implied volume assumes
              a blended <span className="text-white font-medium">0.035% taker rate</span>.</>
          }
          className="mb-4"
          actions={
            <>
              <DataFreshness exchangeCount={data?.summary?.protocolCount ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['DeFiLlama']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </>
          }
        />

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">24h Volume (impl.)</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.totalImpliedVolume24h} />
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                from <UsdDisplay amount={data.summary.totalFees24h} /> fees
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">7d Volume (impl.)</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.totalImpliedVolume7d} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">DEXs tracked</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">{data.summary.protocolCount}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Leader · 24h</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">{data.summary.leader || '—'}</div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {(data.summary.leaderShare * 100).toFixed(1)}% share
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Top 3 share</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {(data.summary.top3Share * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                concentration
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3">
          {(['24h', '7d', '30d'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                timeframe === t ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,120px,120px,140px,100px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>DEX</div>
            <div className="text-right">{timeframe} Volume</div>
            <div className="text-right">{timeframe} Fees</div>
            <div className="text-right">Market Share</div>
            <div className="text-right">Change</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-14 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {sorted.map((r, i) => {
            const vol = r[volKey] as number;
            const fees = r[feeKey] as number;
            const share = windowTotal > 0 ? fees / windowTotal : 0;
            const change = r[changeKey] as number;
            const rankColor = i === 0 ? 'text-hub-yellow' : i === 1 ? 'text-neutral-300' : i === 2 ? 'text-orange-400/80' : 'text-neutral-500';
            return (
              <div
                key={r.name}
                className="md:grid md:grid-cols-[40px,1fr,120px,120px,140px,100px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
              >
                <div className={`text-right font-mono text-sm tabular-nums font-semibold ${rankColor}`}>{i + 1}</div>
                <div className="flex items-center gap-2 min-w-0">
                  {r.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo} alt="" className="w-4 h-4 rounded-full flex-shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{r.name}</div>
                    <div className="text-[10px] text-neutral-600 truncate">
                      {r.chains.slice(0, 3).join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-sm tabular-nums text-white font-semibold">
                  <UsdDisplay amount={vol} />
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  <UsdDisplay amount={fees} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-300 font-mono tabular-nums">
                    {(share * 100).toFixed(1)}%
                  </div>
                  <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-hub-yellow/60 rounded-full"
                      style={{ width: `${share * 100}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${
                  change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-neutral-500'
                }`}>
                  {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {fmtPct(change)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Methodology:</strong> DeFiLlama&apos;s paid derivatives volume endpoint requires a subscription.
            We use the free fees endpoint instead and infer volume by dividing fees by a blended <span className="font-mono">0.035%</span> taker rate.
            Real fee rates vary (Hyperliquid ≈ 0.02-0.035%, GMX ≈ 0.05%, dYdX ≈ 0.05%) so absolute volume is order-of-magnitude correct; market share ratios are precise.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
