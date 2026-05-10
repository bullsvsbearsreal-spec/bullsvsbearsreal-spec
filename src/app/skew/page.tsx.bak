'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Activity, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface ExpirySkew {
  expiry: string;
  daysToExpiry: number;
  callIv: number | null;
  putIv: number | null;
  skew: number | null;
  underlyingPrice: number;
}

interface ApiResponse {
  asset: 'BTC' | 'ETH';
  expiries: ExpirySkew[];
  underlyingPrice: number;
  ts: number;
}

function fmtVol(n: number | null): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

function fmtSkew(n: number | null): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}

function skewTone(s: number | null): string {
  if (s == null) return 'text-neutral-500';
  if (s < -2) return 'text-rose-400 font-semibold';   // calls > puts → unusual
  if (s < 0) return 'text-rose-300';
  if (s > 8) return 'text-amber-400';                  // very high put protection demand
  return 'text-emerald-300';
}

export default function SkewPage() {
  const [asset, setAsset] = useState<'BTC' | 'ETH'>('BTC');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/skew?asset=${asset}`, { signal: AbortSignal.timeout(15_000) });
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
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const negativeSkew = data?.expiries.filter(e => e.skew != null && e.skew < 0) ?? [];

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        {/* Hero */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Options Skew</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              Deribit · live
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
            Put-call IV skew per expiry. Skew = OTM put IV minus OTM call IV
            (~25-delta wing). Negative skew (calls richer than puts) is rare
            and historically a top warning signal. Persistent positive skew
            shows hedger demand for downside protection.
          </p>
        </div>

        {/* Asset toggle + price */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {(['BTC', 'ETH'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={`px-4 py-1 rounded text-xs font-bold transition-colors ${
                  asset === a ? 'bg-purple-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          {data && data.underlyingPrice > 0 && (
            <div className="text-xs text-neutral-500">
              Spot · <span className="text-white font-mono font-semibold">${data.underlyingPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {negativeSkew.length > 0 && (
            <div className="text-xs px-2.5 py-1 rounded-md bg-rose-500/[0.08] border border-rose-400/30 text-rose-300 font-semibold inline-flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3" />
              {negativeSkew.length} expir{negativeSkew.length === 1 ? 'y' : 'ies'} with negative skew
            </div>
          )}
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Loading skew data…
          </div>
        )}

        {data && data.expiries.length === 0 && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            No expiries with usable IV in current window.
          </div>
        )}

        {data && data.expiries.length > 0 && (
          <div className="card-premium p-4 overflow-x-auto">
            <div className="grid grid-cols-[100px,80px,110px,110px,140px,1fr] gap-3 px-2 py-2 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-2">
              <div>Expiry</div>
              <div className="text-right">Days</div>
              <div className="text-right">Call IV</div>
              <div className="text-right">Put IV</div>
              <div className="text-right">Skew (vol pts)</div>
              <div>Bias</div>
            </div>
            {data.expiries.map(e => {
              const isNegative = e.skew != null && e.skew < 0;
              const bias = e.skew == null ? '—'
                : e.skew < -2 ? 'Calls bid · top warning'
                : e.skew < 0 ? 'Calls slightly bid'
                : e.skew < 4 ? 'Balanced'
                : e.skew < 8 ? 'Puts bid · normal hedging'
                : 'Heavy put demand';
              return (
                <div
                  key={e.expiry}
                  className={`grid grid-cols-[100px,80px,110px,110px,140px,1fr] gap-3 px-2 py-2 items-center rounded ${
                    isNegative ? 'bg-rose-500/[0.05] border-l-2 border-l-rose-400' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="text-white font-mono text-xs font-semibold">{e.expiry}</div>
                  <div className="text-right font-mono text-xs text-neutral-400">{e.daysToExpiry}d</div>
                  <div className="text-right font-mono text-xs text-emerald-300">{fmtVol(e.callIv)}</div>
                  <div className="text-right font-mono text-xs text-rose-300">{fmtVol(e.putIv)}</div>
                  <div className={`text-right font-mono text-sm tabular-nums ${skewTone(e.skew)}`}>
                    {fmtSkew(e.skew)}
                    {isNegative && <TrendingDown className="w-3 h-3 inline-block ml-1" />}
                  </div>
                  <div className="text-xs text-neutral-400">{bias}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> we average mark-IV across
          OTM call strikes (1.05–1.20× spot) and OTM put strikes (0.80–0.95× spot) for
          each expiry. Skew = put IV − call IV in vol points. Crypto skew is normally
          positive (puts cost more) because longs hedge downside. When it flips
          negative, calls are unusually bid — often coincides with euphoric tops.
          Updated every 60s. Source: <a href="https://www.deribit.com" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">Deribit</a>.
        </div>
      </main>
      <Footer />
    </>
  );
}
