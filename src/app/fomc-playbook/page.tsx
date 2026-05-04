'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Building, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface MeetingResult {
  date: string;
  decision?: string;
  isPast: boolean;
  daysUntil: number;
  priceBefore: number | null;
  priceAfter: number | null;
  reactionPct: number | null;
}

interface ApiResponse {
  meetings: MeetingResult[];
  next: MeetingResult | null;
  past: MeetingResult[];
  averageReaction: number | null;
  ts: number;
}

function fmtPct(n: number | null, digits = 2): string {
  if (n == null) return '—';
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function fmtUsd(n: number | null): string {
  if (n == null) return '—';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function reactionTone(n: number | null): string {
  if (n == null) return 'text-neutral-500';
  if (n > 0.03) return 'text-emerald-400 font-bold';
  if (n > 0) return 'text-emerald-300';
  if (n > -0.03) return 'text-rose-300';
  return 'text-rose-400 font-bold';
}

export default function FomcPlaybookPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/fomc-playbook', { signal: AbortSignal.timeout(20_000) });
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
    const id = setInterval(() => load(true), 6 * 60 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
              <Building className="w-4 h-4 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white">FOMC Playbook</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {data?.past.length ?? 0} past · {data?.meetings.filter(m => !m.isPast).length ?? 0} upcoming
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
            BTC reaction to past FOMC rate decisions, plus countdown to the next
            meeting. Reaction = (price 24h after decision − price at decision) / price at decision.
            Meetings publish at 14:00 ET (≈ 18:00 UTC).
          </p>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading FOMC reactions…</div>
        )}

        {data?.next && (
          <div className="card-premium p-4 mb-4 border-l-4 border-l-blue-400">
            <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1">Next meeting</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-2xl font-bold text-white font-mono">{data.next.date}</div>
              <div className="text-sm text-neutral-400 font-mono">
                {data.next.daysUntil <= 0 ? 'today' : `${data.next.daysUntil} days away`}
              </div>
              {data.averageReaction != null && (
                <div className="text-xs text-neutral-500 ml-auto">
                  Historical avg 24h reaction:{' '}
                  <span className={`font-mono font-bold ${reactionTone(data.averageReaction)}`}>
                    {fmtPct(data.averageReaction)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {data && data.past.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <h2 className="text-sm font-bold text-white mb-2 px-1">Past meetings · BTC 24h reaction</h2>
            <div className="grid grid-cols-[110px,1fr,110px,110px,110px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>Date</div>
              <div>Decision</div>
              <div className="text-right">Pre</div>
              <div className="text-right">Post</div>
              <div className="text-right">24h Δ</div>
              <div></div>
            </div>
            {data.past.map(m => (
              <div
                key={m.date}
                className="grid grid-cols-[110px,1fr,110px,110px,110px,1fr] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02]"
              >
                <div className="text-sm text-white font-mono font-bold">{m.date}</div>
                <div className="text-xs text-neutral-300">{m.decision ?? '—'}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtUsd(m.priceBefore)}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtUsd(m.priceAfter)}</div>
                <div className={`text-right font-mono text-sm font-bold tabular-nums ${reactionTone(m.reactionPct)}`}>
                  {fmtPct(m.reactionPct)}
                  {m.reactionPct != null && (m.reactionPct > 0
                    ? <TrendingUp className="w-3 h-3 inline-block ml-1" />
                    : <TrendingDown className="w-3 h-3 inline-block ml-1" />
                  )}
                </div>
                <div className="text-[10px] text-neutral-600">
                  {m.reactionPct != null && Math.abs(m.reactionPct) > 0.05 && (
                    <span className={m.reactionPct > 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}>
                      Outsized move
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> the 24h reaction
          is BTC&apos;s price change from the start of the FOMC announcement day to
          24h later — captures both the initial reaction and the overnight follow-through.
          Hawkish surprises typically trade negative for ~24-48h before recovery;
          dovish surprises rip immediately. Source: CoinGecko daily closes,
          curated FOMC date list.
        </div>
      </main>
      <Footer />
    </>
  );
}
