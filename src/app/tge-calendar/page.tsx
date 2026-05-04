'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CalendarDays, RefreshCw, ExternalLink, AlertTriangle, Sparkles } from 'lucide-react';

interface TgeEntry {
  name: string;
  symbol: string | null;
  date: string;
  dateTbd?: boolean;
  chain: string;
  category: string;
  fdvUsd: number | null;
  initialCirc: number | null;
  vestingCliffMonths: number | null;
  description: string;
  website: string | null;
  twitter?: string;
  fundingRaised?: number;
}

interface RecentLaunch {
  symbol: string;
  name: string;
  ageDays: number;
  marketCapUsd: number | null;
  priceUsd: number | null;
  change24h: number | null;
  imageUrl: string | null;
  cgId: string;
}

interface ApiResponse {
  upcoming: TgeEntry[];
  recent: RecentLaunch[];
  ts: number;
}

function fmtUsd(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function daysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00Z').getTime();
  return Math.round((target - Date.now()) / 86_400_000);
}

const CATEGORY_TONES: Record<string, string> = {
  L1: 'bg-violet-500/10 text-violet-400 border-violet-400/20',
  L2: 'bg-cyan-500/10 text-cyan-400 border-cyan-400/20',
  DeFi: 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20',
  AI: 'bg-amber-500/10 text-amber-400 border-amber-400/20',
  Infra: 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  RWA: 'bg-rose-500/10 text-rose-400 border-rose-400/20',
  Memes: 'bg-pink-500/10 text-pink-400 border-pink-400/20',
  Gaming: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-400/20',
  Social: 'bg-orange-500/10 text-orange-400 border-orange-400/20',
  DePIN: 'bg-teal-500/10 text-teal-400 border-teal-400/20',
  Other: 'bg-neutral-500/10 text-neutral-400 border-neutral-400/20',
};

type Filter = 'all' | string;

export default function TgeCalendarPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/tge-calendar', { signal: AbortSignal.timeout(15_000) });
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

  const categories = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.upcoming.map(t => t.category))).sort();
  }, [data]);

  const filteredUpcoming = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.upcoming;
    return data.upcoming.filter(t => t.category === filter);
  }, [data, filter]);

  return (
    <>
      <Header />
      <main className="max-w-[1300px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-fuchsia-500/10 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-fuchsia-400" />
            </div>
            <h1 className="text-xl font-bold text-white">TGE Calendar</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {data?.upcoming.length ?? 0} upcoming · {data?.recent.length ?? 0} recent
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
            Upcoming Token Generation Events with FDV estimates, initial unlock %,
            and vesting cliffs. Curated by hand to filter out noise. Plus a
            &quot;recently launched&quot; rail of tokens added to CoinGecko in the past 14 days.
          </p>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading TGE calendar…</div>
        )}

        {data && (
          <>
            {/* Filter */}
            <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 mb-3 w-fit overflow-x-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                  filter === 'all' ? 'bg-fuchsia-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`px-3 py-1 rounded text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                    filter === c ? 'bg-fuchsia-400 text-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Upcoming TGE list */}
            <div className="space-y-2 mb-8">
              {filteredUpcoming.map(t => {
                const days = daysUntil(t.date);
                const tone = days < 0 ? 'border-emerald-400/30 bg-emerald-500/[0.03]'
                  : days < 7 ? 'border-amber-400/30 bg-amber-500/[0.03]'
                  : 'border-white/[0.06] bg-white/[0.02]';
                const dayLabel = days < 0
                  ? `Launched ${-days}d ago`
                  : days === 0
                  ? 'Today'
                  : `In ${days}d`;
                return (
                  <div key={`${t.name}-${t.date}`} className={`rounded-xl border p-4 transition-all hover:border-white/[0.15] ${tone}`}>
                    <div className="flex items-start gap-4 flex-wrap">
                      {/* Date column */}
                      <div className="flex-shrink-0 w-24">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                          {t.dateTbd ? 'Est.' : 'TGE'}
                        </div>
                        <div className="font-mono text-sm font-bold text-white">{t.date}</div>
                        <div className={`font-mono text-[10px] mt-0.5 ${
                          days < 0 ? 'text-emerald-400'
                          : days < 7 ? 'text-amber-400 font-bold'
                          : 'text-neutral-400'
                        }`}>
                          {dayLabel}
                        </div>
                        {t.dateTbd && (
                          <div className="font-mono text-[9px] text-neutral-600 mt-0.5 inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> TBD
                          </div>
                        )}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-[260px]">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{t.name}</h3>
                          {t.symbol && (
                            <span className="text-xs font-mono text-hub-yellow">${t.symbol}</span>
                          )}
                          <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded border ${CATEGORY_TONES[t.category] || CATEGORY_TONES.Other}`}>
                            {t.category}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">{t.chain}</span>
                        </div>
                        <p className="text-xs text-neutral-400 mb-2 leading-relaxed">{t.description}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          {t.website && (
                            <a
                              href={t.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Website
                            </a>
                          )}
                          {t.twitter && (
                            <a
                              href={`https://x.com/${t.twitter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> @{t.twitter}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Numbers column */}
                      <div className="grid grid-cols-3 gap-2 text-right">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-neutral-500">FDV</div>
                          <div className="font-mono text-xs text-white font-semibold">{fmtUsd(t.fdvUsd)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-neutral-500">Init circ</div>
                          <div className="font-mono text-xs text-white font-semibold">
                            {t.initialCirc != null ? `${t.initialCirc}%` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-neutral-500">Cliff</div>
                          <div className="font-mono text-xs text-white font-semibold">
                            {t.vestingCliffMonths != null ? `${t.vestingCliffMonths}mo` : '—'}
                          </div>
                        </div>
                        {t.fundingRaised != null && (
                          <div className="col-span-3 mt-1">
                            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Raised</div>
                            <div className="font-mono text-xs text-emerald-300 font-semibold">{fmtUsd(t.fundingRaised)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recently launched */}
            {data.recent.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white">Recently launched</h2>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">CoinGecko · last 14d</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {data.recent.map(r => (
                    <a
                      key={r.cgId}
                      href={`https://www.coingecko.com/en/coins/${r.cgId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-premium p-3 hover:border-white/[0.15] transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {r.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt="" className="w-5 h-5 rounded-full" loading="lazy" />
                        )}
                        <div className="text-sm font-bold text-white truncate group-hover:text-hub-yellow transition-colors">
                          {r.symbol}
                        </div>
                        <span className="text-[10px] text-neutral-600 font-mono ml-auto">{r.ageDays}d</span>
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate mb-2">{r.name}</div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-neutral-300">{fmtUsd(r.priceUsd)}</span>
                        {r.change24h != null && (
                          <span className={`font-mono ${r.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmtPct(r.change24h)}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-neutral-600 font-mono mt-1">
                        mcap {fmtUsd(r.marketCapUsd)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-6 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> upcoming list is curated
          by hand to filter out noise. Initial circ % is what unlocks at TGE; the
          rest vests with the cliff shown. Low init + short cliff = max sell pressure
          early. Recently launched is auto-pulled from CoinGecko&apos;s &quot;recently added&quot;
          category. Cached 30 minutes. Spot something missing?{' '}
          <a href="https://x.com/info_hub69" target="_blank" rel="noopener" className="text-hub-yellow hover:underline">DM @info_hub69</a>.
        </div>
      </main>
      <Footer />
    </>
  );
}
