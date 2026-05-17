'use client';

/**
 * Hash Ribbons — classic Charles Edwards miner-capitulation indicator
 * Plots 30d & 60d MA of BTC hash rate. Crossings mark capitulation
 * (30d crosses below 60d) and recovery (30d crosses back above), the
 * latter being the historical buy signal.
 *
 * Reuses the existing /api/onchain endpoint (already hits blockchain.info
 * for hash-rate history). No new endpoint needed.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Cpu, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';

interface HistoryPoint { time: number; value: number }
interface OnchainResp {
  hashRate: { current: number; history: HistoryPoint[]; change30d?: number | null };
}

interface DayPoint {
  date: string;
  hashTH: number;
  ma30: number | null;
  ma60: number | null;
}

function rollingMean(arr: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= window) sum -= arr[i - window];
    if (i >= window - 1) out.push(sum / window);
    else out.push(null);
  }
  return out;
}

function fmtHash(thps: number): string {
  // input is TH/s; convert to EH/s for display
  const eh = thps / 1e6;
  if (eh >= 1000) return `${(eh / 1000).toFixed(1)} ZH/s`;
  return `${eh.toFixed(0)} EH/s`;
}

export default function HashRibbonsPage() {
  const [data, setData] = useState<OnchainResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/onchain', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as OnchainResp;
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

  // Derive ribbons + signal state
  const computed = useMemo(() => {
    if (!data?.hashRate?.history || data.hashRate.history.length < 60) return null;
    const series = [...data.hashRate.history].sort((a, b) => a.time - b.time);
    const values = series.map(p => p.value);
    const ma30 = rollingMean(values, 30);
    const ma60 = rollingMean(values, 60);
    const points: DayPoint[] = series.map((p, i) => ({
      date: new Date(p.time * 1000).toISOString().slice(0, 10),
      hashTH: p.value,
      ma30: ma30[i],
      ma60: ma60[i],
    }));

    // Find latest cross — when 30d went below 60d (capitulation start) and last
    // time it crossed back above (recovery / buy signal).
    let inCapitulation = false;
    let lastCapitulationStart: string | null = null;
    let lastRecoveryDate: string | null = null;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      if (prev.ma30 == null || prev.ma60 == null || cur.ma30 == null || cur.ma60 == null) continue;
      const wasAbove = prev.ma30 >= prev.ma60;
      const nowAbove = cur.ma30 >= cur.ma60;
      if (wasAbove && !nowAbove) {
        // 30d crossed below 60d — capitulation begins
        inCapitulation = true;
        lastCapitulationStart = cur.date;
      } else if (!wasAbove && nowAbove) {
        // 30d crossed above 60d — recovery / historical buy signal
        inCapitulation = false;
        lastRecoveryDate = cur.date;
      }
    }
    const latest = points[points.length - 1];
    return { points, inCapitulation, lastCapitulationStart, lastRecoveryDate, latest };
  }, [data]);

  // SVG chart bits
  const chart = useMemo(() => {
    if (!computed) return null;
    const pts = computed.points;
    const w = 760;
    const h = 320;
    const pad = { top: 12, right: 12, bottom: 26, left: 56 };
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;
    const allValues: number[] = [];
    for (const p of pts) {
      allValues.push(p.hashTH);
      if (p.ma30 != null) allValues.push(p.ma30);
      if (p.ma60 != null) allValues.push(p.ma60);
    }
    const minV = Math.min(...allValues) * 0.97;
    const maxV = Math.max(...allValues) * 1.03;
    const xStep = innerW / Math.max(1, pts.length - 1);
    const x = (i: number) => pad.left + i * xStep;
    const y = (v: number) => pad.top + innerH - ((v - minV) / (maxV - minV)) * innerH;

    const linePath = (key: 'hashTH' | 'ma30' | 'ma60') => {
      let d = '';
      let started = false;
      pts.forEach((p, i) => {
        const v = p[key];
        if (v == null) return;
        const cmd = started ? 'L' : 'M';
        d += `${cmd} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
        started = true;
      });
      return d.trim();
    };

    // Shade under regions where ma30 < ma60 (capitulation zones)
    const zones: { startX: number; endX: number }[] = [];
    let zoneStart: number | null = null;
    pts.forEach((p, i) => {
      const ma30 = p.ma30, ma60 = p.ma60;
      if (ma30 == null || ma60 == null) return;
      if (ma30 < ma60 && zoneStart == null) zoneStart = i;
      else if (ma30 >= ma60 && zoneStart != null) {
        zones.push({ startX: x(zoneStart), endX: x(i) });
        zoneStart = null;
      }
    });
    if (zoneStart != null) zones.push({ startX: x(zoneStart), endX: x(pts.length - 1) });

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const v = minV + (i / 4) * (maxV - minV);
      return { v, y: y(v) };
    });

    return {
      w, h, pad,
      pricePath: linePath('hashTH'),
      ma30Path: linePath('ma30'),
      ma60Path: linePath('ma60'),
      zones,
      ticks,
      pts,
    };
  }, [computed]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Cpu}
          eyebrow="On-chain · miner cycle"
          title="Hash"
          accentNoun="ribbons"
          accent="orange"
          description={
            <>Charles Edwards&apos; miner-capitulation indicator. When the
              <span className="text-white"> 30-day</span> hash-rate average crosses below the
              <span className="text-white"> 60-day</span>, weak miners are unplugging. The
              <em> recovery cross</em> (30d back above 60d) is the historical buy
              signal — it has marked most BTC cycle bottoms since 2013.</>
          }
          actions={
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/[0.08] text-xs font-semibold transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        />

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading hash rate history…</div>
        )}

        {/* Signal cards */}
        {computed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Status</div>
              <div className={`font-mono text-sm font-bold inline-flex items-center gap-1.5 ${computed.inCapitulation ? 'text-rose-400' : 'text-emerald-400'}`}>
                {computed.inCapitulation ? <AlertTriangle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                {computed.inCapitulation ? 'Capitulation' : 'Healthy'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {computed.inCapitulation ? '30d MA < 60d MA' : '30d MA ≥ 60d MA'}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Latest hash</div>
              <div className="font-mono text-sm font-bold text-white">{fmtHash(computed.latest.hashTH)}</div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{computed.latest.date}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Last capitulation</div>
              <div className="font-mono text-sm font-bold text-rose-300">
                {computed.lastCapitulationStart ?? '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">30d crossed below 60d</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Last recovery</div>
              <div className="font-mono text-sm font-bold text-emerald-300">
                {computed.lastRecoveryDate ?? '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">historical buy signal</div>
            </div>
          </div>
        )}

        {/* Chart */}
        {chart && (
          <div className="card-premium p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">Hash rate · last {chart.pts.length} days</h2>
              <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-neutral-500" />daily</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400" />30d MA</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400" />60d MA</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 bg-rose-500/20 border border-rose-400/40" />capitulation zone</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="w-full" preserveAspectRatio="none" style={{ height: 320 }}>
              {/* Capitulation zones */}
              {chart.zones.map((z, i) => (
                <rect
                  key={i}
                  x={z.startX} y={chart.pad.top}
                  width={z.endX - z.startX}
                  height={chart.h - chart.pad.top - chart.pad.bottom}
                  fill="rgba(244,63,94,0.08)"
                  stroke="rgba(244,63,94,0.18)"
                  strokeWidth={1}
                />
              ))}
              {/* y-axis grid */}
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
                    {fmtHash(t.v)}
                  </text>
                </g>
              ))}
              {/* daily line */}
              <path d={chart.pricePath} stroke="rgba(255,255,255,0.35)" strokeWidth={1} fill="none" />
              {/* 60d MA */}
              <path d={chart.ma60Path} stroke="#60a5fa" strokeWidth={1.5} fill="none" />
              {/* 30d MA */}
              <path d={chart.ma30Path} stroke="#34d399" strokeWidth={1.75} fill="none" />
            </svg>
            <div className="flex justify-between text-[9px] text-neutral-600 font-mono mt-1">
              <span>{chart.pts[0]?.date}</span>
              <span>{chart.pts[chart.pts.length - 1]?.date}</span>
            </div>
          </div>
        )}

        <div className="p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to trade it:</strong> the buy signal is
          NOT the start of capitulation — it&apos;s the recovery cross AFTER capitulation
          (30d MA flips back above 60d MA). Historically that has been within a few
          weeks of the cycle low. False signals exist (2018-09, 2019-12). Best paired
          with the Puell Multiple and MVRV-Z on <a href="/onchain" className="text-hub-yellow hover:underline">/onchain</a>.
          Source: blockchain.info hash-rate chart, daily resolution.
        </div>
      </main>
      <Footer />
    </>
  );
}
