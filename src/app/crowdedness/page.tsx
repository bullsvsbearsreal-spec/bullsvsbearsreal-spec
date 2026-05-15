'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Users2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface SignalScore {
  raw: number | null;
  score: number | null;
  side: 'long' | 'short' | 'balanced';
  reading: string;
}

interface CrowdRow {
  symbol: string;
  composite: number | null;
  crowdSide: 'long' | 'short' | 'balanced';
  funding: SignalScore;
  oiMomentum: SignalScore;
  longShortRatio: SignalScore;
  markPrice: number | null;
}

interface ApiResponse {
  rows: CrowdRow[];
  ts: number;
}

function scoreColor(score: number | null, side: 'long' | 'short' | 'balanced'): string {
  if (score == null) return 'rgba(255,255,255,0.05)';
  // High score on long side = red (overheated), high on short side = green (squeeze fuel)
  const intensity = Math.min(0.45, score / 100 * 0.45);
  if (side === 'long') return `rgba(244,63,94,${intensity.toFixed(3)})`;
  if (side === 'short') return `rgba(34,197,94,${intensity.toFixed(3)})`;
  return `rgba(255,255,255,${(intensity * 0.5).toFixed(3)})`;
}

function fmtPct(n: number | null, digits = 2): string {
  if (n == null) return '—';
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function fmtRatio(n: number | null): string {
  if (n == null) return '—';
  return n.toFixed(2);
}

function compositeBadge(composite: number | null, side: 'long' | 'short' | 'balanced'): { label: string; tone: string } {
  if (composite == null) return { label: '—', tone: 'bg-neutral-700/30 text-neutral-400 border-neutral-600/40' };
  if (composite >= 70) {
    return side === 'long'
      ? { label: 'Crowded long · fade fuel', tone: 'bg-rose-500/15 text-rose-300 border-rose-400/40' }
      : side === 'short'
      ? { label: 'Crowded short · squeeze fuel', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' }
      : { label: 'High vol · mixed', tone: 'bg-amber-500/15 text-amber-300 border-amber-400/40' };
  }
  if (composite >= 40) {
    return side === 'long'
      ? { label: 'Leaning long', tone: 'bg-rose-500/[0.06] text-rose-300 border-rose-400/20' }
      : side === 'short'
      ? { label: 'Leaning short', tone: 'bg-emerald-500/[0.06] text-emerald-300 border-emerald-400/20' }
      : { label: 'Mixed', tone: 'bg-white/[0.04] text-neutral-300 border-white/[0.08]' };
  }
  return { label: 'Balanced', tone: 'bg-white/[0.03] text-neutral-400 border-white/[0.06]' };
}

export default function CrowdednessPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/crowdedness', { signal: AbortSignal.timeout(45_000) });
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
    const id = setInterval(() => load(true), 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const crowdedLong = data?.rows.filter(r => (r.composite ?? 0) >= 70 && r.crowdSide === 'long') ?? [];
  const crowdedShort = data?.rows.filter(r => (r.composite ?? 0) >= 70 && r.crowdSide === 'short') ?? [];

  return (
    <>
      <Header />
      <main className="max-w-[1300px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Users2}
          eyebrow={`Positioning · ${data?.rows.length ?? 0} coins · 0–100 scale`}
          title="Crowdedness"
          accentNoun="index"
          accent="pink"
          description={
            <>Per-coin positioning crowdedness. Combines funding-rate magnitude,
              7-day OI momentum, and Binance long/short ratio into one 0–100 score.
              <span className="text-white"> Above 70 + long bias = crowded long, fade fuel.</span>{' '}
              Above 70 + short bias = squeeze fuel. Below 30 = balanced.</>
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

        {/* Summary cards */}
        {data && data.rows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-rose-400" /> Crowded long · fade candidates
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-rose-400">{crowdedLong.length}</div>
              <div className="text-[10px] text-neutral-500 mt-1 truncate">
                {crowdedLong.slice(0, 5).map(r => r.symbol).join(' · ') || 'none'}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-emerald-400" /> Crowded short · squeeze candidates
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-emerald-400">{crowdedShort.length}</div>
              <div className="text-[10px] text-neutral-500 mt-1 truncate">
                {crowdedShort.slice(0, 5).map(r => r.symbol).join(' · ') || 'none'}
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
            Sampling positioning across coins (~10s)…
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[80px,90px,100px,140px,140px,140px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>Symbol</div>
              <div className="text-right">Score</div>
              <div className="text-right">Side</div>
              <div className="text-right">Funding</div>
              <div className="text-right">OI 7d</div>
              <div className="text-right">L/S ratio</div>
              <div>Verdict</div>
            </div>
            {data.rows.map(r => {
              const badge = compositeBadge(r.composite, r.crowdSide);
              return (
                <div
                  key={r.symbol}
                  className="grid grid-cols-[80px,90px,100px,140px,140px,140px,1fr] gap-3 px-3 py-2 items-center rounded transition-colors"
                  style={{ background: scoreColor(r.composite, r.crowdSide) }}
                >
                  <div className="text-sm text-white font-bold">{r.symbol}</div>
                  <div className={`text-right font-mono text-base font-bold tabular-nums ${
                    (r.composite ?? 0) >= 70 ? 'text-white'
                    : (r.composite ?? 0) >= 40 ? 'text-neutral-200'
                    : 'text-neutral-500'
                  }`}>
                    {r.composite ?? '—'}
                  </div>
                  <div className={`text-right text-xs font-mono uppercase tracking-wider font-bold ${
                    r.crowdSide === 'long' ? 'text-rose-300'
                    : r.crowdSide === 'short' ? 'text-emerald-300'
                    : 'text-neutral-500'
                  }`}>
                    {r.crowdSide}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${
                    r.funding.side === 'long' ? 'text-rose-300'
                    : r.funding.side === 'short' ? 'text-emerald-300'
                    : 'text-neutral-400'
                  }`}>
                    {fmtPct(r.funding.raw, 4)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${
                    (r.oiMomentum.raw ?? 0) > 0.1 ? 'text-amber-300'
                    : (r.oiMomentum.raw ?? 0) < -0.1 ? 'text-blue-300'
                    : 'text-neutral-400'
                  }`}>
                    {fmtPct(r.oiMomentum.raw, 1)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${
                    (r.longShortRatio.raw ?? 1) > 1.3 ? 'text-rose-300'
                    : (r.longShortRatio.raw ?? 1) < 0.77 ? 'text-emerald-300'
                    : 'text-neutral-400'
                  }`}>
                    {fmtRatio(r.longShortRatio.raw)}
                  </div>
                  <div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${badge.tone}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to use it:</strong> when you see a coin
          scoring 70+ on the long side, the trade is crowded — funding is high, OI is
          ballooning, and retail is piled in. That&apos;s usually fade fuel. Crowded short
          is the opposite — short squeezes form here. <strong>Caveat:</strong> crowded
          can stay crowded longer than your stops survive. Pair this with{' '}
          <a href="/cycle-phase" className="text-hub-yellow hover:underline">/cycle-phase</a> for
          regime context. Sources: Binance USDT-M Futures public endpoints (premiumIndex,
          openInterestHist, globalLongShortAccountRatio). Cached 5 minutes.
        </div>
      </main>
      <Footer />
    </>
  );
}
