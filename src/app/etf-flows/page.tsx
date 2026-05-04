'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react';

interface FlowDay {
  date: string;
  perIssuer: (number | null)[];
  total: number;
}

interface ApiResponse {
  asset: 'btc' | 'eth';
  issuers: string[];
  days: FlowDay[];
  cumulative7d: number;
  cumulative30d: number;
  latestDay: FlowDay | null;
  dataAvailable?: boolean;
  note?: string;
  ts: number;
}

function fmtMillions(n: number | null): string {
  if (n == null) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}B`;
  return `${sign}$${abs.toFixed(1)}M`;
}

function fmtMillionsShort(n: number | null): string {
  if (n == null) return '';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}B`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  return `${sign}${abs.toFixed(1)}`;
}

/** Bar visualization scaled to max abs value across the window. */
function flowColor(n: number): string {
  if (n > 0) return 'bg-emerald-400';
  if (n < 0) return 'bg-rose-400';
  return 'bg-neutral-700';
}

export default function EtfFlowsPage() {
  const [asset, setAsset] = useState<'btc' | 'eth'>('btc');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/etf-flows?asset=${asset}`, { signal: AbortSignal.timeout(20_000) });
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
    const id = setInterval(() => load(true), 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Max-abs across last 60d for bar scaling
  const maxAbs = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.days.slice(0, 60).map(d => Math.abs(d.total)));
  }, [data]);

  // 14-day flow chart (mini sparkline-style bars)
  const chartDays = data?.days.slice(0, 30).reverse() ?? [];

  // Issuer YTD-ish leaderboard from window
  const issuerTotals = useMemo(() => {
    if (!data) return [];
    const totals: Array<{ name: string; total: number }> = data.issuers.map(name => ({ name, total: 0 }));
    for (const d of data.days) {
      d.perIssuer.forEach((v, i) => {
        if (v != null && totals[i]) totals[i].total += v;
      });
    }
    totals.forEach(t => t.total = Math.round(t.total * 10) / 10);
    return totals.filter(t => Math.abs(t.total) > 0.5).sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <>
      <Header />
      <main className="max-w-[1300px] mx-auto w-full px-4 py-6">
        {/* Hero */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Spot ETF Flows</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {data?.days.length ?? 0} days · daily net
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
            Daily net inflows / outflows for spot {asset === 'btc' ? 'Bitcoin' : 'Ethereum'} ETFs,
            broken out by issuer. Source: <a href="https://farside.co.uk" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">Farside Investors</a>.
            Updated once per US trading day after the close.
          </p>
        </div>

        {/* Asset toggle */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 mb-4 w-fit">
          {(['btc', 'eth'] as const).map(a => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                asset === a ? 'bg-violet-400 text-black' : 'text-neutral-400 hover:text-white'
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
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading flow data…</div>
        )}

        {data && data.dataAvailable === false && (
          <div className="card-premium p-6 text-center mb-4">
            <div className="text-base font-bold text-amber-300 mb-2">Data temporarily unavailable</div>
            <p className="text-sm text-neutral-400 mb-3 max-w-md mx-auto">
              {data.note ?? 'Source unreachable.'}
            </p>
            <a
              href="https://farside.co.uk/bitcoin-etf-flow-all-data/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-hub-yellow hover:underline"
            >
              View raw data on Farside →
            </a>
          </div>
        )}

        {data && data.dataAvailable !== false && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Latest day</div>
                <div className={`font-mono tabular-nums text-base font-bold ${(data.latestDay?.total ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmtMillions(data.latestDay?.total ?? null)}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{data.latestDay?.date ?? '—'}</div>
              </div>
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">7d net</div>
                <div className={`font-mono tabular-nums text-base font-bold ${data.cumulative7d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmtMillions(data.cumulative7d)}
                </div>
              </div>
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">30d net</div>
                <div className={`font-mono tabular-nums text-base font-bold ${data.cumulative30d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmtMillions(data.cumulative30d)}
                </div>
              </div>
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Streak</div>
                <div className="font-mono tabular-nums text-base font-bold text-white">
                  {(() => {
                    let streak = 0;
                    let dir: 1 | -1 | 0 = 0;
                    for (const d of data.days) {
                      const sign = d.total > 0 ? 1 : d.total < 0 ? -1 : 0;
                      if (sign === 0) break;
                      if (dir === 0) dir = sign;
                      if (sign !== dir) break;
                      streak++;
                    }
                    if (streak === 0) return '—';
                    return (
                      <span className={dir === 1 ? 'text-emerald-400' : 'text-rose-400'}>
                        {streak}d {dir === 1 ? <TrendingUp className="inline w-3 h-3" /> : <TrendingDown className="inline w-3 h-3" />}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Bar chart of last 30 days */}
            {chartDays.length > 0 && (
              <div className="card-premium p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white">Last 30 days · daily net flow ($M)</h2>
                  <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" />inflow</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-400" />outflow</span>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-28 border-b border-white/[0.06]">
                  {chartDays.map(d => {
                    const heightPct = Math.abs(d.total) / maxAbs * 95;
                    const isPos = d.total >= 0;
                    return (
                      <div
                        key={d.date}
                        title={`${d.date} · ${fmtMillions(d.total)}`}
                        className="flex-1 flex flex-col justify-end relative group cursor-help"
                      >
                        <div
                          className={`${flowColor(d.total)} rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity`}
                          style={{ height: `${Math.max(2, heightPct)}%`, marginTop: isPos ? 'auto' : 0 }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-neutral-600 font-mono mt-2">
                  <span>{chartDays[0]?.date ?? ''}</span>
                  <span>{chartDays[chartDays.length - 1]?.date ?? ''}</span>
                </div>
              </div>
            )}

            {/* Issuer leaderboard */}
            {issuerTotals.length > 0 && (
              <div className="card-premium p-4 mb-4">
                <h2 className="text-sm font-bold text-white mb-3">Issuer net flow · {data.days.length}-day window</h2>
                <div className="space-y-1">
                  {issuerTotals.map(t => {
                    const maxTotal = Math.max(...issuerTotals.map(x => Math.abs(x.total)));
                    const widthPct = (Math.abs(t.total) / maxTotal) * 100;
                    return (
                      <div key={t.name} className="flex items-center gap-3 text-xs">
                        <span className="text-neutral-300 font-mono w-24 flex-shrink-0">{t.name}</span>
                        <div className="flex-1 relative h-5 bg-white/[0.02] rounded overflow-hidden">
                          <div
                            className={`absolute top-0 bottom-0 ${t.total >= 0 ? 'left-0 bg-emerald-500/30' : 'right-0 bg-rose-500/30'}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className={`font-mono tabular-nums text-xs w-24 text-right ${t.total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fmtMillions(t.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent days table */}
            <div className="card-premium p-3 overflow-x-auto">
              <h2 className="text-sm font-bold text-white mb-2 px-2">Recent daily flows ($M)</h2>
              <div className="grid gap-2" style={{ gridTemplateColumns: `100px repeat(${data.issuers.length}, minmax(60px, 1fr)) 90px` }}>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold py-1.5 px-2 border-b border-white/[0.04]">Date</div>
                {data.issuers.map(name => (
                  <div key={name} className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold text-right py-1.5 px-2 border-b border-white/[0.04]">{name}</div>
                ))}
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold text-right py-1.5 px-2 border-b border-white/[0.04]">Net</div>

                {data.days.slice(0, 14).map(d => (
                  <div key={d.date} className="contents">
                    <div className="text-[11px] text-neutral-300 font-mono py-1.5 px-2">{d.date}</div>
                    {d.perIssuer.map((v, i) => (
                      <div
                        key={i}
                        className={`text-right font-mono text-[11px] tabular-nums py-1.5 px-2 ${
                          v == null ? 'text-neutral-700' : v > 0 ? 'text-emerald-300' : v < 0 ? 'text-rose-300' : 'text-neutral-500'
                        }`}
                      >
                        {v == null ? '—' : fmtMillionsShort(v)}
                      </div>
                    ))}
                    <div className={`text-right font-mono text-[11px] tabular-nums py-1.5 px-2 font-bold ${d.total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtMillionsShort(d.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> All values in millions of USD.
          A positive number = ETF created shares (took in cash, bought spot {asset.toUpperCase()}).
          Negative = redemptions. Daily net flow is one of the cleanest demand
          indicators since the spot ETFs launched. Multi-day inflow streaks
          historically coincide with strong rallies; sustained outflows precede pullbacks.
          Source: <a href="https://farside.co.uk" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">Farside Investors</a>.
          Cached 30 minutes.
        </div>
      </main>
      <Footer />
    </>
  );
}
