'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { GitCompareArrows, RefreshCw, AlertTriangle } from 'lucide-react';

interface DayPoint {
  date: string;
  actualPrice: number;
  counterfactualPrice: number;
  netFlowM: number;
}

interface ApiResponse {
  asset: 'btc' | 'eth';
  impactPerBillion: number;
  fitN: number;
  fitR: number;
  days: DayPoint[];
  latest: { date: string; actualPrice: number; counterfactualPrice: number; gapPct: number } | null;
  dataAvailable?: boolean;
  note?: string;
  ts: number;
}

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number, digits = 2): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export default function EtfCounterfactualPage() {
  const [asset, setAsset] = useState<'btc' | 'eth'>('btc');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/etf-counterfactual?asset=${asset}`, { signal: AbortSignal.timeout(20_000) });
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

  // Build SVG path data for both lines from oldest → newest
  const chart = useMemo(() => {
    if (!data || data.days.length === 0) return null;
    // Reverse so oldest first for charting
    const days = [...data.days].reverse();
    const w = 720;
    const h = 280;
    const pad = { top: 10, right: 10, bottom: 24, left: 50 };
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;

    const allPrices = days.flatMap(d => [d.actualPrice, d.counterfactualPrice]);
    const minP = Math.min(...allPrices) * 0.97;
    const maxP = Math.max(...allPrices) * 1.03;
    const xStep = innerW / Math.max(1, days.length - 1);
    const y = (p: number) => pad.top + innerH - ((p - minP) / (maxP - minP)) * innerH;
    const x = (i: number) => pad.left + i * xStep;

    const actualPath = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.actualPrice).toFixed(1)}`).join(' ');
    const cfPath = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.counterfactualPrice).toFixed(1)}`).join(' ');

    // y-axis ticks: 5 evenly spaced
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const p = minP + (i / 4) * (maxP - minP);
      return { p, y: y(p) };
    });

    return { w, h, pad, actualPath, cfPath, ticks, days, x, y };
  }, [data]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
              <GitCompareArrows className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white">{asset.toUpperCase()} without ETF flows</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              counterfactual model
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
            Where would {asset.toUpperCase()} be trading if spot ETFs hadn&apos;t been bidding?
            We regress daily ETF net flows against daily price returns,
            then strip the flow contribution out and compound the residuals.
            Simple linear model — directional only.
          </p>
        </div>

        {/* Asset toggle */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 mb-4 w-fit">
          {(['btc', 'eth'] as const).map(a => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                asset === a ? 'bg-amber-400 text-black' : 'text-neutral-400 hover:text-white'
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
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Fitting model…</div>
        )}

        {data && data.dataAvailable === false && (
          <div className="card-premium p-6 text-center mb-4">
            <div className="text-base font-bold text-amber-300 mb-2">Model temporarily unavailable</div>
            <p className="text-sm text-neutral-400 mb-3 max-w-md mx-auto">
              {data.note ?? 'Upstream sources unreachable.'}
            </p>
            <a href="/etf-flows" className="text-sm text-hub-yellow hover:underline">View ETF flows directly →</a>
          </div>
        )}

        {data && data.dataAvailable !== false && data.latest && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Actual</div>
              <div className="font-mono tabular-nums text-base font-bold text-white">{fmtUsd(data.latest.actualPrice)}</div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{data.latest.date}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Without ETF flows</div>
              <div className="font-mono tabular-nums text-base font-bold text-amber-300">{fmtUsd(data.latest.counterfactualPrice)}</div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">model estimate</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Gap</div>
              <div className={`font-mono tabular-nums text-base font-bold ${data.latest.gapPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtPct(data.latest.gapPct, 1)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">actual − counterfactual</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Fit quality</div>
              <div className="font-mono tabular-nums text-base font-bold text-white">
                R = {data.fitR.toFixed(2)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{data.fitN} days · {(data.impactPerBillion * 100).toFixed(2)}% / $B</div>
            </div>
          </div>
        )}

        {chart && (
          <div className="card-premium p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">Price · actual vs counterfactual</h2>
              <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-400" />actual
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-400 [stroke-dasharray:3]" />counterfactual
                </span>
              </div>
            </div>
            <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="w-full" preserveAspectRatio="none" style={{ height: 280 }}>
              {/* y axis grid lines */}
              {chart.ticks.map(t => (
                <g key={t.p}>
                  <line
                    x1={chart.pad.left} x2={chart.w - chart.pad.right}
                    y1={t.y} y2={t.y}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth={1}
                  />
                  <text
                    x={chart.pad.left - 6}
                    y={t.y + 3}
                    fill="rgba(255,255,255,0.4)"
                    fontSize={9}
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {fmtUsd(t.p)}
                  </text>
                </g>
              ))}
              {/* counterfactual */}
              <path d={chart.cfPath} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
              {/* actual */}
              <path d={chart.actualPath} stroke="#34d399" strokeWidth={1.75} fill="none" />
            </svg>
            <div className="flex justify-between text-[9px] text-neutral-600 font-mono mt-1">
              <span>{chart.days[0]?.date ?? ''}</span>
              <span>{chart.days[chart.days.length - 1]?.date ?? ''}</span>
            </div>
          </div>
        )}

        {/* Caveat */}
        <div className="p-3 bg-amber-500/[0.04] border border-amber-400/15 rounded-lg text-[11px] text-neutral-400 leading-relaxed flex items-start gap-2 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">Caveat:</strong> this is a deliberately simple
            linear model. It assumes ETF flow impact is constant per $B across the
            window and that all the explanatory power belongs to flows alone. Real
            price moves come from many drivers (macro, on-chain, narrative). Use as
            a directional &quot;what scaled the rally&quot; tool, not a backtest. Higher fit R
            = more confidence the gap is real; R near 0 = noise.
          </div>
        </div>

        <div className="p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">Method:</strong> daily ETF flow ($B) regressed
          on daily {asset.toUpperCase()} return via OLS, no intercept. Counterfactual return =
          actual_return − slope × flow_$B. We compound counterfactual returns
          forward from the start of the window. Sources: <a href="https://farside.co.uk" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">Farside Investors</a> for flows, CoinGecko for daily {asset.toUpperCase()} closes.
        </div>
      </main>
      <Footer />
    </>
  );
}
