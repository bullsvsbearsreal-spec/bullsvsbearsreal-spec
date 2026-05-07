'use client';

/**
 * /earnings-calendar — unified crypto event feed.
 *
 * Aggregates token unlocks + TGEs + halvings + governance votes into one
 * timeline grouped by week. Filter chips by event type. Sort by date.
 */
import { useEffect, useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Calendar, Filter, ExternalLink, Lock, Rocket, Vote, Sparkles, RefreshCw } from 'lucide-react';

interface EarningsEvent {
  id: string;
  type: 'unlock' | 'tge' | 'halving' | 'governance' | 'mainnet';
  date: string;
  daysFromNow: number;
  symbol: string | null;
  name: string;
  description: string;
  usdImpact: number | null;
  source: string;
  url?: string;
}

interface ApiResponse {
  ts: number;
  events: EarningsEvent[];
  summary: {
    next7Days: number;
    next30Days: number;
    totalUsdImpact7d: number;
    biggestUpcoming: EarningsEvent | null;
  };
}

const TYPE_ICON = {
  unlock:    Lock,
  tge:       Rocket,
  halving:   Sparkles,
  governance: Vote,
  mainnet:   Rocket,
} as const;

const TYPE_TONE = {
  unlock:    'text-amber-300 bg-amber-500/15 border-amber-400/30',
  tge:       'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',
  halving:   'text-orange-300 bg-orange-500/15 border-orange-400/30',
  governance: 'text-purple-300 bg-purple-500/15 border-purple-400/30',
  mainnet:   'text-sky-300 bg-sky-500/15 border-sky-400/30',
} as const;

const TYPE_LABEL = {
  unlock: 'Token unlock',
  tge: 'TGE',
  halving: 'Halving',
  governance: 'Governance',
  mainnet: 'Mainnet',
} as const;

const fmtUsd = (n: number | null): string => {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
};

function formatDay(daysFromNow: number, dateStr: string): string {
  if (daysFromNow === 0) return 'today';
  if (daysFromNow === 1) return 'tomorrow';
  if (daysFromNow < 0) return `${Math.abs(daysFromNow)}d ago`;
  if (daysFromNow <= 14) return `in ${daysFromNow}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FILTER_TYPES: Array<EarningsEvent['type'] | 'all'> = ['all', 'unlock', 'tge', 'governance', 'halving'];

export default function EarningsCalendarPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | EarningsEvent['type']>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/earnings-calendar', { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.events;
    return data.events.filter(e => e.type === filter);
  }, [data, filter]);

  // Group by ISO week start (Monday) for visual sectioning.
  const grouped = useMemo(() => {
    const buckets = new Map<string, EarningsEvent[]>();
    for (const e of filtered) {
      const d = new Date(e.date);
      const day = d.getUTCDay() || 7; // Mon=1..Sun=7
      d.setUTCDate(d.getUTCDate() - day + 1);
      const weekStart = d.toISOString().slice(0, 10);
      const arr = buckets.get(weekStart) ?? [];
      arr.push(e);
      buckets.set(weekStart, arr);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, unlock: 0, tge: 0, halving: 0, governance: 0, mainnet: 0 };
    return data.events.reduce((acc, e) => {
      acc.all = (acc.all ?? 0) + 1;
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, { all: 0, unlock: 0, tge: 0, halving: 0, governance: 0, mainnet: 0 } as Record<string, number>);
  }, [data]);

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-hub-yellow" />
              <h1 className="text-2xl font-bold text-white">Crypto Earnings Calendar</h1>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              Every protocol event that moves price — token unlocks, TGEs, BTC halving, active governance votes — in one timeline.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
          </button>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <SummaryCell label="Next 7 days" value={data.summary.next7Days.toLocaleString()} />
            <SummaryCell label="Next 30 days" value={data.summary.next30Days.toLocaleString()} />
            <SummaryCell label="Unlocks impact 7d" value={fmtUsd(data.summary.totalUsdImpact7d)} valueColor="text-amber-400" />
            <SummaryCell
              label="Biggest upcoming"
              value={data.summary.biggestUpcoming
                ? `${data.summary.biggestUpcoming.symbol ?? data.summary.biggestUpcoming.name} (${fmtUsd(data.summary.biggestUpcoming.usdImpact)})`
                : '—'}
            />
          </div>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          {FILTER_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                filter === t
                  ? 'bg-hub-yellow text-black'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {t === 'all' ? 'All' : TYPE_LABEL[t]} ({counts[t] ?? 0})
            </button>
          ))}
        </div>

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Loading calendar…</div>
        )}

        {data && grouped.length === 0 && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            No upcoming events in this filter.
          </div>
        )}

        {/* Weekly groups */}
        <div className="space-y-4">
          {grouped.map(([weekStart, events]) => (
            <div key={weekStart}>
              <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
                Week of {new Date(weekStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <div className="space-y-1.5">
                {events.map(e => {
                  const Icon = TYPE_ICON[e.type] ?? Calendar;
                  // Render as <a> only when we have a real URL — using
                  // href="#" caused a jump-to-top page reload on click for
                  // eventless rows (halvings, BTC protocol events, etc.).
                  const innerContent = (
                    <>
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded border ${TYPE_TONE[e.type]}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white truncate">
                            {e.symbol ? `${e.symbol} · ` : ''}{e.name}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{TYPE_LABEL[e.type]}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">{e.description}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[11px] font-semibold text-white tabular-nums">{formatDay(e.daysFromNow, e.date)}</div>
                        {e.usdImpact != null && (
                          <div className="text-[10px] text-amber-400 tabular-nums">{fmtUsd(e.usdImpact)}</div>
                        )}
                      </div>
                      {e.url && <ExternalLink className="w-3 h-3 text-neutral-600 flex-shrink-0" />}
                    </>
                  );
                  return e.url ? (
                    <a
                      key={e.id}
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-premium px-3 py-2 flex items-center gap-3 hover:bg-white/[0.03] transition-colors"
                    >
                      {innerContent}
                    </a>
                  ) : (
                    <div
                      key={e.id}
                      className="card-premium px-3 py-2 flex items-center gap-3"
                    >
                      {innerContent}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {data && (
          <div className="text-center mt-6 text-[10px] text-neutral-600">
            Last refresh: {new Date(data.ts).toLocaleTimeString()} · cached 15 min · sources:
            TokenUnlocks, TGE Calendar, Snapshot, Bitcoin protocol
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function SummaryCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
