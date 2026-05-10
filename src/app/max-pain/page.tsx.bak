'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Crosshair, Info, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface ExpiryRow {
  expiry: string;
  expiryDate: string;
  daysToExpiry: number;
  atmIv: number;
  underlying: number;
  callOi: number;
  putOi: number;
  maxPain: number | null;
  skew25d: number;
  callIvAvg: number;
  putIvAvg: number;
}

interface OptionsIvResponse {
  currency: 'BTC' | 'ETH';
  underlying: number;
  summary: {
    atmIv30d: number | null;
    putCallOiRatio: number;
    totalOi: number;
  };
  expiries: ExpiryRow[];
  meta: { timestamp: number };
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function daysLabel(d: number): string {
  if (d < 1) return `${Math.round(d * 24)}h`;
  if (d < 30) return `${d.toFixed(0)}d`;
  return `${(d / 30).toFixed(1)}mo`;
}

function gapSignal(spot: number, pain: number | null): { pct: number; label: string; color: string } {
  if (!pain || pain <= 0 || !spot) return { pct: 0, label: '—', color: 'text-neutral-500' };
  const gap = ((spot - pain) / pain) * 100;
  // Positive → spot is above max pain → "pinning pressure pulls spot down"
  if (Math.abs(gap) < 1) return { pct: gap, label: 'at pain', color: 'text-neutral-300' };
  if (gap > 0) return { pct: gap, label: 'above pain', color: 'text-red-400' };
  return { pct: gap, label: 'below pain', color: 'text-green-400' };
}

export default function MaxPainPage() {
  const [currency, setCurrency] = useState<'BTC' | 'ETH'>('BTC');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<OptionsIvResponse>({
    key: `max-pain:${currency}`,
    fetcher: async () => {
      const res = await fetch(`/api/options-iv?currency=${currency}`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const expiries = data?.expiries ?? [];
  const underlying = data?.underlying ?? 0;

  // Stats: upcoming big expiries (>$10M notional OI)
  const bigExpiries = useMemo(() => {
    return expiries.filter(e => (e.callOi + e.putOi) * underlying >= 10_000_000);
  }, [expiries, underlying]);

  const nextBigExpiry = useMemo(() => {
    return expiries
      .filter(e => e.maxPain !== null && (e.callOi + e.putOi) * underlying >= 50_000_000 && e.daysToExpiry > 0)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry)[0] ?? null;
  }, [expiries, underlying]);

  // Weighted-avg max pain across all expiries (by OI notional)
  const weightedMaxPain = useMemo(() => {
    let num = 0;
    let den = 0;
    for (const e of expiries) {
      if (!e.maxPain) continue;
      const w = (e.callOi + e.putOi) * underlying;
      num += e.maxPain * w;
      den += w;
    }
    return den > 0 ? num / den : null;
  }, [expiries, underlying]);

  const weightedGap = useMemo(() => {
    if (!weightedMaxPain || !underlying) return null;
    return ((underlying - weightedMaxPain) / weightedMaxPain) * 100;
  }, [weightedMaxPain, underlying]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Max Pain · Options Expiries</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={1} lastUpdated={data?.meta?.timestamp ?? null} sources={['Deribit']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            The price at which the most options contracts expire worthless. Market often drifts toward max pain around expiry due to delta-hedging by writers.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3">
          {(['BTC', 'ETH'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                currency === c ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4" aria-live="polite" aria-atomic="false">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">{currency} spot</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={underlying} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Weighted max pain</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {weightedMaxPain ? fmtUsd(weightedMaxPain) : '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">OI-weighted across all expiries</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Spot vs pain</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${weightedGap != null && weightedGap > 0 ? 'text-red-400' : weightedGap != null && weightedGap < 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                {weightedGap != null ? `${weightedGap >= 0 ? '+' : ''}${weightedGap.toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {weightedGap != null && Math.abs(weightedGap) < 1 ? 'at pain' : weightedGap != null && weightedGap > 0 ? 'downside pressure' : 'upside pressure'}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Next big expiry</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {nextBigExpiry ? nextBigExpiry.expiry : '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {nextBigExpiry ? `in ${daysLabel(nextBigExpiry.daysToExpiry)}` : ''}
              </div>
            </div>
          </div>
        )}

        {/* Next big expiry highlight */}
        {nextBigExpiry && (
          <div className="card-premium p-4 mb-4 bg-gradient-to-br from-indigo-500/[0.05] to-transparent border border-indigo-400/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white mb-1">
                  {currency} {nextBigExpiry.expiry} expiry · in {daysLabel(nextBigExpiry.daysToExpiry)}
                </div>
                <div className="text-[12px] text-neutral-400 leading-relaxed">
                  Max pain at <span className="text-hub-yellow font-semibold">{fmtUsd(nextBigExpiry.maxPain ?? 0)}</span>.
                  Combined call + put OI notional &gt; $50M. Often the biggest dealer-hedging event of the week.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card-premium p-3 min-h-[400px]">
          <div className="hidden md:grid md:grid-cols-[90px,90px,80px,130px,110px,130px,140px,110px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>Expiry</div>
            <div>Date</div>
            <div className="text-right">DTE</div>
            <div className="text-right">Max Pain</div>
            <div className="text-right">Gap to spot</div>
            <div className="text-right">Combined OI $</div>
            <div className="text-right">Call / Put OI</div>
            <div className="text-right">ATM IV</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {expiries.map(e => {
            const combinedOiUsd = (e.callOi + e.putOi) * underlying;
            const sig = gapSignal(underlying, e.maxPain);
            const isBig = combinedOiUsd >= 50_000_000;
            return (
              <div
                key={e.expiry}
                className={`md:grid md:grid-cols-[90px,90px,80px,130px,110px,130px,140px,110px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors ${isBig ? 'border-l-2 border-indigo-400/50' : 'border-l-2 border-transparent'}`}
              >
                <div className="text-sm text-white font-mono font-semibold">{e.expiry}</div>
                <div className="text-[10px] text-neutral-500 font-mono">{e.expiryDate}</div>
                <div className="text-right text-xs text-neutral-300 font-mono tabular-nums">{daysLabel(e.daysToExpiry)}</div>
                <div className="text-right font-mono text-sm tabular-nums text-hub-yellow font-semibold">
                  {fmtUsd(e.maxPain ?? 0)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${sig.color}`}>
                  {sig.pct > 0 ? <TrendingUp className="w-3 h-3" /> : sig.pct < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {Math.abs(sig.pct) < 0.01 ? '—' : `${sig.pct >= 0 ? '+' : ''}${sig.pct.toFixed(1)}%`}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${isBig ? 'text-white font-semibold' : 'text-neutral-400'}`}>
                  {combinedOiUsd > 0 ? `$${(combinedOiUsd / 1e6).toFixed(1)}M` : '—'}
                </div>
                <div className="text-right font-mono text-[11px] tabular-nums">
                  <span className="text-green-400">{(e.callOi).toFixed(0)}</span>
                  <span className="text-neutral-600"> / </span>
                  <span className="text-red-400">{(e.putOi).toFixed(0)}</span>
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                  {e.atmIv > 0 ? `${e.atmIv.toFixed(1)}%` : '—'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Max pain</strong> is the strike at which option writers lose the least at expiry — the price where the most contracts expire worthless. When spot is
            <span className="text-red-400"> above pain</span>, dealers need to sell to stay delta-neutral into expiry (downside pressure).
            When <span className="text-green-400">below pain</span>, they need to buy (upside pressure).
            Rows with a blue border cross the $50M combined-OI threshold where pinning effects become meaningful. Source: Deribit.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
