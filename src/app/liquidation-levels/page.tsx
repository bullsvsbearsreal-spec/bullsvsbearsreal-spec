'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import PageHero from '@/components/PageHero';
import { TokenIconSimple } from '@/components/TokenIcon';
import { Zap, TrendingUp, TrendingDown, Activity, AlertTriangle, Info } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */

interface EmpiricalBucket {
  priceMid: number;
  priceLow: number;
  priceHigh: number;
  longValue: number;
  shortValue: number;
  events: number;
}

interface ForecastCluster {
  priceLevel: number;
  pricePct: number;
  side: 'long' | 'short';
  leverageTier: number;
  estimatedValue: number;
}

interface LevelsResponse {
  symbol: string;
  window: string;
  spotPrice: number;
  totalOI: number;
  empirical: {
    buckets: EmpiricalBucket[];
    totalLong: number;
    totalShort: number;
    total: number;
    events: number;
    maxBucket: number;
    source: 'okx' | 'db' | 'empty';
  };
  forecast: {
    clusters: ForecastCluster[];
    leverageMix: { leverage: number; weight: number }[];
  };
  meta: { timestamp: number; supportedSymbols: string[] };
}

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'ASTER', 'BNB', 'AVAX', 'LINK', 'SUI', 'LTC'];
const WINDOWS = [
  { id: '4h',  label: '4H',  hint: 'Last 4 hours (press 1)' },
  { id: '12h', label: '12H', hint: 'Last 12 hours (press 2)' },
  { id: '24h', label: '24H', hint: 'Last 24 hours (press 3)' },
  { id: '48h', label: '48H', hint: 'Last 48 hours (press 4)' },
];

/* ─── Helpers ───────────────────────────────────────────────────── */

function fmtUSD(n: number, compact = true): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (!compact) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPrice(n: number): string {
  if (n >= 10_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

/* ─── Empirical histogram ───────────────────────────────────────── */

function EmpiricalChart({
  buckets,
  maxBucket,
  spotPrice,
}: {
  buckets: EmpiricalBucket[];
  maxBucket: number;
  spotPrice: number;
}) {
  if (!buckets.length) {
    return (
      <div className="h-[280px] flex items-center justify-center text-neutral-500 text-sm">
        No liquidations in the selected window.
      </div>
    );
  }
  // Sort descending so highest price at top of vertical axis, like an orderbook
  const sorted = [...buckets].sort((a, b) => b.priceMid - a.priceMid);
  return (
    <div className="overflow-y-auto max-h-[500px]">
      {sorted.map(b => {
        const total = b.longValue + b.shortValue;
        const longPct = maxBucket > 0 ? (b.longValue / maxBucket) * 100 : 0;
        const shortPct = maxBucket > 0 ? (b.shortValue / maxBucket) * 100 : 0;
        const isSpotBucket = spotPrice >= b.priceLow && spotPrice < b.priceHigh;
        return (
          <div
            key={b.priceLow}
            className={`flex items-center gap-2 py-0.5 px-2 ${isSpotBucket ? 'bg-hub-yellow/[0.08] border-y border-hub-yellow/30' : ''}`}
          >
            <div className="w-[72px] text-right text-[10px] font-mono tabular-nums text-neutral-500">
              {fmtPrice(b.priceMid)}
            </div>
            {/* Long bar extends left */}
            <div className="flex-1 h-4 relative bg-white/[0.02] rounded-sm overflow-hidden">
              <div
                className="absolute right-1/2 top-0 bottom-0 bg-red-400/60 rounded-l-sm"
                style={{ width: `${longPct / 2}%` }}
                title={`${fmtUSD(b.longValue)} longs rekt`}
              />
              <div
                className="absolute left-1/2 top-0 bottom-0 bg-green-400/60 rounded-r-sm"
                style={{ width: `${shortPct / 2}%` }}
                title={`${fmtUSD(b.shortValue)} shorts rekt`}
              />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
              {isSpotBucket && (
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-hub-yellow">
                  SPOT
                </div>
              )}
            </div>
            <div className="w-[60px] text-right text-[10px] font-mono tabular-nums text-white">
              {total > 0 ? fmtUSD(total) : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Forecast clusters ─────────────────────────────────────────── */

function ForecastTable({
  clusters,
  spotPrice,
}: {
  clusters: ForecastCluster[];
  spotPrice: number;
}) {
  if (!clusters.length) {
    return (
      <div className="h-[280px] flex items-center justify-center text-neutral-500 text-sm">
        No OI data for this symbol.
      </div>
    );
  }
  const maxValue = clusters.reduce((m, c) => Math.max(m, c.estimatedValue), 0);
  // Group by side — shorts first (above spot), then longs (below spot)
  const shorts = clusters.filter(c => c.side === 'short').sort((a, b) => a.pricePct - b.pricePct);
  const longs = clusters.filter(c => c.side === 'long').sort((a, b) => b.pricePct - a.pricePct);
  const all = [...shorts, { separator: true as const }, ...longs];

  return (
    <div>
      {all.map((c, i) => {
        if ('separator' in c) {
          return (
            <div key={`sep-${i}`} className="flex items-center gap-2 py-1.5 px-2 bg-hub-yellow/[0.06] border-y border-hub-yellow/30">
              <div className="w-[72px] text-right text-[11px] font-mono font-semibold text-hub-yellow tabular-nums">
                {fmtPrice(spotPrice)}
              </div>
              <div className="flex-1 text-[10px] text-hub-yellow uppercase tracking-wider font-semibold">
                — Spot price —
              </div>
            </div>
          );
        }
        const pct = maxValue > 0 ? (c.estimatedValue / maxValue) * 100 : 0;
        const barColor = c.side === 'long' ? 'bg-red-400/60' : 'bg-green-400/60';
        const sideLabel = c.side === 'long' ? 'LONG liquidated' : 'SHORT liquidated';
        return (
          <div key={`${c.side}-${c.leverageTier}`} className="flex items-center gap-2 py-1 px-2 hover:bg-white/[0.02]">
            <div className="w-[72px] text-right text-[10px] font-mono tabular-nums text-neutral-400">
              {fmtPrice(c.priceLevel)}
            </div>
            <div className="w-[44px] text-right text-[10px] font-mono tabular-nums font-semibold">
              <span className={c.pricePct >= 0 ? 'text-green-400/80' : 'text-red-400/80'}>
                {c.pricePct >= 0 ? '+' : ''}{c.pricePct.toFixed(1)}%
              </span>
            </div>
            <div className="flex-1 h-3 relative bg-white/[0.02] rounded-sm overflow-hidden">
              <div className={`h-full ${barColor} rounded-sm`} style={{ width: `${pct}%` }} />
            </div>
            <div className="w-[80px] text-right text-[10px] font-mono tabular-nums text-white">
              {fmtUSD(c.estimatedValue)}
            </div>
            <div className="w-[46px] text-[9px] uppercase tracking-wider text-neutral-500 font-semibold">
              {c.leverageTier}×
            </div>
            <div className={`w-[48px] text-[8px] uppercase tracking-wider font-semibold text-right ${
              c.side === 'long' ? 'text-red-400/80' : 'text-green-400/80'
            }`} title={sideLabel}>
              {c.side}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function LiquidationLevelsPage() {
  const searchParams = useSearchParams();
  const initialSymbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const initialWindow = searchParams.get('window') || '24h';

  const [symbol, setSymbol] = useState<string>(SYMBOLS.includes(initialSymbol) ? initialSymbol : 'BTC');
  const [window, setWindow] = useState<string>(WINDOWS.find(w => w.id === initialWindow)?.id || '24h');

  // URL sync
  useEffect(() => {
    const q = new URLSearchParams();
    if (symbol !== 'BTC') q.set('symbol', symbol);
    if (window !== '24h') q.set('window', window);
    const qs = q.toString();
    globalThis.history?.replaceState(null, '', qs ? `/liquidation-levels?${qs}` : '/liquidation-levels');
  }, [symbol, window]);

  // Keyboard shortcuts — 1..4 for window pills
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, string> = { '1': '4h', '2': '12h', '3': '24h', '4': '48h' };
      if (map[e.key]) {
        e.preventDefault();
        setWindow(map[e.key]);
      }
    }
    globalThis.addEventListener?.('keydown', onKey);
    return () => globalThis.removeEventListener?.('keydown', onKey);
  }, []);

  const { data, isLoading, isRefreshing, error, refresh } = useApi<LevelsResponse>({
    key: `liq-levels:${symbol}:${window}`,
    fetcher: async () => {
      const res = await fetch(`/api/liquidation-levels?symbol=${symbol}&window=${window}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  // Identify the nearest danger cluster on each side for the headline callouts
  const danger = useMemo(() => {
    if (!data) return null;
    const longs = data.forecast.clusters
      .filter(c => c.side === 'long')
      .sort((a, b) => b.pricePct - a.pricePct); // closest to spot first
    const shorts = data.forecast.clusters
      .filter(c => c.side === 'short')
      .sort((a, b) => a.pricePct - b.pricePct);
    return { nearestLong: longs[0], nearestShort: shorts[0] };
  }, [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Zap}
          eyebrow={data ? `Risk · spot ${fmtPrice(data.spotPrice)}` : 'Risk · liq map'}
          title="Liquidation"
          accentNoun="levels"
          accent="red"
          description={
            <>Where did traders get rekt? Where&apos;s the next cluster?
              Historical liquidations from OKX vs forecast clusters derived
              from open interest × leverage distribution.</>
          }
          className="mb-4"
          actions={
            <>
              <DataFreshness
                exchangeCount={1}
                lastUpdated={data?.meta?.timestamp ?? null}
                sources={data?.empirical?.source === 'okx' ? ['OKX + aggregate OI'] : ['Cached + aggregate OI']}
              />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </>
          }
        />

        {/* Symbol + window pickers */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {SYMBOLS.map(s => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  symbol === s ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                <TokenIconSimple symbol={s} size={14} />
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 flex-wrap bg-white/[0.03] rounded-lg p-0.5 ml-auto">
            {WINDOWS.map(w => (
              <button
                key={w.id}
                onClick={() => setWindow(w.id)}
                title={w.hint}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                  window === w.id ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Headline summary */}
        {data && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Liquidation levels summary — updates every 60 seconds"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Window Liquidated</div>
              <div className="font-mono font-bold text-sm text-white tabular-nums">{fmtUSD(data.empirical.total)}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                <span className="text-red-400/80 font-mono">{fmtUSD(data.empirical.totalLong)} long</span> · <span className="text-green-400/80 font-mono">{fmtUSD(data.empirical.totalShort)} short</span>
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Total OI</div>
              <div className="font-mono font-bold text-sm text-white tabular-nums">{fmtUSD(data.totalOI)}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">aggregate cross-exchange</div>
            </div>
            {danger?.nearestLong && (
              <div className="card-premium p-3 border-red-400/20">
                <div className="text-[10px] uppercase tracking-wider text-red-400/80 mb-1 font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Nearest long cluster
                </div>
                <div className="font-mono font-bold text-sm text-red-400 tabular-nums">
                  {fmtPrice(danger.nearestLong.priceLevel)} <span className="text-[10px] text-red-400/70 font-mono">({danger.nearestLong.pricePct.toFixed(1)}%)</span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  ~{fmtUSD(danger.nearestLong.estimatedValue)} at {danger.nearestLong.leverageTier}× lev
                </div>
              </div>
            )}
            {danger?.nearestShort && (
              <div className="card-premium p-3 border-green-400/20">
                <div className="text-[10px] uppercase tracking-wider text-green-400/80 mb-1 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Nearest short cluster
                </div>
                <div className="font-mono font-bold text-sm text-green-400 tabular-nums">
                  {fmtPrice(danger.nearestShort.priceLevel)} <span className="text-[10px] text-green-400/70 font-mono">(+{danger.nearestShort.pricePct.toFixed(1)}%)</span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  ~{fmtUSD(danger.nearestShort.estimatedValue)} at {danger.nearestShort.leverageTier}× lev
                </div>
              </div>
            )}
          </div>
        )}

        {/* Two-column charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Empirical */}
          <div className="card-premium p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-neutral-400" /> Empirical · last {window.toUpperCase()}
                  {data?.empirical.source === 'db' && (
                    <span className="text-[9px] text-amber-400 uppercase tracking-wider bg-amber-400/10 px-1.5 py-0.5 rounded">
                      cached feed
                    </span>
                  )}
                </h2>
                <p className="text-[10px] text-neutral-500">
                  {data?.empirical.source === 'db'
                    ? 'OKX blocked this server region — showing InfoHub cached liquidations'
                    : 'Actual liquidations from OKX, bucketed by price'}
                </p>
              </div>
              <div className="flex gap-3 text-[10px] font-mono">
                <span className="text-red-400/80">↞ longs rekt</span>
                <span className="text-green-400/80">shorts rekt ↠</span>
              </div>
            </div>
            {isLoading && <div className="h-[280px] bg-white/[0.02] rounded animate-pulse" />}
            {error && <div className="text-center py-8 text-red-400 text-xs">Failed to load</div>}
            {data && !isLoading && (
              <EmpiricalChart
                buckets={data.empirical.buckets}
                maxBucket={data.empirical.maxBucket}
                spotPrice={data.spotPrice}
              />
            )}
          </div>

          {/* Forecast */}
          <div className="card-premium p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-hub-yellow" /> Forecast · OI × leverage
                </h2>
                <p className="text-[10px] text-neutral-500">
                  Estimated cluster size at each leverage tier, if price reaches that level
                </p>
              </div>
            </div>
            {isLoading && <div className="h-[280px] bg-white/[0.02] rounded animate-pulse" />}
            {error && <div className="text-center py-8 text-red-400 text-xs">Failed to load</div>}
            {data && !isLoading && (
              <ForecastTable clusters={data.forecast.clusters} spotPrice={data.spotPrice} />
            )}
          </div>
        </div>

        {/* Footer / caveats */}
        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">How to read this:</strong> The empirical view on the left shows <em>actual</em> liquidation events from OKX's public feed — where traders actually got rekt in the selected window. The forecast on the right is an <em>estimate</em> built from current aggregate OI × a typical leverage distribution ({data?.forecast.leverageMix.map(m => `${(m.weight * 100).toFixed(0)}% @ ${m.leverage}×`).join(', ')}). It's directionally useful but NOT precise — individual traders' actual liq prices depend on their specific leverage + margin mode. Treat forecast clusters as &ldquo;where things will likely accelerate&rdquo; not &ldquo;exactly $X will be liquidated at $Y.&rdquo;
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
