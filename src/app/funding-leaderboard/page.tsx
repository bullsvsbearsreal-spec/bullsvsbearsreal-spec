'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Trophy, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface VenueRow {
  exchange: string;
  flow30dUsd: number;
  avgRate: number;
  windows: number;
  totalOi: number;
  perCoin: Array<{ symbol: string; cumulative30d: number; oiUsd: number }>;
}

interface ApiResponse {
  rows: VenueRow[];
  totalFlow30d: number;
  ts: number;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(n: number, digits = 4): string {
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

export default function FundingLeaderboardPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/funding-leaderboard', { signal: AbortSignal.timeout(45_000) });
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
    const id = setInterval(() => load(true), 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const longsPaid = data?.rows.filter(r => r.flow30dUsd > 0) ?? [];
  const longsRebated = data?.rows.filter(r => r.flow30dUsd < 0) ?? [];

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Funding Fee Leaderboard · 30d</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {data?.rows.length ?? 0} venues · BTC + ETH
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
            Implied funding $ flow per exchange over the past 30 days for BTC + ETH
            perps. Positive = longs paid (shorts collected). Negative = longs
            rebated (shorts paid). Computed as cumulative-rate × open-interest.
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
            Aggregating 30d funding × OI across venues (~10s)…
          </div>
        )}

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-400" /> Longs paid 30d
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-rose-400">
                {fmtUsd(longsPaid.reduce((s, r) => s + r.flow30dUsd, 0))}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5">{longsPaid.length} venues</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Longs rebated 30d
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-emerald-400">
                {fmtUsd(longsRebated.reduce((s, r) => s + r.flow30dUsd, 0))}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5">{longsRebated.length} venues</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Net flow</div>
              <div className={`font-mono tabular-nums text-base font-bold ${data.totalFlow30d >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {fmtUsd(data.totalFlow30d)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5">
                {data.totalFlow30d >= 0 ? 'longs net paid' : 'longs net rebated'}
              </div>
            </div>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[40px,120px,130px,110px,110px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>#</div>
              <div>Venue</div>
              <div className="text-right">30d flow</div>
              <div className="text-right">Avg rate</div>
              <div className="text-right">Total OI</div>
              <div>Per-coin breakdown</div>
            </div>
            {data.rows.map((r, i) => (
              <div
                key={r.exchange}
                className="grid grid-cols-[40px,120px,130px,110px,110px,1fr] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02]"
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="text-sm text-white font-bold">{r.exchange}</div>
                <div className={`text-right font-mono text-sm font-bold tabular-nums ${r.flow30dUsd >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {fmtUsd(r.flow30dUsd)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${r.avgRate >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {fmtPct(r.avgRate)}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                  {fmtUsd(r.totalOi)}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                  {r.perCoin.map(c => (
                    <span key={c.symbol} className="px-1.5 py-px rounded bg-white/[0.04] border border-white/[0.06]">
                      <span className="text-white font-bold">{c.symbol}</span>
                      <span className={`ml-1.5 ${c.cumulative30d >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {fmtPct(c.cumulative30d, 2)}
                      </span>
                      <span className="text-neutral-600 ml-1.5">OI {fmtUsd(c.oiUsd)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">Methodology:</strong> per-coin
          cumulative funding-rate over 30 days, multiplied by current open interest,
          summed across BTC + ETH per venue. This is an <em>implied</em> $ flow —
          the actual amount that changed hands depends on intra-window OI changes,
          but as a comparative ranking it&apos;s directionally accurate. Sources:
          Binance USDT-M Futures, Bybit V5, OKX V5, Hyperliquid Info API. Cached
          30 minutes.
        </div>
      </main>
      <Footer />
    </>
  );
}
