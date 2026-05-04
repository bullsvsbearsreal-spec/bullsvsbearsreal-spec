'use client';

/**
 * /cliff-watch — focused view on UPCOMING cliff unlocks ranked by % of supply.
 *
 * Different angle from /token-unlocks (which shows all unlock types in a
 * flat list). Cliff Watch surfaces only cliff-type events in the next
 * 90 days, ordered by impact (% of circulating supply unlocking), so
 * traders can quickly see which dilution events matter and prepare
 * positioning ahead of them.
 *
 * Reuses /api/token-unlocks — no new endpoint.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CalendarClock, RefreshCw, AlertTriangle } from 'lucide-react';

interface UnlockEvent {
  id: string;
  coinId: string;
  coinSymbol: string;
  coinName: string;
  unlockDate: string;
  unlockAmount: number;
  unlockValue: number;
  percentOfSupply: number;
  unlockType: 'cliff' | 'linear' | 'team' | 'investor' | 'ecosystem' | 'treasury';
  description: string;
  isLarge: boolean;
}

interface ApiResponse {
  unlocks?: UnlockEvent[];
  events?: UnlockEvent[];
  data?: UnlockEvent[];
}

const TYPE_TONE: Record<UnlockEvent['unlockType'], string> = {
  cliff: 'bg-rose-500/10 text-rose-400 border-rose-400/20',
  linear: 'bg-amber-500/10 text-amber-400 border-amber-400/20',
  team: 'bg-violet-500/10 text-violet-400 border-violet-400/20',
  investor: 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  ecosystem: 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20',
  treasury: 'bg-cyan-500/10 text-cyan-400 border-cyan-400/20',
};

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtAmount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  return Math.round((target - Date.now()) / 86_400_000);
}

type Window = '7d' | '30d' | '90d';

export default function CliffWatchPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [windowDays, setWindowDays] = useState<Window>('30d');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/token-unlocks', { signal: AbortSignal.timeout(15_000) });
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

  const allUnlocks = useMemo<UnlockEvent[]>(() => {
    if (!data) return [];
    return data.unlocks ?? data.events ?? data.data ?? [];
  }, [data]);

  const filtered = useMemo(() => {
    const horizonDays = windowDays === '7d' ? 7 : windowDays === '30d' ? 30 : 90;
    return allUnlocks
      .filter(u => {
        const d = daysUntil(u.unlockDate);
        return d >= 0 && d <= horizonDays;
      })
      // High-impact first: prefer "cliff" types and large allocations
      .sort((a, b) => {
        // Cliff types first
        const aCliff = a.unlockType === 'cliff' || a.unlockType === 'team' || a.unlockType === 'investor' ? 1 : 0;
        const bCliff = b.unlockType === 'cliff' || b.unlockType === 'team' || b.unlockType === 'investor' ? 1 : 0;
        if (aCliff !== bCliff) return bCliff - aCliff;
        return b.percentOfSupply - a.percentOfSupply;
      });
  }, [allUnlocks, windowDays]);

  const major = filtered.filter(u => u.percentOfSupply >= 1);
  const totalValue = filtered.reduce((s, u) => s + (u.unlockValue || 0), 0);

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-rose-500/10 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-rose-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Cliff Watch</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {filtered.length} events · next {windowDays}
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
            Upcoming token-unlock events ranked by impact (% of circulating supply).
            Cliff + team + investor events surfaced first since they tend to drive
            the biggest sell pressure. Linear + ecosystem unlocks are noted but
            ranked lower because they&apos;ve already been priced in.
          </p>
        </div>

        {/* Window toggle + summary cards */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {(['7d', '30d', '90d'] as const).map(w => (
              <button
                key={w}
                onClick={() => setWindowDays(w)}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${
                  windowDays === w ? 'bg-rose-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Next {w}
              </button>
            ))}
          </div>
          <div className="md:ml-auto flex items-center gap-3 text-[11px] text-neutral-500">
            <span><span className="text-rose-400 font-bold font-mono">{major.length}</span> ≥1% supply</span>
            <span className="text-neutral-700">·</span>
            <span>Total $ unlocking: <span className="text-white font-bold font-mono">{fmtUsd(totalValue)}</span></span>
          </div>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading unlock schedule…</div>
        )}

        {data && filtered.length === 0 && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            No unlock events in the next {windowDays}. Calm waters ahead.
          </div>
        )}

        {filtered.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[100px,90px,1fr,90px,90px,110px,110px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>Date</div>
              <div>Coin</div>
              <div>Description</div>
              <div className="text-right">Type</div>
              <div className="text-right">% Supply</div>
              <div className="text-right">Tokens</div>
              <div className="text-right">$ Value</div>
            </div>
            {filtered.map(u => {
              const days = daysUntil(u.unlockDate);
              const urgent = days <= 7;
              const huge = u.percentOfSupply >= 5;
              return (
                <div
                  key={u.id}
                  className={`grid grid-cols-[100px,90px,1fr,90px,90px,110px,110px] gap-3 px-3 py-2 items-center rounded ${
                    urgent && huge ? 'bg-rose-500/[0.06] border-l-2 border-l-rose-400'
                    : urgent ? 'bg-amber-500/[0.04] border-l-2 border-l-amber-400'
                    : huge ? 'bg-rose-500/[0.03] border-l border-l-rose-400/30'
                    : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div>
                    <div className="text-xs text-white font-mono font-bold">
                      {new Date(u.unlockDate).toISOString().slice(0, 10)}
                    </div>
                    <div className={`text-[10px] font-mono ${urgent ? 'text-amber-300 font-bold' : 'text-neutral-500'}`}>
                      {days === 0 ? 'today' : `+${days}d`}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-bold truncate">{u.coinSymbol}</div>
                    <div className="text-[10px] text-neutral-600 truncate">{u.coinName}</div>
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{u.description}</div>
                  <div className="text-right">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded border ${TYPE_TONE[u.unlockType]}`}>
                      {u.unlockType}
                    </span>
                  </div>
                  <div className={`text-right font-mono text-sm tabular-nums ${
                    huge ? 'text-rose-400 font-bold inline-flex items-center justify-end gap-1'
                    : u.percentOfSupply >= 1 ? 'text-rose-300 font-semibold'
                    : 'text-neutral-300'
                  }`}>
                    {huge && <AlertTriangle className="w-3 h-3" />}
                    {u.percentOfSupply.toFixed(2)}%
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                    {fmtAmount(u.unlockAmount)}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-white font-semibold">
                    {fmtUsd(u.unlockValue)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> red rows
          flag &gt;5% supply unlocks within 7 days — historically the worst
          combination for spot price. Cliff and team-investor unlocks tend to
          hit harder than ecosystem/treasury since the recipients are typically
          ready to sell. Linear vesting events are listed but mostly already
          priced in. Source: <a href="/token-unlocks" className="text-hub-yellow hover:underline">/token-unlocks</a>
          {' '}with the same data, different angle.
        </div>
      </main>
      <Footer />
    </>
  );
}
