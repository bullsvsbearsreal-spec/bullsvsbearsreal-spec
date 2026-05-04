'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { PieChart, RefreshCw, TrendingUp } from 'lucide-react';

interface DayPoint {
  date: string;
  cexVolumeUsd: number;
  dexVolumeUsd: number;
  totalVolumeUsd: number;
  dexSharePct: number;
}

interface ApiResponse {
  days: DayPoint[];
  latest: { dexSharePct: number; cexVolumeUsd: number; dexVolumeUsd: number; totalVolumeUsd: number; date: string } | null;
  avg30dDexShare: number | null;
  ts: number;
}

function fmtUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

export default function VolumeSharePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/volume-share', { signal: AbortSignal.timeout(20_000) });
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
    const id = setInterval(() => load(true), 60 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const chart = useMemo(() => {
    if (!data || data.days.length === 0) return null;
    const days = data.days;
    const w = 760;
    const h = 240;
    const pad = { top: 10, right: 10, bottom: 24, left: 50 };
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;
    // Y-axis 0–100
    const xStep = innerW / Math.max(1, days.length - 1);
    const x = (i: number) => pad.left + i * xStep;
    const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;
    const path = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.dexSharePct).toFixed(1)}`).join(' ');
    const ticks = [0, 25, 50, 75, 100].map(v => ({ v, y: y(v) }));
    return { w, h, pad, path, ticks, days, x };
  }, [data]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-teal-500/10 flex items-center justify-center">
              <PieChart className="w-4 h-4 text-teal-400" />
            </div>
            <h1 className="text-xl font-bold text-white">CEX vs DEX Volume Share</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              30-day · spot
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
            DEX share of total spot trading volume. Rising DEX share = on-chain
            trading gaining ground (typically alt-season indicator). Falling
            share = activity migrating back to centralized venues.
          </p>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Aggregating volumes…</div>
        )}

        {data && data.latest && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">DEX share today</div>
              <div className="font-mono tabular-nums text-base font-bold text-emerald-400">{data.latest.dexSharePct.toFixed(1)}%</div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{data.latest.date}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">30d avg DEX share</div>
              <div className="font-mono tabular-nums text-base font-bold text-white">{(data.avg30dDexShare ?? 0).toFixed(1)}%</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">DEX vol</div>
              <div className="font-mono tabular-nums text-base font-bold text-emerald-400">{fmtUsd(data.latest.dexVolumeUsd)}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">CEX vol (est)</div>
              <div className="font-mono tabular-nums text-base font-bold text-cyan-400">{fmtUsd(data.latest.cexVolumeUsd)}</div>
            </div>
          </div>
        )}

        {chart && (
          <div className="card-premium p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">DEX share % · last 30 days</h2>
              <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
                <TrendingUp className="w-3 h-3" />
                Higher = more on-chain
              </span>
            </div>
            <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="w-full" preserveAspectRatio="none" style={{ height: 240 }}>
              {chart.ticks.map(t => (
                <g key={t.v}>
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
                    {t.v}%
                  </text>
                </g>
              ))}
              <path d={chart.path} stroke="#34d399" strokeWidth={1.75} fill="none" />
              {/* Subtle area fill */}
              <path
                d={`${chart.path} L ${chart.x(chart.days.length - 1).toFixed(1)} ${(chart.h - chart.pad.bottom).toFixed(1)} L ${chart.pad.left} ${(chart.h - chart.pad.bottom).toFixed(1)} Z`}
                fill="rgba(52,211,153,0.06)"
              />
            </svg>
            <div className="flex justify-between text-[9px] text-neutral-600 font-mono mt-1">
              <span>{chart.days[0]?.date}</span>
              <span>{chart.days[chart.days.length - 1]?.date}</span>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-amber-500/[0.04] border border-amber-400/15 rounded-lg text-[11px] text-neutral-400 leading-relaxed">
          <strong className="text-amber-300">Methodology note:</strong> DEX side
          comes from DefiLlama&apos;s daily aggregate (high fidelity, daily resolution).
          CEX side is back-estimated from CoinGecko&apos;s global volume minus DEX —
          approximation, since the free CoinGecko tier doesn&apos;t expose a
          per-day-CEX-only timeseries. Shape is directionally accurate;
          magnitudes are coarse.
        </div>
      </main>
      <Footer />
    </>
  );
}
