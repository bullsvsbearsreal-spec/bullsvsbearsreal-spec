'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import BookmarkStar from '@/components/BookmarkStar';
import { useTraderBookmarks } from '@/hooks/useTraderBookmarks';
import { useRecentTraders } from '@/hooks/useRecentTraders';
import { useTraderAlerts } from '@/hooks/useTraderAlerts';
import Link from 'next/link';
import {
  Brain, Trophy, ChevronRight, Search,
  Target, Flame, Activity,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface SmartWallet {
  address: string;
  displayName: string | null;
  venues: string[];
  realizedPnl: number;
  volume: number;
  wins: number;
  losses: number;
  winRate: number;
  closedCount: number;
  maxCapital: number;
  liveNotional: number;
  liveUnrealizedPnl: number;
  openPositionsCount: number;
  directionalBias: number; // -1..+1
}

interface SmartMoneyResponse {
  data: SmartWallet[];
  summary: {
    walletCount: number;
    enrichedCount: number;
    totalLifetimePnl: number;
    totalVolume: number;
    totalLiveNotional: number;
    totalLiveUnrealized: number;
    smartMoneyLongPct: number;
    crossVenueCount: number;
  };
  meta: { minPnl: number; minVolume: number; minWr: number; minTrades: number; timestamp: number };
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function fmtUSD(n: number, compact = true): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (!compact) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function venuePill(v: string): { label: string; cls: string } {
  if (v === 'hyperliquid') return { label: 'HL', cls: 'bg-purple-400/15 text-purple-300' };
  if (v === 'gmx-arbitrum') return { label: 'GMX·Arb', cls: 'bg-blue-400/15 text-blue-300' };
  if (v === 'gmx-avalanche') return { label: 'GMX·Avax', cls: 'bg-red-400/15 text-red-300' };
  return { label: v, cls: 'bg-white/5 text-neutral-400' };
}

/* ─── Smart Money Sentiment Gauge ─────────────────────────────────── */

function SentimentGauge({ longPct, hasActivity }: { longPct: number; hasActivity: boolean }) {
  // Normalize to 0..100 range
  const pct = Math.max(0, Math.min(100, longPct));
  const isBullish = pct >= 55;
  const isBearish = pct <= 45;
  const label = !hasActivity ? 'NO DATA' : isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL';
  const color = !hasActivity ? 'text-neutral-500'
    : isBullish ? 'text-green-400'
    : isBearish ? 'text-red-400'
    : 'text-neutral-400';

  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">
        Smart Money Sentiment
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-lg font-bold ${color}`}>{label}</span>
        <span className="text-xs text-neutral-500 font-mono tabular-nums">
          {hasActivity ? `${pct.toFixed(0)}% long · ${(100 - pct).toFixed(0)}% short` : 'no open positions'}
        </span>
      </div>
      <div className="relative h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r from-red-400 via-neutral-600 to-green-400 ${hasActivity ? '' : 'opacity-20'}`}
          style={{ width: '100%' }}
        />
        {hasActivity && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] text-neutral-600 mt-1">
        <span>all short</span>
        <span>neutral</span>
        <span>all long</span>
      </div>
    </div>
  );
}

/* ─── Wallet row ─────────────────────────────────────────────────── */

function WalletRow({ w, rank }: { w: SmartWallet; rank: number }) {
  const pnlColor = w.realizedPnl > 0 ? 'text-green-400' : w.realizedPnl < 0 ? 'text-red-400' : 'text-neutral-400';
  const biasPct = ((w.directionalBias + 1) / 2) * 100;
  const biasColor = w.directionalBias > 0.33 ? 'text-green-400/90' :
                    w.directionalBias < -0.33 ? 'text-red-400/90' :
                    'text-neutral-400';
  const biasLabel = w.liveNotional === 0 ? 'FLAT' :
                    w.directionalBias > 0.33 ? `${biasPct.toFixed(0)}% LONG` :
                    w.directionalBias < -0.33 ? `${(100 - biasPct).toFixed(0)}% SHORT` :
                    'NEUTRAL';

  return (
    <Link
      href={`/trader/${w.address}`}
      className="block rank-row hover:bg-white/[0.04] transition-colors"
    >
      <span className={`rank-number ${rank <= 3 ? 'rank-number-top' : ''}`}>{rank}</span>

      {/* Star is outside the Link so clicking it doesn't navigate */}
      <div onClick={(e) => e.preventDefault()} role="presentation">
        <BookmarkStar address={w.address} displayName={w.displayName} venues={w.venues} size={12} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {w.displayName ? (
            <span className="text-xs text-white font-semibold truncate">{w.displayName}</span>
          ) : (
            <span className="font-mono tabular-nums text-xs text-white font-medium">{shortAddr(w.address)}</span>
          )}
          {rank === 1 && <Trophy className="w-3 h-3 text-hub-yellow flex-shrink-0" />}
          {w.realizedPnl >= 5_000_000 && <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />}
          {w.winRate >= 80 && w.closedCount >= 50 && <Target className="w-3 h-3 text-green-400 flex-shrink-0" aria-label="Sniper" />}
          {w.venues.length > 1 && (
            <span className="text-[8px] text-hub-yellow/80 uppercase tracking-wider font-semibold bg-hub-yellow/[0.08] px-1 rounded">
              {w.venues.length}v
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {w.venues.map(v => {
            const { label, cls } = venuePill(v);
            return (
              <span key={v} className={`text-[8px] uppercase tracking-wider px-1 py-0.5 rounded font-semibold ${cls}`}>
                {label}
              </span>
            );
          })}
          {w.closedCount > 0 ? (
            <span className="text-[9px] text-neutral-600 font-mono tabular-nums">
              {w.wins}W/{w.losses}L · {w.winRate.toFixed(0)}%
            </span>
          ) : (
            <span className="text-[9px] text-neutral-700 font-mono tabular-nums">W/L not exposed</span>
          )}
        </div>
      </div>

      {/* Lifetime PnL */}
      <div className="text-right w-[100px]">
        <div className={`font-mono tabular-nums font-bold text-sm tabular-nums ${pnlColor}`}>
          {fmtUSD(w.realizedPnl)}
        </div>
        <div className="text-[9px] text-neutral-600 font-mono tabular-nums">lifetime PnL</div>
      </div>

      {/* Live positioning */}
      <div className="text-right w-[110px] hidden md:block">
        <div className={`font-mono tabular-nums font-bold text-xs tabular-nums ${biasColor}`}>
          {biasLabel}
        </div>
        <div className="text-[9px] text-neutral-600 font-mono tabular-nums">
          {w.openPositionsCount > 0 ? `${fmtUSD(w.liveNotional)} · ${w.openPositionsCount} pos` : 'no open positions'}
        </div>
      </div>

      {/* Unrealized */}
      <div className="text-right w-[80px] hidden md:block">
        {w.liveUnrealizedPnl !== 0 ? (
          <>
            <div className={`font-mono tabular-nums font-bold text-xs tabular-nums ${w.liveUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {w.liveUnrealizedPnl >= 0 ? '+' : ''}{fmtUSD(w.liveUnrealizedPnl)}
            </div>
            <div className="text-[9px] text-neutral-600 font-mono tabular-nums">unrealized</div>
          </>
        ) : (
          <div className="text-[9px] text-neutral-700 font-mono tabular-nums">—</div>
        )}
      </div>

      {/* Watch CTA — deeplinks to /watch with the wallet pre-filled so
          this elite trader gets backend-delivered Telegram alerts (the
          bookmark star is client-side only). Stops propagation so the
          outer Link doesn't intercept the click. */}
      <Link
        href={`/watch?add=${w.address}${w.displayName ? `&label=${encodeURIComponent(w.displayName)}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        title="Watch this trader on Telegram (add to /watch)"
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-hub-yellow/[0.08] text-hub-yellow hover:bg-hub-yellow/15 transition-colors shrink-0 mr-1"
      >
        + Watch
      </Link>

      <ChevronRight className="w-3 h-3 text-neutral-600 flex-shrink-0" />
    </Link>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function SmartMoneyPage() {
  const [minPnl, setMinPnl] = useState(250_000);
  const [minVolume, setMinVolume] = useState(10_000_000);
  const [minWr, setMinWr] = useState(55);
  const [include, setInclude] = useState<'gmx' | 'hl' | 'both'>('both');
  const [search, setSearch] = useState('');
  // Consensus mode: filter the visible list to the top 10 by lifetime
  // PnL — "what are the elite traders actually doing right now" rather
  // than "what does the aggregate of 40 wallets look like". Loud signal
  // beats wide signal for copy traders. Persisted to URL for shareability.
  const [consensusMode, setConsensusMode] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const { bookmarks, remove, add, clear, updateNote } = useTraderBookmarks();
  const { recents, remove: removeRecent, clear: clearRecents } = useRecentTraders();
  const { feed, clearFeed, enabled: alertsEnabled, toggleEnabled: toggleAlerts, lastCheck } = useTraderAlerts();
  // 1-second ticking clock so the "checked Xs ago" + "Xs ago" counters
  // below actually count up between data refreshes. Inline
  // `Date.now() - lastCheck` in JSX otherwise only updates on a
  // parent re-render, freezing the seconds counter.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hide "Recently Viewed" items that are already bookmarked (avoid duplicate display)
  const bookmarkedSet = useMemo(
    () => new Set(bookmarks.map(b => b.address)),
    [bookmarks],
  );
  const visibleRecents = useMemo(
    () => recents.filter(r => !bookmarkedSet.has(r.address)).slice(0, 10),
    [recents, bookmarkedSet],
  );

  /**
   * Export bookmarks as clipboard JSON. Plain-text so users can paste it
   * anywhere (note, DM, cross-device). Avoids the complexity of a backend.
   */
  const exportBookmarks = useCallback(() => {
    if (bookmarks.length === 0) return;
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      bookmarks,
    }, null, 2);
    navigator.clipboard.writeText(payload).then(() => {
      setImportError('copied');
      setTimeout(() => setImportError(null), 2000);
    }).catch(() => {
      setImportError('clipboard unavailable');
    });
  }, [bookmarks]);

  /** Parse a pasted export JSON and merge into existing bookmarks. */
  const importBookmarks = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const incoming = Array.isArray(parsed) ? parsed : parsed?.bookmarks;
      if (!Array.isArray(incoming)) {
        setImportError('expected JSON array or { bookmarks: [...] }');
        return;
      }
      let added = 0;
      for (const b of incoming) {
        if (b?.address && /^0x[a-fA-F0-9]{40}$/.test(b.address)) {
          add({ address: b.address, displayName: b.displayName, venues: b.venues });
          added++;
        }
      }
      setImportError(`imported ${added}`);
      setTimeout(() => setImportError(null), 2500);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'invalid JSON');
    }
  }, [add]);

  const { data, isLoading, isRefreshing, error, refresh } = useApi<SmartMoneyResponse>({
    key: `smart-money:${minPnl}:${minVolume}:${minWr}:${include}`,
    fetcher: async () => {
      const res = await fetch(
        `/api/smart-money?min_pnl=${minPnl}&min_volume=${minVolume}&min_wr=${minWr}&include=${include}&limit=50`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 120_000,
  });

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const q = search.toLowerCase().trim();
    let pool = data.data;
    // Consensus mode pre-trims to the top 10 by lifetime realised PnL
    // BEFORE the search filter applies, so search inside consensus mode
    // only matches the elite subset (intentional — keeps the signal pure).
    if (consensusMode) {
      pool = [...pool].sort((a, b) => b.realizedPnl - a.realizedPnl).slice(0, 10);
    }
    if (!q) return pool;
    return pool.filter(w =>
      w.address.toLowerCase().includes(q) ||
      (w.displayName ?? '').toLowerCase().includes(q),
    );
  }, [data, search, consensusMode]);

  // Consensus sentiment: aggregate directional bias of just the elite
  // top-10. Surfaces "the people who actually print money are leaning
  // bullish" vs the broader pool's noisy 50/50. Only computed when in
  // consensus mode + we have data.
  const consensusSentiment = useMemo(() => {
    if (!consensusMode || filtered.length === 0) return null;
    const withNotional = filtered.filter(w => w.liveNotional > 0);
    if (withNotional.length === 0) return null;
    // Notional-weighted average bias (-1..+1). Big wallets weigh more.
    const totalNotional = withNotional.reduce((a, w) => a + w.liveNotional, 0);
    const weighted = withNotional.reduce((a, w) => a + w.directionalBias * w.liveNotional, 0);
    const weightedBias = totalNotional > 0 ? weighted / totalNotional : 0;
    // Map -1..+1 → 0..100 (long pct). +1 = 100% long, -1 = 0% long.
    const longPct = Math.round((weightedBias + 1) * 50);
    return { longPct, eliteCount: withNotional.length };
  }, [consensusMode, filtered]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <header className="mb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/[0.04] border border-hub-yellow/20 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-hub-yellow" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Wallets · cross-venue</span>
              </div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
                Smart <span className="text-hub-yellow">money</span>
              </h1>
              <p className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
                Wallets with proven alpha — significant lifetime PnL, real trading volume,
                consistent win rate. Aggregated across GMX V2 (Arb + Avax) and Hyperliquid;
                bookmark to follow via{' '}
                <Link href="/trader-watch" className="text-hub-yellow hover:underline font-medium">/trader-watch</Link>
                {' '}or get Telegram pings via{' '}
                <Link href="/watch" className="text-hub-yellow hover:underline font-medium">/watch</Link>.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 self-start lg:self-end">
              <DataFreshness
                exchangeCount={data?.summary?.walletCount ?? 0}
                lastUpdated={data?.meta?.timestamp ?? null}
                sources={['GMX Arb', 'GMX Avax', 'Hyperliquid']}
              />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
        </header>

        {/* Summary + sentiment */}
        {data?.summary && (
          <div
            className="grid grid-cols-1 md:grid-cols-[1fr,260px,260px,260px] gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Smart money sentiment and stats — refreshes every 2 minutes"
          >
            <SentimentGauge longPct={data.summary.smartMoneyLongPct} hasActivity={data.summary.totalLiveNotional > 0} />

            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Tracked Wallets</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums">{data.summary.walletCount}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {data.summary.crossVenueCount} active on multiple venues
              </div>
            </div>

            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Live Notional</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums">{fmtUSD(data.summary.totalLiveNotional)}</div>
              <div className={`text-[10px] font-mono tabular-nums mt-0.5 ${
                data.summary.totalLiveUnrealized >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {data.summary.totalLiveUnrealized >= 0 ? '+' : ''}{fmtUSD(data.summary.totalLiveUnrealized)} unrealized
              </div>
            </div>

            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Combined Lifetime</div>
              <div className="text-lg font-bold text-green-400 font-mono tabular-nums">{fmtUSD(data.summary.totalLifetimePnl)}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                on {fmtUSD(data.summary.totalVolume)} volume
              </div>
            </div>
          </div>
        )}

        {/* My Tracked Traders strip — bookmarks from localStorage */}
        {bookmarks.length > 0 && (
          <div className="card-premium p-3 mb-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Target className="w-3.5 h-3.5 text-hub-yellow" />
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">My Tracked Traders</h2>
              <span className="text-[10px] text-neutral-500 font-mono tabular-nums">{bookmarks.length}</span>
              <span className="text-[10px] text-neutral-600">· saved locally to your browser</span>
              <div className="ml-auto flex items-center gap-2">
                {bookmarks.length >= 2 && (
                  <Link
                    href={`/compare-traders?addresses=${bookmarks.slice(0, 3).map(b => b.address).join(',')}`}
                    className="text-[10px] font-semibold text-hub-yellow hover:text-hub-yellow/80 transition-colors inline-flex items-center gap-1"
                    title="Compare up to 3 tracked traders side-by-side"
                  >
                    Compare {bookmarks.length >= 3 ? 'top 3' : `${bookmarks.length}`} →
                  </Link>
                )}
                {importError && (
                  <span className={`text-[10px] font-mono tabular-nums ${
                    importError === 'copied' || importError.startsWith('imported') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {importError}
                  </span>
                )}
                <button
                  type="button"
                  onClick={exportBookmarks}
                  className="text-[10px] text-neutral-500 hover:text-hub-yellow transition-colors"
                  title="Copy bookmarks JSON to clipboard"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const txt = await navigator.clipboard.readText();
                      importBookmarks(txt);
                    } catch {
                      setImportError('paste failed');
                    }
                  }}
                  className="text-[10px] text-neutral-500 hover:text-hub-yellow transition-colors"
                  title="Import bookmarks from clipboard JSON"
                >
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Clear all ${bookmarks.length} bookmarked traders? This cannot be undone.`)) clear();
                  }}
                  className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors"
                  title="Remove all bookmarks"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bookmarks.map(b => {
                const isEditing = editingNote === b.address;
                return (
                  <div
                    key={b.address}
                    className="group/bm inline-flex flex-col gap-0.5 pl-2 pr-1 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] transition-colors"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/trader/${b.address}`}
                        className="inline-flex items-center gap-1.5 text-xs"
                      >
                        <span className="text-white font-semibold">
                          {b.displayName || `${b.address.slice(0, 6)}…${b.address.slice(-4)}`}
                        </span>
                        {b.venues && b.venues.length > 0 && (
                          <span className="text-[9px] text-neutral-500 uppercase tracking-wider">
                            {b.venues.map(v => v === 'hyperliquid' ? 'HL' : v === 'gmx-arbitrum' ? 'ARB' : v === 'gmx-avalanche' ? 'AVAX' : v).join(' · ')}
                          </span>
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingNote(null);
                          } else {
                            setEditingNote(b.address);
                            setNoteDraft(b.note ?? '');
                          }
                        }}
                        className="opacity-0 group-hover/bm:opacity-100 text-neutral-500 hover:text-hub-yellow transition-opacity p-0.5"
                        aria-label="Edit note"
                        title={b.note ? 'Edit note' : 'Add note'}
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(b.address)}
                        className="opacity-0 group-hover/bm:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity p-0.5"
                        aria-label="Remove bookmark"
                        title="Remove bookmark"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {/* Inline note — shown if set, or an input if editing */}
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        onBlur={() => {
                          updateNote(b.address, noteDraft);
                          setEditingNote(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateNote(b.address, noteDraft);
                            setEditingNote(null);
                          } else if (e.key === 'Escape') {
                            setEditingNote(null);
                          }
                        }}
                        placeholder="e.g. good BTC shorter"
                        maxLength={80}
                        className="text-[10px] bg-transparent border-b border-hub-yellow/30 text-neutral-200 focus:outline-none focus:border-hub-yellow/60 placeholder:text-neutral-700 py-0.5"
                      />
                    ) : b.note ? (
                      <div className="text-[10px] text-neutral-400 italic pr-1 max-w-[240px] truncate" title={b.note}>
                        {b.note}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tracked Activity feed — browser-only copy-trading alerts.
            Polls bookmarked traders and detects opens/closes/resizes. */}
        {bookmarks.length > 0 && (
          <div className="card-premium p-3 mb-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <svg className="w-3.5 h-3.5 text-hub-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Tracked Activity</h2>
              <span className="text-[10px] text-neutral-500 font-mono tabular-nums">{feed.length} events</span>
              {lastCheck && alertsEnabled && (
                <span className="text-[10px] text-neutral-600">
                  · checked {Math.floor((nowTick - lastCheck) / 1000)}s ago
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAlerts}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    alertsEnabled
                      ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                      : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                  }`}
                  title={alertsEnabled ? 'Disable polling' : 'Enable browser notifications for bookmarked traders'}
                >
                  {alertsEnabled ? 'On' : 'Off'}
                </button>
                {feed.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFeed}
                    className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors"
                    title="Clear activity feed"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {!alertsEnabled ? (
              <div className="text-[11px] text-neutral-500 leading-relaxed">
                Turn on alerts to get browser notifications when your bookmarked traders open, close, or resize positions. Polls every 2 min. No backend, no account — runs in your tab.
              </div>
            ) : feed.length === 0 ? (
              <div className="text-[11px] text-neutral-500">
                Watching {bookmarks.length} trader{bookmarks.length !== 1 ? 's' : ''}. No position changes yet — baseline snapshot captured.
              </div>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {feed.map(a => {
                  const kindColor =
                    a.kind === 'opened' ? 'text-green-400' :
                    a.kind === 'closed' ? 'text-neutral-400' :
                    a.kind === 'flipped' ? 'text-orange-400' :
                    a.kind === 'increased' ? 'text-blue-400' :
                    'text-red-400';
                  const ago = Math.floor((Date.now() - a.timestamp) / 1000);
                  const agoStr = ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.floor(ago / 60)}m` : `${Math.floor(ago / 3600)}h`;
                  return (
                    <Link
                      key={a.id}
                      href={`/trader/${a.address}`}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.03] transition-colors"
                    >
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${kindColor} min-w-[56px]`}>
                        {a.kind}
                      </span>
                      <span className="text-[11px] text-white font-semibold truncate min-w-0">
                        {a.displayName || `${a.address.slice(0, 6)}…${a.address.slice(-4)}`}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate flex-1">{a.details}</span>
                      <span className="text-[9px] text-neutral-600 font-mono tabular-nums flex-shrink-0">{agoStr}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recently Viewed strip — auto-populated from trader page visits */}
        {visibleRecents.length > 0 && (
          <div className="card-premium p-3 mb-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <svg className="w-3.5 h-3.5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
              </svg>
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Recently Viewed</h2>
              <span className="text-[10px] text-neutral-500 font-mono tabular-nums">{visibleRecents.length}</span>
              <span className="text-[10px] text-neutral-600">· auto-logs when you open a trader</span>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => { if (confirm('Clear recently viewed history?')) clearRecents(); }}
                  className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors"
                  title="Clear history"
                >
                  Clear history
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {visibleRecents.map(r => (
                <div
                  key={r.address}
                  className="group/rc inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.03] transition-colors"
                >
                  <Link href={`/trader/${r.address}`} className="text-xs">
                    <span className="text-neutral-300 font-medium">
                      {r.displayName || `${r.address.slice(0, 6)}…${r.address.slice(-4)}`}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      add({ address: r.address, displayName: r.displayName, venues: [] });
                      removeRecent(r.address);
                    }}
                    className="opacity-0 group-hover/rc:opacity-100 text-neutral-500 hover:text-hub-yellow transition-opacity p-0.5"
                    aria-label="Bookmark this trader"
                    title="Bookmark"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecent(r.address)}
                    className="opacity-0 group-hover/rc:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity p-0.5"
                    aria-label="Remove from history"
                    title="Remove from history"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 flex-wrap bg-white/[0.03] rounded-lg p-0.5">
            {(['both', 'gmx', 'hl'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setInclude(opt)}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors uppercase ${
                  include === opt ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {opt === 'both' ? 'All Venues' : opt === 'gmx' ? 'GMX Only' : 'HL Only'}
              </button>
            ))}
          </div>

          {/* Consensus toggle — trims to top 10 by realized PnL so the
              sentiment + table show "what the elite are doing" rather
              than the noisy aggregate of 30-40 wallets. */}
          <button
            onClick={() => setConsensusMode(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              consensusMode
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/[0.04] text-neutral-400 border border-white/[0.08] hover:text-white'
            }`}
            title="Filter to the top 10 by realized PnL — see what the elite traders are doing"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${consensusMode ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
            Consensus
            {consensusSentiment && (
              <span className="ml-1 text-[10px] text-emerald-200/80">
                · {consensusSentiment.longPct}% long
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <span>Min PnL</span>
              <select
                value={minPnl}
                onChange={e => setMinPnl(Number(e.target.value))}
                className="bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-white"
              >
                <option value={100_000}>$100K</option>
                <option value={250_000}>$250K</option>
                <option value={500_000}>$500K</option>
                <option value={1_000_000}>$1M</option>
                <option value={5_000_000}>$5M</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <span>Min Volume</span>
              <select
                value={minVolume}
                onChange={e => setMinVolume(Number(e.target.value))}
                className="bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-white"
              >
                <option value={1_000_000}>$1M</option>
                <option value={10_000_000}>$10M</option>
                <option value={50_000_000}>$50M</option>
                <option value={100_000_000}>$100M</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <span>Min WR (GMX)</span>
              <select
                value={minWr}
                onChange={e => setMinWr(Number(e.target.value))}
                className="bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-white"
              >
                <option value={0}>0%</option>
                <option value={50}>50%</option>
                <option value={55}>55%</option>
                <option value={60}>60%</option>
                <option value={70}>70%</option>
              </select>
            </label>
          </div>

          <div className="lg:ml-auto relative flex-1 lg:flex-initial lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by address or name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.12]"
            />
          </div>
        </div>

        <div className="card-premium p-3 min-h-[400px]">
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <span className="w-6">#</span>
            <span className="flex-1">Wallet · venues</span>
            <span className="text-right w-[100px]">Lifetime PnL</span>
            <span className="text-right w-[110px]">Live Bias</span>
            <span className="text-right w-[80px]">Unrealized</span>
            <span className="w-3" />
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="h-14 bg-white/[0.03] rounded animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">
              No wallets match the filters. Try loosening thresholds.
            </div>
          )}

          <div className="ranked-list">
            {filtered.map((w, i) => (
              <WalletRow key={w.address} w={w} rank={i + 1} />
            ))}
          </div>
        </div>

        <div className="mt-4 text-[10px] text-neutral-600 font-mono tabular-nums flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" /> Ingredients from GMX V2 (Arb+Avax) and Hyperliquid leaderboards
          </span>
          <span>·</span>
          <span>Live positions enriched for top 30 · refreshes every 2 minutes</span>
          <span>·</span>
          <span className="max-w-full">
            <strong className="text-neutral-400">Note:</strong> Past PnL is not predictive.
            &quot;Smart money&quot; is descriptive, not prescriptive. Cross-reference any signal with your own analysis.
          </span>
        </div>
      </main>
      <Footer />
    </div>
  );
}
