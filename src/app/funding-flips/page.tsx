'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowRightLeft, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface FlipRow {
  symbol: string;
  current: number;
  avg7d: number;
  delta: number;
  direction: 'pos→neg' | 'neg→pos';
  lastTs: number;
  tier: 'major' | 'notable' | 'subtle';
}

interface ApiResponse {
  flips: FlipRow[];
  scannedSymbols: number;
  ts: number;
}

function fmtPct(n: number, digits = 4): string {
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function timeAgo(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function FundingFlipsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/funding-flips', { signal: AbortSignal.timeout(45_000) });
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
    const id = setInterval(() => load(true), 10 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-pink-500/10 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-pink-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Funding Flip Radar</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {data?.flips.length ?? 0} flips · {data?.scannedSymbols ?? 0} scanned
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
            Coins where the most recent funding payment has flipped sign vs the
            7-day average. Positive→negative = longs were paying, now shorts pay
            (often a squeeze or capitulation marker). Negative→positive = the
            inverse. Strong flips often precede directional moves.
          </p>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Scanning {35} symbols for funding flips (~10s)…
          </div>
        )}

        {data && data.flips.length === 0 && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            No flips detected right now. The market is in a uniform-sentiment
            regime. Refresh in 8 hours when the next funding window settles.
          </div>
        )}

        {data && data.flips.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[40px,90px,120px,120px,110px,100px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div></div>
              <div>Symbol</div>
              <div className="text-right">Now</div>
              <div className="text-right">7d avg</div>
              <div className="text-right">Delta</div>
              <div className="text-right">Settled</div>
              <div>Direction</div>
            </div>
            {data.flips.map(r => {
              const tierTone = r.tier === 'major' ? 'border-l-rose-400 bg-rose-500/[0.04]'
                : r.tier === 'notable' ? 'border-l-amber-400 bg-amber-500/[0.03]'
                : 'border-l-neutral-700';
              const dirTone = r.direction === 'pos→neg' ? 'text-rose-400' : 'text-emerald-400';
              const dirIcon = r.direction === 'pos→neg' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />;
              const dirLabel = r.direction === 'pos→neg'
                ? 'Longs were paying — shorts now pay'
                : 'Shorts were paying — longs now pay';
              return (
                <div
                  key={r.symbol}
                  className={`grid grid-cols-[40px,90px,120px,120px,110px,100px,1fr] gap-3 px-3 py-2 items-center rounded border-l-2 ${tierTone}`}
                >
                  <div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded ${
                      r.tier === 'major' ? 'bg-rose-500/20 text-rose-300'
                      : r.tier === 'notable' ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-neutral-700/30 text-neutral-500'
                    }`}>
                      {r.tier === 'major' ? '▲▲▲' : r.tier === 'notable' ? '▲▲' : '▲'}
                    </span>
                  </div>
                  <div className="text-sm text-white font-bold">{r.symbol}</div>
                  <div className={`text-right font-mono text-xs tabular-nums ${r.current >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {fmtPct(r.current)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${r.avg7d >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {fmtPct(r.avg7d)}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-white font-semibold">
                    {fmtPct(r.delta)}
                  </div>
                  <div className="text-right text-[10px] text-neutral-500 font-mono">
                    {timeAgo(r.lastTs)}
                  </div>
                  <div className={`text-xs inline-flex items-center gap-1.5 ${dirTone}`}>
                    {dirIcon}
                    <span className="font-mono">{r.direction}</span>
                    <span className="text-neutral-500 ml-2">{dirLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> tier is based on
          delta magnitude (current rate − 7d average). ▲▲▲ major (&gt; 0.05%) signals
          a real shift in positioning; ▲▲ notable; ▲ subtle. Pos→neg flips often
          mark short-squeeze peaks (longs now getting paid by shorts who piled in).
          Neg→pos flips often mark capitulation lows. Source: Binance USDT-M futures
          funding history. Refreshes every 10 minutes.
        </div>
      </main>
      <Footer />
    </>
  );
}
