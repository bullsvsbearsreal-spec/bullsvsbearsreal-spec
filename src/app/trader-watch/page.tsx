'use client';

/**
 * /trader-watch — single-page consolidated view of all bookmarked
 * traders' open positions across GMX (Arbitrum + Avalanche) and
 * Hyperliquid.
 *
 * The pain this solves (verbatim from snakether's notes):
 *   "right now i have to keep open multiple tabs open to keep track
 *    of other traders. and when they close their trade that means i
 *    can close my trade. it would be much easier if i can just have
 *    a watchlist in the mainpage and see all these different traders
 *    with their positions open"
 *
 * Reads bookmarks from useTraderBookmarks (localStorage, up to 100).
 * Fetches each trader's open positions in parallel from the existing
 * /api/gmx-traders/[address] and /api/hl-traders/[address] endpoints,
 * enriches with the latest 8h funding rate per symbol, renders a
 * single table. Refreshes every 30s.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Star, RefreshCw, X, ExternalLink, ArrowUpDown, Plus, AlertTriangle, Bell } from 'lucide-react';
import { useTraderBookmarks, type TraderBookmark } from '@/hooks/useTraderBookmarks';
import { useTraderAlerts } from '@/hooks/useTraderAlerts';
import { TokenIconSimple } from '@/components/TokenIcon';

/* ─── Types ──────────────────────────────────────────────────────── */

/** Normalised across venues. Anything specific to GMX or HL gets folded
 *  into the `venue` tag plus optional metadata. */
interface NormalizedPosition {
  /** Owning trader address (lowercased). */
  trader: string;
  /** Display label for the trader (truncated address or note). */
  traderLabel: string;
  venue: 'GMX' | 'HL' | 'gTrade';
  /** Bare base symbol (BTC, ETH, etc.) */
  symbol: string;
  side: 'long' | 'short';
  /** Position size in USD. */
  sizeUsd: number;
  entryPrice: number;
  /** Current mark / live price. May be null on stale snapshots. */
  markPrice: number | null;
  unrealizedPnl: number | null;
  /** PnL as % of size (signed). */
  pnlPct: number | null;
  /** Liquidation price (null on cross-margin where exchange doesn't expose one). */
  liqPrice: number | null;
  /** Distance to liq as % of mark (signed positive when liq is "away"). */
  liqDistPct: number | null;
  leverage: number | null;
  /** Funding rate the position is exposed to (8h-normalized %, signed). */
  funding8hPct: number | null;
}

interface GMXPositionRow {
  marketSymbol: string;
  isLong: boolean;
  sizeUsd: number;
  entryPrice: number;
  livePrice: number;
  unrealizedPnl: number;
  pnlPct: number;
  leverage: number | null;
}

interface GMXDossier {
  address: string;
  openPositions: GMXPositionRow[];
}

interface HLPositionRow {
  coin: string;
  szi: number;       // signed: + long / - short
  entryPx: number | null;
  markPx: number | null;
  unrealizedPnl: number | null;
  positionValue: number;
  leverage: { type: string; value: number };
  liquidationPx: number | null;
  roePct: number | null;
}

interface HLResponse {
  address: string;
  positions: HLPositionRow[];
}

interface FundingRow {
  symbol: string;
  fundingRate: number;
  fundingInterval?: string | null;
  exchange?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const trunc = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

function fmtUsd(n: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = opts.sign && n > 0 ? '+' : '';
  if (Math.abs(n) >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  return `${sign}$${n.toFixed(2)}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  if (Math.abs(n) >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtPct(n: number | null | undefined, opts: { sign?: boolean; digits?: number } = {}): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = opts.sign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(opts.digits ?? 2)}%`;
}

/** Normalize an 8h funding rate (always 8h-equivalent) from a venue's
 *  native interval. */
function to8h(rate: number, interval: string | null | undefined): number {
  if (interval === '1h') return rate * 8;
  if (interval === '4h') return rate * 2;
  return rate;
}

/* ─── Data fetching ──────────────────────────────────────────────── */

async function fetchGMXPositions(address: string, chain: 'arbitrum' | 'avalanche'): Promise<NormalizedPosition[]> {
  try {
    const res = await fetch(`/api/gmx-traders/${address}?chain=${chain}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: GMXDossier };
    const positions = json?.data?.openPositions ?? [];
    return positions.map(p => {
      const pnl = p.unrealizedPnl;
      const pnlPct = p.pnlPct;
      return {
        trader: address.toLowerCase(),
        traderLabel: trunc(address),
        venue: 'GMX' as const,
        symbol: (p.marketSymbol || '').toUpperCase(),
        side: p.isLong ? 'long' : 'short',
        sizeUsd: p.sizeUsd,
        entryPrice: p.entryPrice,
        markPrice: p.livePrice,
        unrealizedPnl: pnl,
        pnlPct,
        liqPrice: null, // GMX subsquid doesn't expose liq here
        liqDistPct: null,
        leverage: p.leverage ?? null,
        funding8hPct: null, // filled later
      };
    });
  } catch {
    return [];
  }
}

async function fetchHLPositions(address: string): Promise<NormalizedPosition[]> {
  try {
    const res = await fetch(`/api/hl-traders/${address}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as HLResponse;
    const positions = json.positions ?? [];
    return positions.map(p => {
      const isLong = p.szi >= 0;
      const liq = p.liquidationPx;
      const mark = p.markPx;
      const liqDist = (liq != null && mark != null && mark > 0)
        ? (Math.abs(mark - liq) / mark) * 100
        : null;
      return {
        trader: address.toLowerCase(),
        traderLabel: trunc(address),
        venue: 'HL' as const,
        symbol: (p.coin || '').toUpperCase(),
        side: isLong ? 'long' : 'short',
        sizeUsd: p.positionValue,
        entryPrice: p.entryPx ?? 0,
        markPrice: mark,
        unrealizedPnl: p.unrealizedPnl,
        pnlPct: p.roePct,
        liqPrice: liq,
        liqDistPct: liqDist,
        leverage: p.leverage?.value ?? null,
        funding8hPct: null,
      };
    });
  } catch {
    return [];
  }
}

/** Load latest funding rates (8h-normalized) keyed by symbol. */
async function fetchFundingMap(): Promise<Map<string, number>> {
  try {
    const res = await fetch('/api/funding?aggregate=1', {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return new Map();
    const json = await res.json() as { data?: Array<{ symbol: string; avgRate8h?: number }> };
    const out = new Map<string, number>();
    for (const r of json.data ?? []) {
      if (typeof r.avgRate8h === 'number' && Number.isFinite(r.avgRate8h)) {
        out.set(r.symbol.toUpperCase(), r.avgRate8h * 100); // store as % directly
      }
    }
    return out;
  } catch {
    return new Map();
  }
}

/* ─── Main page ──────────────────────────────────────────────────── */

export default function TraderWatchPage() {
  const { bookmarks, remove } = useTraderBookmarks();
  // Snake's core ask (from Telegram): "when they close their trade that
  // means i can close my trade. it would be much easier if i can just have
  // a watchlist in the mainpage and see all these different traders with
  // their positions open." The positions table covers the WATCH side;
  // useTraderAlerts polls bookmarks every 2 min and fires browser
  // notifications + an in-page feed on open/close/resize. Wire both.
  const { feed, clearFeed, enabled: alertsEnabled, toggleEnabled: toggleAlerts, lastCheck } =
    useTraderAlerts();
  const [positions, setPositions] = useState<NormalizedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<'pnl' | 'size' | 'liqDist' | 'symbol'>('size');
  // Ticking clock for "updated Xs ago" so the counter actually counts up
  // between auto-refresh ticks. Without this, the JSX `Date.now() -
  // lastRefresh` is evaluated once per React render — between refreshes
  // the displayed seconds froze and jumped at the next 30s tick.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Refresh all bookmarked traders' positions in parallel.
   *  Accepts an optional aborted-ref so a stale fetch from before the
   *  user removed a bookmark / unmounted doesn't setState on the new
   *  bookmarks list. Was racing previously — when a 10s GMX fetch
   *  completed after the user removed a bookmark, the now-deleted
   *  trader's positions would briefly re-appear in the table until
   *  the next 30s refresh cleared them. */
  const refresh = useCallback(async (abortedRef?: { aborted: boolean }) => {
    if (bookmarks.length === 0) {
      if (!abortedRef?.aborted) {
        setPositions([]);
        setLoading(false);
      }
      return;
    }
    if (!abortedRef?.aborted) setLoading(true);

    // Fan out per bookmark per venue. The bookmark's `venues` field
    // tells us which APIs to hit so we don't fetch HL for a GMX-only
    // address. If no venues set, try both — older bookmarks lacked
    // venue tagging.
    const tasks: Promise<NormalizedPosition[]>[] = [];
    for (const b of bookmarks) {
      const venues = b.venues ?? ['gmx-arbitrum', 'gmx-avalanche', 'hyperliquid'];
      for (const v of venues) {
        if (v === 'gmx-arbitrum')   tasks.push(fetchGMXPositions(b.address, 'arbitrum'));
        if (v === 'gmx-avalanche')  tasks.push(fetchGMXPositions(b.address, 'avalanche'));
        if (v === 'hyperliquid')    tasks.push(fetchHLPositions(b.address));
      }
    }

    const [batches, fundingMap] = await Promise.all([
      Promise.all(tasks),
      fetchFundingMap(),
    ]);

    if (abortedRef?.aborted) return;

    const merged: NormalizedPosition[] = batches.flat().map(p => ({
      ...p,
      funding8hPct: fundingMap.get(p.symbol) ?? null,
    }));

    // Enrich label with bookmark displayName if present.
    const labelByAddr = new Map<string, string>(
      bookmarks.map(b => [b.address, b.displayName?.trim() || trunc(b.address)]),
    );
    for (const p of merged) {
      const label = labelByAddr.get(p.trader);
      if (label) p.traderLabel = label;
    }

    setPositions(merged);
    setLastRefresh(Date.now());
    setLoading(false);
  }, [bookmarks]);

  // Initial load + 30s refresh.
  // abortedRef cancels in-flight fetches when bookmarks change or the
  // component unmounts. Without this, a slow fetch (some GMX subgraph
  // calls take 5-10s) could complete after the user removed a bookmark
  // and briefly resurrect the deleted trader's rows in the table.
  useEffect(() => {
    const abortedRef = { aborted: false };
    refresh(abortedRef);
    const id = setInterval(() => refresh(abortedRef), 30_000);
    return () => {
      abortedRef.aborted = true;
      clearInterval(id);
    };
  }, [refresh]);

  const sorted = useMemo(() => {
    const arr = [...positions];
    switch (sortKey) {
      case 'pnl':
        arr.sort((a, b) => (b.unrealizedPnl ?? 0) - (a.unrealizedPnl ?? 0));
        break;
      case 'size':
        arr.sort((a, b) => b.sizeUsd - a.sizeUsd);
        break;
      case 'liqDist':
        arr.sort((a, b) => (a.liqDistPct ?? Infinity) - (b.liqDistPct ?? Infinity));
        break;
      case 'symbol':
        arr.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
    }
    return arr;
  }, [positions, sortKey]);

  /* ── Stats summary across all watched traders ─────────────────── */
  const totals = useMemo(() => {
    let totalSize = 0, totalPnl = 0, longCount = 0, shortCount = 0;
    for (const p of positions) {
      totalSize += p.sizeUsd;
      if (p.unrealizedPnl != null) totalPnl += p.unrealizedPnl;
      if (p.side === 'long') longCount++;
      else shortCount++;
    }
    return { totalSize, totalPnl, longCount, shortCount };
  }, [positions]);

  /* ── Empty state ──────────────────────────────────────────────── */
  if (bookmarks.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-hub-yellow/40 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">No traders watched yet</h1>
          <p className="text-neutral-500 max-w-md mx-auto mb-8">
            Star traders on the leaderboards and they show up here — all their open
            positions, funding exposure, and liq distance on one screen.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/gmx-traders"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:bg-hub-yellow-light transition-colors"
            >
              <Plus className="w-4 h-4" /> Browse GMX traders
            </Link>
            <Link
              href="/hl-traders"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white font-medium text-sm hover:bg-white/[0.08] transition-colors"
            >
              Browse HL traders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="main-content" className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Trader watch</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {bookmarks.length} {bookmarks.length === 1 ? 'trader' : 'traders'} · {positions.length} open {positions.length === 1 ? 'position' : 'positions'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[11px] text-neutral-600 font-mono">
              updated {Math.floor((nowTick - lastRefresh) / 1000)}s ago
            </span>
          )}
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-xs font-medium hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatTile label="Total notional" value={fmtUsd(totals.totalSize)} />
        <StatTile
          label="Aggregate PnL"
          value={fmtUsd(totals.totalPnl, { sign: true })}
          tone={totals.totalPnl >= 0 ? 'pump' : 'rekt'}
        />
        <StatTile label="Longs" value={`${totals.longCount}`} tone="pump" />
        <StatTile label="Shorts" value={`${totals.shortCount}`} tone="rekt" />
      </div>

      {/* Tracked Activity feed — browser alerts on open/close/resize.
          Snake's "when they close their trade I can close mine" UX. */}
      <ActivityFeed
        feed={feed}
        clearFeed={clearFeed}
        alertsEnabled={alertsEnabled}
        toggleAlerts={toggleAlerts}
        lastCheck={lastCheck}
        nowTick={nowTick}
        watchedCount={bookmarks.length}
      />

      {/* Watched-traders strip */}
      <div className="mb-5 flex flex-wrap gap-2">
        {bookmarks.map(b => (
          <BookmarkChip key={b.address} bookmark={b} onRemove={() => remove(b.address)} />
        ))}
      </div>

      {/* Positions table */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-hub-darker">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                <Th>Trader</Th>
                <Th>Venue</Th>
                <Th onClick={() => setSortKey('symbol')}>Symbol</Th>
                <Th>Side</Th>
                <Th onClick={() => setSortKey('size')}>Size</Th>
                <Th>Entry</Th>
                <Th>Mark</Th>
                <Th onClick={() => setSortKey('pnl')}>PnL</Th>
                <Th onClick={() => setSortKey('liqDist')}>Liq</Th>
                <Th>Funding 8h</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-neutral-600 text-sm">
                    no open positions across watched traders right now.
                  </td>
                </tr>
              )}
              {sorted.map((p, i) => (
                <PositionRow key={`${p.trader}-${p.venue}-${p.symbol}-${i}`} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && positions.length === 0 && (
        <div className="text-center py-8 text-neutral-600 text-sm">loading positions…</div>
      )}
    </div>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────── */

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'pump' | 'rekt' }) {
  const color = tone === 'pump' ? 'text-green-400' : tone === 'rekt' ? 'text-red-400' : 'text-white';
  return (
    <div className="rounded-xl border border-white/[0.06] bg-hub-darker px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function BookmarkChip({ bookmark, onRemove }: { bookmark: TraderBookmark; onRemove: () => void }) {
  const label = bookmark.displayName?.trim() || trunc(bookmark.address);
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
      <Star className="w-3 h-3 text-hub-yellow fill-current" />
      <span className="text-white">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 text-neutral-600 hover:text-red-400"
        aria-label="Remove trader"
        title="Remove from watchlist"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      className={`text-left font-semibold px-3 py-2.5 whitespace-nowrap ${onClick ? 'cursor-pointer hover:text-neutral-300' : ''}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
      </span>
    </th>
  );
}

function PositionRow({ p }: { p: NormalizedPosition }) {
  const sideColor = p.side === 'long' ? 'text-green-400 bg-green-500/[0.08]' : 'text-red-400 bg-red-500/[0.08]';
  const pnlColor = (p.unrealizedPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400';
  const liqColor = p.liqDistPct == null ? 'text-neutral-600'
                 : p.liqDistPct < 5 ? 'text-red-400'
                 : p.liqDistPct < 15 ? 'text-amber-400'
                 : 'text-neutral-400';

  return (
    <tr className="border-t border-white/[0.04] hover:bg-white/[0.02]">
      <td className="px-3 py-2.5 font-mono text-[11px] text-neutral-300 whitespace-nowrap">
        {p.traderLabel}
      </td>
      <td className="px-3 py-2.5 font-mono text-[10px] text-neutral-500">{p.venue}</td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <TokenIconSimple symbol={p.symbol} size={16} />
          <span className="font-bold text-white">{p.symbol}</span>
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sideColor}`}>
          {p.side.toUpperCase()}
          {p.leverage != null && p.leverage > 0 && (
            <span className="ml-1 opacity-70">{p.leverage.toFixed(0)}x</span>
          )}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-white whitespace-nowrap">{fmtUsd(p.sizeUsd)}</td>
      <td className="px-3 py-2.5 font-mono text-neutral-400 whitespace-nowrap">{fmtPrice(p.entryPrice)}</td>
      <td className="px-3 py-2.5 font-mono text-white whitespace-nowrap">{fmtPrice(p.markPrice)}</td>
      <td className={`px-3 py-2.5 font-mono whitespace-nowrap ${pnlColor}`}>
        {fmtUsd(p.unrealizedPnl, { sign: true })}
        {p.pnlPct != null && (
          <div className="text-[10px] opacity-70">{fmtPct(p.pnlPct, { sign: true })}</div>
        )}
      </td>
      <td className={`px-3 py-2.5 font-mono whitespace-nowrap ${liqColor}`}>
        {p.liqPrice == null ? '—' : (
          <>
            {fmtPrice(p.liqPrice)}
            {p.liqDistPct != null && (
              <div className="text-[10px] opacity-70 inline-flex items-center gap-1">
                {p.liqDistPct < 5 && <AlertTriangle className="w-2.5 h-2.5" />}
                {p.liqDistPct.toFixed(1)}% away
              </div>
            )}
          </>
        )}
      </td>
      <td className="px-3 py-2.5 font-mono text-neutral-400 whitespace-nowrap">
        {fmtPct(p.funding8hPct, { sign: true, digits: 3 })}
      </td>
      <td className="px-3 py-2.5">
        <Link
          href={`/trader/${p.trader}`}
          className="inline-flex items-center gap-1 text-neutral-500 hover:text-hub-yellow text-[10px]"
          title="Open full trader profile"
        >
          <ExternalLink className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

/**
 * Browser-side activity feed for bookmarked traders. Wired to
 * useTraderAlerts which polls /api/hl-traders/[addr] every 2 min and
 * diffs against the local snapshot to emit opened/closed/resize/flipped
 * events. Snake's core requirement: see when a watched trader closes
 * so you can mirror the exit.
 */
function ActivityFeed({
  feed, clearFeed, alertsEnabled, toggleAlerts, lastCheck, nowTick, watchedCount,
}: {
  feed: ReturnType<typeof useTraderAlerts>['feed'];
  clearFeed: ReturnType<typeof useTraderAlerts>['clearFeed'];
  alertsEnabled: boolean;
  toggleAlerts: () => void;
  lastCheck: number | null;
  nowTick: number;
  watchedCount: number;
}) {
  if (watchedCount === 0) return null;
  return (
    <div className="mb-5 rounded-xl border border-white/[0.06] bg-hub-darker p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Bell className="w-3.5 h-3.5 text-hub-yellow" />
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Tracked activity</h2>
        <span className="text-[10px] text-neutral-500 font-mono">{feed.length} events</span>
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
          Turn on alerts to get browser notifications when watched traders open, close, or resize positions.
          Polls every 2 min. No backend — runs in your tab.
        </div>
      ) : feed.length === 0 ? (
        <div className="text-[11px] text-neutral-500">
          Watching {watchedCount} trader{watchedCount !== 1 ? 's' : ''}. No position changes yet — baseline snapshot captured.
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
                <span className="text-[9px] text-neutral-600 font-mono flex-shrink-0">{agoStr}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
