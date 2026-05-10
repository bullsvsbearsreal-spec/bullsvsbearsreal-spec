'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Activity, RefreshCw } from 'lucide-react';

interface ApiResponse {
  asset: 'BTC' | 'ETH';
  rv: { window7d: number | null; window14d: number | null; window30d: number | null };
  iv: { atm30d: number | null; atm60d: number | null; atm90d: number | null; underlying: number | null };
  premium30d: number | null;
  underlyingPrice: number | null;
  ts: number;
}

function fmtVol(n: number | null, digits = 1): string {
  if (n == null) return '—';
  return `${n.toFixed(digits)}%`;
}

function premiumTone(n: number | null): string {
  if (n == null) return 'text-neutral-500';
  if (n > 5) return 'text-rose-300';      // IV >> RV → option sellers favoured
  if (n > 1) return 'text-rose-400';
  if (n > -1) return 'text-neutral-300';
  if (n > -5) return 'text-emerald-300';
  return 'text-emerald-400';              // IV << RV → option buyers favoured
}

function regimeLabel(prem: number | null): string {
  if (prem == null) return 'Insufficient data';
  if (prem > 5) return 'Vol-rich · option selling favoured';
  if (prem > 1) return 'Mild premium';
  if (prem > -1) return 'Fair value';
  if (prem > -5) return 'Vol-cheap · option buying favoured';
  return 'Severely under-priced · long premium';
}

export default function RvIvPage() {
  const [asset, setAsset] = useState<'BTC' | 'ETH'>('BTC');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/rv-iv?asset=${asset}`, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, [asset]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 15 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Realized vs Implied Vol</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              IV − RV premium
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
            Compare realised volatility (annualised stddev of daily log returns)
            to ATM implied vol from Deribit options. Persistent premium = options
            priced above realised; option sellers favoured. Negative premium =
            options under-priced; option buyers favoured. Mean-reverts historically.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 mb-4 w-fit">
          {(['BTC', 'ETH'] as const).map(a => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                asset === a ? 'bg-purple-400 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Computing realised vol…</div>
        )}

        {data && (
          <>
            {/* Headline premium */}
            <div className="card-premium p-5 mb-4">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">30-day IV − RV premium</div>
              <div className={`text-4xl font-bold font-mono tabular-nums ${premiumTone(data.premium30d)}`}>
                {data.premium30d != null
                  ? `${data.premium30d > 0 ? '+' : ''}${data.premium30d.toFixed(1)} vol pts`
                  : '—'}
              </div>
              <div className="text-xs text-neutral-400 mt-1">{regimeLabel(data.premium30d)}</div>
            </div>

            {/* RV vs IV grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="card-premium p-4">
                <h2 className="text-sm font-bold text-white mb-3">Realised volatility</h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">7d</span>
                    <span className="text-base font-mono font-bold text-emerald-300">{fmtVol(data.rv.window7d)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">14d</span>
                    <span className="text-base font-mono font-bold text-emerald-300">{fmtVol(data.rv.window14d)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">30d</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">{fmtVol(data.rv.window30d)}</span>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-600 mt-3">
                  Annualised stddev of daily log returns. Source: CoinGecko daily.
                </div>
              </div>

              <div className="card-premium p-4">
                <h2 className="text-sm font-bold text-white mb-3">Implied volatility (ATM)</h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">30d expiry</span>
                    <span className="text-lg font-mono font-bold text-rose-400">{fmtVol(data.iv.atm30d)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">60d expiry</span>
                    <span className="text-base font-mono font-bold text-rose-300">{fmtVol(data.iv.atm60d)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">90d expiry</span>
                    <span className="text-base font-mono font-bold text-rose-300">{fmtVol(data.iv.atm90d)}</span>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-600 mt-3">
                  Average ATM mark IV (strikes ±5% spot). Source: Deribit.
                </div>
              </div>
            </div>

            {/* Quick term-structure interpretation */}
            {data.iv.atm30d != null && data.iv.atm90d != null && (
              <div className="card-premium p-3 mb-4">
                <div className="text-xs">
                  <strong className="text-neutral-300">Term structure:</strong>{' '}
                  {(data.iv.atm90d - data.iv.atm30d) > 1
                    ? <span className="text-emerald-400">contango (longer-dated more expensive — calm now, uncertain later)</span>
                    : (data.iv.atm90d - data.iv.atm30d) < -1
                    ? <span className="text-rose-400">backwardation (front-end more expensive — short-term event risk priced in)</span>
                    : <span className="text-neutral-400">flat</span>
                  }
                  <span className="text-neutral-500 ml-2">
                    · 90d−30d slope: <span className="font-mono">{(data.iv.atm90d - data.iv.atm30d).toFixed(2)} vol pts</span>
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to trade it:</strong> when IV is
          much higher than RV (positive premium), short premium plays (covered calls,
          put-write, short straddle) have edge. When IV is below RV, long-premium
          plays (long straddle, calendars) have edge. The 30d window is most actively
          traded; the 90d gives directional context. Caveats: free-tier daily data
          is coarser than the 5-min bars pros use; values shown are useful as a
          regime gauge, not a precise vol arbitrage signal.
        </div>
      </main>
      <Footer />
    </>
  );
}
