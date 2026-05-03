'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Sigma, Info, TrendingUp, TrendingDown } from 'lucide-react';

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
    totalOiUsd: number;
    totalVolumeUsd: number;
    skew25d30d: number | null;
    termStructureSlope: number | null;
  };
  expiries: ExpiryRow[];
  meta: { timestamp: number; source: string; instrumentCount: number };
}

function fmtIv(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  return `${n.toFixed(1)}%`;
}

function fmtSkew(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function OptionsIvPage() {
  const [currency, setCurrency] = useState<'BTC' | 'ETH'>('BTC');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<OptionsIvResponse>({
    key: `options-iv:${currency}`,
    fetcher: async () => {
      const res = await fetch(`/api/options-iv?currency=${currency}`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const summary = data?.summary;
  const pcColor = summary && summary.putCallOiRatio > 0.8 ? 'text-red-400' : summary && summary.putCallOiRatio < 0.6 ? 'text-green-400' : 'text-neutral-300';
  const skewColor = summary?.skew25d30d != null && summary.skew25d30d > 2 ? 'text-red-400' : summary?.skew25d30d != null && summary.skew25d30d < -2 ? 'text-green-400' : 'text-neutral-300';
  const termColor = summary?.termStructureSlope != null && summary.termStructureSlope > 0 ? 'text-red-400' : summary?.termStructureSlope != null && summary.termStructureSlope < 0 ? 'text-green-400' : 'text-neutral-300';

  const maxAtmIv = data?.expiries?.length ? Math.max(...data.expiries.map(e => e.atmIv)) : 0;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
              <Sigma className="w-4 h-4 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Options IV Dashboard</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={1} lastUpdated={data?.meta?.timestamp ?? null} sources={['Deribit']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Implied vol term structure, put/call OI ratio, 25-delta skew, and max pain per expiry. Derived from Deribit&apos;s public options feed.
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

        {summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">ATM IV 30d</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {fmtIv(summary.atmIv30d)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                underlying <UsdDisplay amount={data?.underlying ?? 0} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Put/Call OI</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${pcColor}`}>
                {summary.putCallOiRatio > 0 ? summary.putCallOiRatio.toFixed(2) : '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {summary.putCallOiRatio > 0.8 ? 'bearish positioning' : summary.putCallOiRatio < 0.6 ? 'bullish positioning' : 'balanced'}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">25d skew · 30d</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${skewColor}`}>
                {fmtSkew(summary.skew25d30d)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                put IV minus call IV
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Term slope</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${termColor}`}>
                {fmtSkew(summary.termStructureSlope)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                short minus long IV
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total vol 24h</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={summary.totalVolumeUsd} />
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {(summary.totalOi / 1e3).toFixed(1)}k {currency} OI
              </div>
            </div>
          </div>
        )}

        <div className="card-premium p-3 min-h-[400px]">
          <div className="hidden md:grid md:grid-cols-[80px,80px,70px,110px,110px,90px,100px,110px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>Expiry</div>
            <div>Date</div>
            <div className="text-right">DTE</div>
            <div className="text-right">ATM IV</div>
            <div className="text-right">25d Skew</div>
            <div className="text-right">P/C OI</div>
            <div className="text-right">Max Pain</div>
            <div>IV bar</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {data?.expiries?.map(e => {
            const pcr = e.callOi > 0 ? e.putOi / e.callOi : 0;
            const ivPct = maxAtmIv > 0 ? (e.atmIv / maxAtmIv) * 100 : 0;
            return (
              <div
                key={e.expiry}
                className="md:grid md:grid-cols-[80px,80px,70px,110px,110px,90px,100px,110px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-sm text-white font-mono font-semibold">{e.expiry}</div>
                <div className="text-[10px] text-neutral-500 font-mono">{e.expiryDate}</div>
                <div className="text-right text-xs text-neutral-300 font-mono">{e.daysToExpiry.toFixed(0)}d</div>
                <div className="text-right font-mono text-sm tabular-nums text-white font-semibold">{fmtIv(e.atmIv)}</div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${e.skew25d > 0 ? 'text-red-400' : e.skew25d < 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                  {e.skew25d > 0 ? <TrendingUp className="w-3 h-3" /> : e.skew25d < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {fmtSkew(e.skew25d)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${pcr > 1 ? 'text-red-400' : 'text-green-400'}`}>
                  {pcr > 0 ? pcr.toFixed(2) : '—'}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-hub-yellow">
                  {e.maxPain != null ? <UsdDisplay amount={e.maxPain} /> : '—'}
                </div>
                <div>
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400/60 rounded-full"
                      style={{ width: `${ivPct}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Reading the metrics:</strong>{' '}
            <span className="text-neutral-400">ATM IV</span> is annualized implied vol of the at-the-money strike.{' '}
            <span className="text-neutral-400">25d skew</span> &gt; 0 means puts cost more than calls (fear premium).{' '}
            <span className="text-neutral-400">Put/Call OI</span> &gt; 1.0 means more open put contracts than calls.{' '}
            <span className="text-neutral-400">Term slope</span> &gt; 0 (backwardation) usually signals short-term stress.{' '}
            <span className="text-neutral-400">Max pain</span> is the strike where option writers lose least at expiry.
            Source: Deribit public options feed.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
