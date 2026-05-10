'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Users, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface CoinAgg {
  symbol: string;
  longNotional: number;
  shortNotional: number;
  totalNotional: number;
  longWallets: number;
  shortWallets: number;
  netBias: number;
  longPct: number;
  unrealizedPnl: number;
}

interface ApiResponse {
  byCoin?: CoinAgg[];
  summary?: {
    walletCount: number;
    enrichedCount: number;
    smartMoneyLongPct: number;
    totalLiveNotional: number;
    totalLiveUnrealized: number;
  };
  meta?: { timestamp: number };
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function biasTone(bias: number): string {
  if (bias > 0.5) return 'text-emerald-400 font-bold';
  if (bias > 0.15) return 'text-emerald-300';
  if (bias > -0.15) return 'text-neutral-300';
  if (bias > -0.5) return 'text-rose-300';
  return 'text-rose-400 font-bold';
}

function biasLabel(bias: number): string {
  if (bias > 0.7) return 'Heavy long';
  if (bias > 0.3) return 'Net long';
  if (bias > -0.3) return 'Mixed';
  if (bias > -0.7) return 'Net short';
  return 'Heavy short';
}

export default function SmartMoneyCompositePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/smart-money?limit=50', { signal: AbortSignal.timeout(45_000) });
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
    let mounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // Cold-cache cost on /api/smart-money is ~20 s (computes positions across
    // top wallets). The 45 s fetch timeout covers it, but if the browser hits
    // a transient platform timeout (DO Edge / function cold start contention)
    // the user is shown "Failed to load" with no automatic recovery — the
    // 2-minute interval below is the next attempt. Auto-retry once after 8 s
    // on the initial load so cold-start failures recover without user action.
    let didRetry = false;
    const initial = async () => {
      await load(false);
      // Need to read latest error state — capture via setError callback trick
      // by reading from a ref isn't worth the complexity; just check after a
      // microtask via a fresh state read.
      setTimeout(() => {
        if (!mounted || didRetry) return;
        // If we still have no data after the first attempt, schedule a retry.
        setData(prev => {
          if (prev == null && !didRetry) {
            didRetry = true;
            retryTimer = setTimeout(() => { if (mounted) load(true); }, 5_000);
          }
          return prev;
        });
      }, 100);
    };
    initial();
    const id = setInterval(() => load(true), 2 * 60_000);
    return () => {
      mounted = false;
      clearInterval(id);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [load]);

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Smart Money Composite</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {data?.byCoin?.length ?? 0} coins · {data?.summary?.enrichedCount ?? 0} wallets
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
            Aggregate per-coin positioning across the top {data?.summary?.enrichedCount ?? 30} smart-money
            wallets (verified PnL + volume gates). Shows where the pros are
            actually positioned right now — not just one trader, but the whole
            cohort. Updates every 2 minutes.
          </p>
        </div>

        {/* Top-line summary */}
        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Wallets enriched</div>
              <div className="font-mono tabular-nums text-base font-bold text-white">{data.summary.enrichedCount}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total live notional</div>
              <div className="font-mono tabular-nums text-base font-bold text-white">{fmtUsd(data.summary.totalLiveNotional)}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Aggregate bias</div>
              <div className={`font-mono tabular-nums text-base font-bold ${data.summary.smartMoneyLongPct > 60 ? 'text-emerald-400' : data.summary.smartMoneyLongPct < 40 ? 'text-rose-400' : 'text-neutral-300'}`}>
                {data.summary.smartMoneyLongPct.toFixed(0)}% long
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Live unrealized</div>
              <div className={`font-mono tabular-nums text-base font-bold ${data.summary.totalLiveUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtUsd(data.summary.totalLiveUnrealized)}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Aggregating positions across smart-money wallets (~15s)…
          </div>
        )}

        {data && (data.byCoin?.length ?? 0) === 0 && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            No live positions detected. Smart money may be flat right now, or the
            enrichment endpoint is rate-limited.
          </div>
        )}

        {data?.byCoin && data.byCoin.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[40px,90px,110px,90px,90px,140px,1fr,90px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>#</div>
              <div>Coin</div>
              <div className="text-right">Notional</div>
              <div className="text-right">Long</div>
              <div className="text-right">Short</div>
              <div className="text-right">Bias</div>
              <div>Position split</div>
              <div className="text-right">Wallets</div>
            </div>
            {data.byCoin.map((c, i) => (
              <div
                key={c.symbol}
                className="grid grid-cols-[40px,90px,110px,90px,90px,140px,1fr,90px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02]"
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="text-sm text-white font-bold">{c.symbol}</div>
                <div className="text-right font-mono text-xs tabular-nums text-white font-semibold">
                  {fmtUsd(c.totalNotional)}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-emerald-300">
                  {fmtUsd(c.longNotional)}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-rose-300">
                  {fmtUsd(c.shortNotional)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums inline-flex items-center justify-end gap-1 ${biasTone(c.netBias)}`}>
                  {c.netBias > 0 ? <TrendingUp className="w-3 h-3" /> : c.netBias < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {biasLabel(c.netBias)}
                </div>
                <div className="h-5 bg-rose-500/10 rounded overflow-hidden relative" title={`${c.longPct.toFixed(0)}% long / ${(100 - c.longPct).toFixed(0)}% short`}>
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-emerald-500/35"
                    style={{ width: `${c.longPct}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30" />
                </div>
                <div className="text-right font-mono text-[10px] tabular-nums text-neutral-500">
                  <span className="text-emerald-400">{c.longWallets}L</span>
                  <span className="mx-1 text-neutral-700">/</span>
                  <span className="text-rose-400">{c.shortWallets}S</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> we track top
          smart-money wallets (filtered by lifetime PnL + volume + win rate),
          enrich each one&apos;s live positions on Hyperliquid + GMX, then aggregate
          per-coin. Notional = sum of position sizes (USD). Bias = (long − short)
          / total. When 80%+ of SM is long the same coin, that&apos;s a strong
          conviction signal — but it can also mark crowded trades. See{' '}
          <a href="/smart-money" className="text-hub-yellow hover:underline">/smart-money</a> for the per-wallet breakdown.
        </div>
      </main>
      <Footer />
    </>
  );
}
