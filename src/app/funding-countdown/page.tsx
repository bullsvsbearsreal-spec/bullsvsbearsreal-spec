'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Clock, RefreshCw, Activity } from 'lucide-react';

interface CountdownRow {
  exchange: string;
  symbol: string;
  fundingRate: number;
  nextFundingMs: number;
  intervalHours: number;
}

interface ApiResponse {
  rows: CountdownRow[];
  symbols: string[];
  exchanges: string[];
  ts: number;
}

function fmtCountdown(ms: number): { label: string; urgency: 'imminent' | 'soon' | 'normal' } {
  if (ms <= 0) return { label: 'now', urgency: 'imminent' };
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let label: string;
  if (h > 0) label = `${h}h ${m}m`;
  else if (m > 0) label = `${m}m ${sec}s`;
  else label = `${sec}s`;
  const urgency = ms < 60_000 ? 'imminent' : ms < 5 * 60_000 ? 'soon' : 'normal';
  return { label, urgency };
}

function fmtPct(n: number): string {
  const pct = n * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(4)}%`;
}

function rateColor(rate: number): string {
  if (rate > 0.0005) return 'text-rose-400';        // > +0.05% pays longs
  if (rate > 0.0001) return 'text-rose-300';
  if (rate < -0.0005) return 'text-emerald-400';
  if (rate < -0.0001) return 'text-emerald-300';
  return 'text-neutral-400';
}

export default function FundingCountdownPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/funding-countdown', { signal: AbortSignal.timeout(15_000) });
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
    const refreshIv = setInterval(() => load(true), 30_000);
    return () => clearInterval(refreshIv);
  }, [load]);

  // Tick clock every second so the countdowns update without re-fetching
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Build matrix: { [symbol]: { [exchange]: row } }
  const matrix = useMemo(() => {
    if (!data) return null;
    const m = new Map<string, Map<string, CountdownRow>>();
    for (const r of data.rows) {
      if (!m.has(r.symbol)) m.set(r.symbol, new Map());
      m.get(r.symbol)!.set(r.exchange, r);
    }
    return m;
  }, [data]);

  const symbols = data?.symbols ?? [];
  const exchanges = data?.exchanges ?? [];

  // Sort: exchange order roughly by importance
  const exchangeOrder = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid'];
  const sortedExchanges = exchangeOrder.filter(e => exchanges.includes(e))
    .concat(exchanges.filter(e => !exchangeOrder.includes(e)));

  // Find next imminent settlement across all rows
  const nextImminent = useMemo(() => {
    if (!data) return null;
    const future = data.rows.filter(r => r.nextFundingMs > now).sort((a, b) => a.nextFundingMs - b.nextFundingMs);
    return future[0] ?? null;
  }, [data, now]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Clock}
          eyebrow={`Settlement clocks · ${data?.rows.length ?? 0} feeds`}
          title="Funding"
          accentNoun="countdown"
          accent="orange"
          description={
            <>Live next-settlement clocks per exchange × symbol. Time until each
              exchange charges/credits funding for open positions. Most CEX settle
              every 8h on offset schedules; Hyperliquid + dYdX settle hourly.</>
          }
          actions={
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              aria-label="Refresh"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/[0.08] text-xs font-semibold transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        />

        {/* Next imminent banner */}
        {nextImminent && (() => {
          const { label, urgency } = fmtCountdown(nextImminent.nextFundingMs - now);
          const tone = urgency === 'imminent' ? 'border-rose-400/40 bg-rose-500/[0.06] text-rose-200'
            : urgency === 'soon' ? 'border-amber-400/40 bg-amber-500/[0.06] text-amber-200'
            : 'border-white/[0.08] bg-white/[0.02] text-neutral-300';
          return (
            <div className={`mb-4 px-4 py-3 rounded-xl border ${tone} flex items-center gap-3`}>
              <Activity className={`w-4 h-4 flex-shrink-0 ${urgency === 'imminent' ? 'animate-pulse' : ''}`} />
              <div className="text-sm">
                <span className="font-bold">{nextImminent.exchange}</span>
                <span className="text-neutral-400 mx-1.5">/</span>
                <span className="font-bold">{nextImminent.symbol}</span>
                <span className="text-neutral-400 mx-2">funding settles in</span>
                <span className="font-mono font-bold">{label}</span>
                <span className="text-neutral-500 ml-2">at</span>
                <span className={`ml-1 font-mono ${rateColor(nextImminent.fundingRate)}`}>
                  {fmtPct(nextImminent.fundingRate)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Error */}
        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">
              retry
            </button>
          </div>
        )}

        {/* Loading */}
        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Loading countdowns…
          </div>
        )}

        {/* Matrix */}
        {matrix && symbols.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-wider text-neutral-500 font-semibold pb-2 px-2 sticky left-0 bg-[var(--hub-darker)]">
                    Symbol
                  </th>
                  {sortedExchanges.map(ex => (
                    <th key={ex} className="text-left text-[10px] uppercase tracking-wider text-neutral-500 font-semibold pb-2 px-3 min-w-[140px]">
                      {ex}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map(sym => (
                  <tr key={sym} className="border-t border-white/[0.04]">
                    <td className="py-2 px-2 font-mono text-white font-semibold sticky left-0 bg-[var(--hub-darker)]">
                      {sym}
                    </td>
                    {sortedExchanges.map(ex => {
                      const r = matrix.get(sym)?.get(ex);
                      if (!r) {
                        return <td key={ex} className="py-2 px-3 text-neutral-700 text-xs">—</td>;
                      }
                      const remainingMs = r.nextFundingMs - now;
                      const { label, urgency } = fmtCountdown(remainingMs);
                      const cellTone = urgency === 'imminent' ? 'bg-rose-500/[0.06] border-rose-400/30'
                        : urgency === 'soon' ? 'bg-amber-500/[0.06] border-amber-400/30'
                        : 'bg-white/[0.015] border-white/[0.04]';
                      return (
                        <td key={ex} className="py-2 px-2">
                          <div className={`px-3 py-1.5 rounded-md border ${cellTone}`}>
                            <div className={`font-mono text-xs font-semibold ${urgency === 'imminent' ? 'text-rose-200' : urgency === 'soon' ? 'text-amber-200' : 'text-neutral-200'}`}>
                              {label}
                            </div>
                            <div className={`font-mono text-[10px] mt-0.5 ${rateColor(r.fundingRate)}`}>
                              {fmtPct(r.fundingRate)}
                              {r.intervalHours !== 8 && (
                                <span className="text-neutral-600 ml-1">({r.intervalHours}h)</span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info footer */}
        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> Each cell shows the live
          countdown to the next funding settlement on that exchange, and the current rate.
          Reds = settlement happens within 5 minutes. <strong>Positive funding</strong> = longs pay shorts.
          <strong> Negative funding</strong> = shorts pay longs. Most CEX settle every 8 hours on
          offset clocks (Binance/Bybit/Bitget at 00:00/08:00/16:00 UTC, OKX at 04:00/12:00/20:00
          UTC). Hyperliquid settles every hour.
        </div>
      </main>
      <Footer />
    </>
  );
}
