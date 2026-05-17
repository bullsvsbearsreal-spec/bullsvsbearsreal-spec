'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import PageHero from '@/components/PageHero';
import { TrendingUp, TrendingDown, Info, Trophy } from 'lucide-react';

interface OutperformRow {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  marketCap: number;
  change: number;
  vsBtc: number;
  vsEth: number;
  beatsBtc: boolean;
  beatsEth: boolean;
  beatsBoth: boolean;
}

interface OutperformersResponse {
  data: OutperformRow[];
  summary: {
    windowDays: string;
    btcChange: number;
    ethChange: number;
    beatBtcCount: number;
    beatEthCount: number;
    beatBothCount: number;
    universeSize: number;
    topPerformer: string | null;
    topPerformerRel: number;
  };
  meta: { timestamp: number };
}

type Window = '24h' | '7d' | '30d';
type Sort = 'vsBtc' | 'vsEth' | 'absolute';

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 10_000) return `${n >= 0 ? '+' : ''}${(n / 1000).toFixed(1)}Kx`;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function OutperformersPage() {
  const [windowKey, setWindow] = useState<Window>('7d');
  const [sort, setSort] = useState<Sort>('vsBtc');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<OutperformersResponse>({
    key: `outperformers:${windowKey}`,
    fetcher: async () => {
      const res = await fetch(`/api/outperformers?window=${windowKey}&limit=100`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const sorted = useMemo(() => {
    if (!data?.data) return [];
    const rows = [...data.data];
    if (sort === 'vsEth') rows.sort((a, b) => b.vsEth - a.vsEth);
    else if (sort === 'absolute') rows.sort((a, b) => b.change - a.change);
    else rows.sort((a, b) => b.vsBtc - a.vsBtc);
    return rows;
  }, [data, sort]);

  const summary = data?.summary;
  const isFallback = summary?.windowDays === '7d-fallback';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Trophy}
          eyebrow="Discovery · relative strength"
          title="Altcoin"
          accentNoun="outperformance"
          accent="emerald"
          description={
            <>Which altcoins are beating BTC and ETH over the rolling window.
              Sort by vs-BTC, vs-ETH, or raw move — early-rotation signal for
              alt-season setups.</>
          }
          className="mb-4"
          actions={
            <>
              <DataFreshness exchangeCount={summary?.universeSize ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['CoinGecko']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </>
          }
        />

        {summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">BTC {windowKey}</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${summary.btcChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(summary.btcChange)}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">ETH {windowKey}</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${summary.ethChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(summary.ethChange)}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Beat BTC</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-green-400">
                {summary.beatBtcCount}<span className="text-neutral-600 text-xs">/{summary.universeSize}</span>
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {summary.universeSize > 0 ? ((summary.beatBtcCount / summary.universeSize) * 100).toFixed(0) : 0}% of alts
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Beat both</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {summary.beatBothCount}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                beat BTC + ETH
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Top performer</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {summary.topPerformer || '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                +{summary.topPerformerRel.toFixed(1)}% vs BTC
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {(['24h', '7d', '30d'] as const).map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  windowKey === w ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {([
              ['vsBtc', 'vs BTC'],
              ['vsEth', 'vs ETH'],
              ['absolute', 'Absolute'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  sort === k ? 'bg-green-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {isFallback && (
            <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
              30d data not available on CoinGecko free tier, showing 7d
            </span>
          )}
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,100px,110px,110px,110px,110px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Asset</div>
            <div className="text-right">Price</div>
            <div className="text-right">{windowKey}</div>
            <div className="text-right">vs BTC</div>
            <div className="text-right">vs ETH</div>
            <div className="text-right">MCap</div>
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
            const glow = r.beatsBoth ? 'border-l-2 border-green-400/40' : r.beatsBtc ? 'border-l-2 border-hub-yellow/30' : 'border-l-2 border-transparent';
            return (
              <div
                key={r.id}
                className={`md:grid md:grid-cols-[40px,1fr,100px,110px,110px,110px,110px] gap-3 px-3 py-2 items-center rounded transition-colors hover:bg-white/[0.02] ${glow}`}
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
                <div className={`text-right font-mono text-xs tabular-nums font-semibold ${r.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(r.change)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${r.vsBtc > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.vsBtc > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {fmtPct(r.vsBtc)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${r.vsEth > 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                  {fmtPct(r.vsEth)}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  <UsdDisplay amount={r.marketCap} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">vs BTC</strong> and <strong className="text-neutral-300">vs ETH</strong> are the coin&apos;s return minus BTC/ETH&apos;s return over the same window.
            Green-bordered rows beat both. Stablecoins and BTC/ETH wrappers are excluded.
            During altseason, the % beating BTC usually crosses 60%. In BTC season it drops under 30%.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
