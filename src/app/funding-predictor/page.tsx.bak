'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Crosshair, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface PredictedRow {
  symbol: string;
  lastSettled: number;
  premium: number;
  predicted: number;
  msToNextFunding: number;
  markPrice: number;
}

interface ApiResponse {
  rows: PredictedRow[];
  ts: number;
}

function fmtPct(n: number, digits = 4): string {
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function rateColor(n: number): string {
  if (n > 0.0005) return 'text-rose-400 font-semibold';
  if (n > 0.0001) return 'text-rose-300';
  if (n < -0.0005) return 'text-emerald-400 font-semibold';
  if (n < -0.0001) return 'text-emerald-300';
  return 'text-neutral-400';
}

function deltaTone(predicted: number, last: number): string {
  const delta = predicted - last;
  if (Math.abs(delta) < 0.00005) return 'text-neutral-500';
  return delta > 0 ? 'text-rose-300' : 'text-emerald-300';
}

export default function FundingPredictorPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/funding-predictor', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedSinceFetch = data ? now - data.ts : 0;

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Funding Predictor</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              Binance · live premium index
            </span>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Predicted next-window funding rate per coin, derived from Binance&apos;s
            live premium index. Predicted = clamp(premium, ±0.05%) + 0.01%
            interest. Useful for timing entries in the last 30 min before
            settlement when the rate is mostly locked in.
          </p>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading premium index…</div>
        )}

        {data && data.rows.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[40px,90px,110px,110px,110px,110px,110px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>#</div>
              <div>Symbol</div>
              <div className="text-right">Mark</div>
              <div className="text-right">Premium</div>
              <div className="text-right">Last settled</div>
              <div className="text-right">Predicted</div>
              <div className="text-right">Δ vs last</div>
              <div className="text-right">Settles in</div>
            </div>
            {data.rows.map((r, i) => {
              const remaining = Math.max(0, r.msToNextFunding - elapsedSinceFetch);
              return (
                <div
                  key={r.symbol}
                  className="grid grid-cols-[40px,90px,110px,110px,110px,110px,110px,1fr] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02]"
                >
                  <div className="text-right text-neutral-500 font-mono text-xs">{i + 1}</div>
                  <div className="text-sm text-white font-bold">{r.symbol}</div>
                  <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                    ${r.markPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${r.premium >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {fmtPct(r.premium)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${rateColor(r.lastSettled)}`}>
                    {fmtPct(r.lastSettled)}
                  </div>
                  <div className={`text-right font-mono text-sm font-bold tabular-nums ${rateColor(r.predicted)}`}>
                    {fmtPct(r.predicted)}
                    {Math.abs(r.predicted) > 0.0005 && (r.predicted > 0 ? <TrendingUp className="w-3 h-3 inline-block ml-1" /> : <TrendingDown className="w-3 h-3 inline-block ml-1" />)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${deltaTone(r.predicted, r.lastSettled)}`}>
                    {fmtPct(r.predicted - r.lastSettled, 4)}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtCountdown(remaining)}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How it works:</strong> Binance&apos;s funding
          formula is a time-weighted average of the premium across the 8h window,
          capped at ±0.05%, plus a fixed 0.01% interest rate. Our snapshot uses
          only the latest premium so it&apos;s most accurate near settlement (last
          15-30 min). Big delta vs &quot;last settled&quot; = positioning has shifted
          mid-window. Source: <code className="bg-black/40 px-1 py-0.5 rounded">/fapi/v1/premiumIndex</code>.
        </div>
      </main>
      <Footer />
    </>
  );
}
