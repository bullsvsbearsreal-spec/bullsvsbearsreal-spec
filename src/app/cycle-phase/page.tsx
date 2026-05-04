'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Compass, RefreshCw, Activity } from 'lucide-react';

interface SignalReading {
  name: string;
  value: number | null;
  score: number | null;
  reading: string;
}

interface ApiResponse {
  composite: number | null;
  phase: 'Capitulation' | 'Accumulation' | 'Recovery' | 'Bull' | 'Euphoria' | 'Unknown';
  confidence: number;
  signals: {
    hashRibbons: SignalReading;
    puell: SignalReading;
    mvrv: SignalReading;
    funding: SignalReading;
    sma200: SignalReading;
  };
  underlying: { btcPrice: number | null; sma200: number | null };
  ts: number;
}

const PHASE_TONES: Record<ApiResponse['phase'], { bg: string; text: string; border: string; description: string }> = {
  Capitulation: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-400/30', description: 'Historical buy zone — sentiment + on-chain signals deeply oversold.' },
  Accumulation: { bg: 'bg-emerald-500/[0.06]', text: 'text-emerald-200', border: 'border-emerald-400/20', description: 'Smart money accumulating — fundamentals improving but price hasn\'t reflected yet.' },
  Recovery:     { bg: 'bg-cyan-500/[0.06]', text: 'text-cyan-300', border: 'border-cyan-400/20', description: 'Trend turning — early bull markers with limited overheating.' },
  Bull:         { bg: 'bg-amber-500/[0.06]', text: 'text-amber-300', border: 'border-amber-400/30', description: 'Bull market in progress — risk-on but watch for late-cycle signals.' },
  Euphoria:     { bg: 'bg-rose-500/[0.08]', text: 'text-rose-300', border: 'border-rose-400/40', description: 'Late-cycle euphoria — multiple top signals firing. Historical reversal zone.' },
  Unknown:      { bg: 'bg-white/[0.04]', text: 'text-neutral-400', border: 'border-white/[0.08]', description: 'Insufficient data to determine phase.' },
};

function scoreTone(score: number | null): string {
  if (score == null) return 'text-neutral-500';
  if (score >= 1) return 'text-emerald-400 font-bold';
  if (score > 0) return 'text-emerald-300';
  if (score === 0) return 'text-neutral-300';
  if (score > -1) return 'text-rose-300';
  return 'text-rose-400 font-bold';
}

function scoreLabel(score: number | null): string {
  if (score == null) return '—';
  if (score === 2) return 'Strong bull';
  if (score === 1) return 'Mild bull';
  if (score === 0) return 'Neutral';
  if (score === -1) return 'Mild bear';
  if (score === -2) return 'Strong bear';
  return score.toFixed(1);
}

function fmtValue(name: string, v: number | null): string {
  if (v == null) return '—';
  switch (name) {
    case 'Hash Ribbons': return `${v.toFixed(3)}× (30d/60d)`;
    case 'Puell Multiple': return v.toFixed(2);
    case 'MVRV': return v.toFixed(2);
    case 'Funding regime': return `${(v * 100).toFixed(4)}%`;
    case 'Price vs 200d SMA': return `${v.toFixed(2)}× (price/SMA)`;
    default: return v.toFixed(2);
  }
}

export default function CyclePhasePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/cycle-phase', { signal: AbortSignal.timeout(20_000) });
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

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Compass className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white">BTC Cycle Phase</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              composite of 5 signals
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
            Where in the cycle are we? Synthesizes Hash Ribbons + Puell Multiple
            + MVRV Z-score + funding regime + price-vs-200d-SMA into a single
            phase tag. Each signal scored independently; composite averaged
            with confidence based on signal availability.
          </p>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Synthesizing cycle signals…</div>
        )}

        {data && (
          <>
            {/* Headline phase card */}
            {(() => {
              const tone = PHASE_TONES[data.phase];
              return (
                <div className={`card-premium p-6 mb-4 border-2 ${tone.border} ${tone.bg}`}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-1">Current phase</div>
                      <div className={`text-4xl font-bold tracking-tight ${tone.text}`}>{data.phase}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1">Composite score</div>
                      <div className="text-3xl font-mono font-bold text-white">
                        {data.composite != null ? (data.composite > 0 ? '+' : '') + data.composite.toFixed(2) : '—'}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                        confidence {data.confidence}%
                      </div>
                    </div>
                  </div>
                  <p className={`text-sm ${tone.text} opacity-90`}>{tone.description}</p>
                </div>
              );
            })()}

            {/* Per-signal breakdown */}
            <div className="card-premium p-3 mb-4">
              <h2 className="text-sm font-bold text-white mb-2 px-1">Signal breakdown</h2>
              {(['hashRibbons', 'puell', 'mvrv', 'funding', 'sma200'] as const).map(key => {
                const s = data.signals[key];
                return (
                  <div key={key} className="grid grid-cols-[180px,140px,110px,1fr] gap-3 px-3 py-2 items-center border-b border-white/[0.03] last:border-b-0">
                    <div className="text-sm text-white font-bold">{s.name}</div>
                    <div className="text-xs text-neutral-300 font-mono">{fmtValue(s.name, s.value)}</div>
                    <div className={`text-xs font-mono ${scoreTone(s.score)}`}>
                      {scoreLabel(s.score)}
                    </div>
                    <div className="text-xs text-neutral-500 italic">{s.reading}</div>
                  </div>
                );
              })}
            </div>

            {/* Phase scale */}
            <div className="card-premium p-4 mb-4">
              <h2 className="text-sm font-bold text-white mb-3">Phase scale</h2>
              <div className="relative h-7 rounded overflow-hidden flex">
                <div className="flex-1 bg-emerald-500/30 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-emerald-200">Capitulation</div>
                <div className="flex-1 bg-emerald-500/15 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-emerald-200">Accumulation</div>
                <div className="flex-1 bg-cyan-500/15 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-cyan-200">Recovery</div>
                <div className="flex-1 bg-amber-500/15 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-amber-200">Bull</div>
                <div className="flex-1 bg-rose-500/30 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-rose-200">Euphoria</div>
                {data.composite != null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    style={{
                      // Map composite [-2, 2] → 0-100% of bar
                      left: `${Math.max(0, Math.min(100, ((2 - data.composite) / 4) * 100))}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[9px] text-neutral-600 font-mono mt-1">
                <span>+2.0 (deep bear)</span>
                <span>0.0 (neutral)</span>
                <span>−2.0 (peak euphoria)</span>
              </div>
            </div>

            {/* Underlying refs */}
            {(data.underlying.btcPrice != null || data.underlying.sma200 != null) && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="card-premium p-3">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">BTC price</div>
                  <div className="font-mono text-base font-bold text-white">
                    {data.underlying.btcPrice != null ? `$${data.underlying.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                  </div>
                </div>
                <div className="card-premium p-3">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">200-day SMA</div>
                  <div className="font-mono text-base font-bold text-white">
                    {data.underlying.sma200 != null ? `$${data.underlying.sma200.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">Methodology:</strong> each signal scored
          on [-2, +2] scale where positive = bullish (buy zone) and negative = bearish
          (top warning). Composite averages the signals, weighted equally. Phase tag
          maps composite to one of 5 buckets. None of these signals is perfect alone
          — but historically when 4+ agree, that&apos;s a high-conviction read.
          Sources: <a href="/onchain" className="text-hub-yellow hover:underline">/onchain</a>{' '}
          (hash rate / Puell / MVRV) · Binance funding history · Binance daily klines.
          Updated every 30 minutes. <span className="inline-flex items-center gap-1 ml-1"><Activity className="w-3 h-3" />Not financial advice.</span>
        </div>
      </main>
      <Footer />
    </>
  );
}
