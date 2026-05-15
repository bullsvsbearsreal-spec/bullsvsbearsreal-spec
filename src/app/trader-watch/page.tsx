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

// Matches the actual shape returned by `/api/hl-traders/[address]` —
// see src/app/api/hl-traders/[address]/route.ts. The earlier version of
// this type modeled HL's raw clearinghouseState payload (szi/entryPx/
// markPx), which the route normalises away before responding. Result was
// every HL trader showed an empty position list on /trader-watch.
interface HLPositionRow {
  coin: string;
  isLong: boolean;
  size: number;                  // absolute base-asset size
  sizeUsd: number;
  entryPrice: number;
  liquidationPrice: number | null;
  unrealizedPnl: number;
  roePct: number;
  leverage: number | null;       // already-unwrapped numeric value
  leverageType: string | null;
}

interface HLResponse {
  address: string;
  openPositions: HLPositionRow[];
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
    // /api/gmx-traders/[address] returns the dossier at the top level
    // ({ address, summary, openPositions, recentTrades, meta }) — there
    // is no `data` envelope. The earlier `json?.data?.openPositions`
    // path was always undefined → every GMX bookmark rendered an
    // empty row count. Same bug shape as the HL fetcher fixed in
    // commit 03cbe053.
    const json = (await res.json()) as Partial<GMXDossier>;
    const positions = json?.openPositions ?? [];
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
    const positions = json.openPositions ?? [];
    return positions.map(p => {
      // HL's API doesn't surface mark directly on positions — derive it
      // from entry + unrealizedPnl / signedSize. Matches the convention
      // in CLAUDE.md ("HL clearinghouseState doesn't return mark price —
      // derive via mark = entryPx + unrealizedPnl / szi").
      const signedSize = p.isLong ? p.size : -p.size;
      const mark = (signedSize !== 0 && Number.isFinite(p.entryPrice) && Number.isFinite(p.unrealizedPnl))
        ? p.entryPrice + p.unrealizedPnl / signedSize
        : null;
      const liq = p.liquidationPrice;
      const liqDist = (liq != null && mark != null && mark > 0)
        ? (Math.abs(mark - liq) / mark) * 100
        : null;
      return {
        trader: address.toLowerCase(),
        traderLabel: trunc(address),
        venue: 'HL' as const,
        symbol: (p.coin || '').toUpperCase(),
        side: p.isLong ? 'long' : 'short',
        sizeUsd: p.sizeUsd,
        entryPrice: p.entryPrice,
        markPrice: mark,
        unrealizedPnl: p.unrealizedPnl,
        pnlPct: p.roePct,
        liqPrice: liq,
        liqDistPct: liqDist,
        leverage: p.leverage,
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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<'pnl' | 'size' | 'liqDist' | 'symbol'>('size');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Click a bookmark chip to filter the table to just that trader's
  // positions. Click again (or the explicit Clear button) to reset.
  // Helps when one user is watching 6+ traders and the table balloons
  // to 30+ rows — narrowing to one trader is the most common ask.
  const [filterAddr, setFilterAddr] = useState<string | null>(null);
  // Quick side filter — long-only / short-only / all. Most common
  // use is "show me only the side I'm currently positioned" so the
  // trader-watch becomes a mirror-trade dashboard.
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all');
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
    // `hasLoadedOnce` distinguishes "still loading the first batch"
    // (show skeleton) from "loaded and there really are zero positions"
    // (show empty state). Was: both states showed identical "no open
    // positions" text, so a slow first fetch on a many-bookmark account
    // looked like the page was broken.
    setHasLoadedOnce(true);
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

  // Filtered + sorted view. Filters run first (trader chip + side
  // toggle) so the "sorted" array reflects exactly what hits the table.
  // Sort direction flips per click on a sortable header — first click
  // selects the column and uses the natural default direction (desc
  // for $, asc for symbol/liqDist), second click on the same column
  // reverses it. liqDist's natural direction is asc ("most at-risk
  // first") which is the opposite of every other column.
  const sorted = useMemo(() => {
    let arr = [...positions];
    if (filterAddr) {
      const lower = filterAddr.toLowerCase();
      arr = arr.filter(p => p.trader === lower);
    }
    if (sideFilter !== 'all') {
      arr = arr.filter(p => p.side === sideFilter);
    }
    const dirMul = sortDir === 'asc' ? -1 : 1;
    switch (sortKey) {
      case 'pnl':
        arr.sort((a, b) => ((b.unrealizedPnl ?? 0) - (a.unrealizedPnl ?? 0)) * dirMul);
        break;
      case 'size':
        arr.sort((a, b) => (b.sizeUsd - a.sizeUsd) * dirMul);
        break;
      case 'liqDist':
        // liqDist sort is naturally "smallest first = most at-risk first."
        // dirMul of 1 (desc default) gives that ordering; flip for asc.
        arr.sort((a, b) => ((a.liqDistPct ?? Infinity) - (b.liqDistPct ?? Infinity)) * dirMul);
        break;
      case 'symbol':
        arr.sort((a, b) => a.symbol.localeCompare(b.symbol) * dirMul);
        break;
    }
    return arr;
  }, [positions, sortKey, sortDir, filterAddr, sideFilter]);

  const handleSort = useCallback((key: typeof sortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        // Same column clicked — flip direction.
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      // New column — reset to that column's natural default direction.
      setSortDir('desc');
      return key;
    });
  }, []);

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
            positions and funding exposure on one screen (plus liq distance for
            Hyperliquid; GMX subsquid doesn&apos;t expose liq prices).
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
      {/* Hero — Snake's page gets the same vocabulary as /funding-arb
          + /watch + /positions: gradient icon tile, bold title with
          accent color on the noun, live counters in the subline. */}
      <header className="mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/[0.04] border border-hub-yellow/20 flex items-center justify-center">
                <Star className="w-4 h-4 text-hub-yellow fill-current" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Watchlist</span>
            </div>
            <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
              Trader <span className="text-hub-yellow">watch</span>
            </h1>
            <p className="text-[13px] text-neutral-400 mt-2 font-mono">
              <span className="text-white font-bold">{bookmarks.length}</span> {bookmarks.length === 1 ? 'trader' : 'traders'}
              {' · '}
              <span className="text-white font-bold">{positions.length}</span> open {positions.length === 1 ? 'position' : 'positions'}
              {lastRefresh && (
                <>
                  {' · '}
                  <span className="text-neutral-500">refreshed {Math.floor((nowTick - lastRefresh) / 1000)}s ago</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-xs font-semibold hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition-colors shrink-0 self-start lg:self-end"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

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

      {/* Watched-traders strip. Each chip is also a filter — click to
          narrow the table to just that trader, click again to clear.
          The X button still removes the bookmark entirely. */}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        {bookmarks.map(b => (
          <BookmarkChip
            key={b.address}
            bookmark={b}
            active={filterAddr === b.address}
            onSelect={() => setFilterAddr(prev => prev === b.address ? null : b.address)}
            onRemove={() => {
              if (filterAddr === b.address) setFilterAddr(null);
              remove(b.address);
            }}
          />
        ))}
        {filterAddr && (
          <button
            type="button"
            onClick={() => setFilterAddr(null)}
            className="text-[10px] text-neutral-500 hover:text-white inline-flex items-center gap-1 px-2 py-1 rounded border border-white/[0.06] hover:border-white/[0.15] transition-colors"
          >
            <X className="w-2.5 h-2.5" />
            Clear filter
          </button>
        )}
      </div>

      {/* Side filter chips — sit just above the table to make the
          long/short scope obvious before scanning rows. */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">Side</span>
        {(['all', 'long', 'short'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSideFilter(s)}
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
              sideFilter === s
                ? s === 'long' ? 'bg-green-500/20 text-green-400 border border-green-400/30'
                : s === 'short' ? 'bg-red-500/20 text-red-400 border border-red-400/30'
                : 'bg-white/[0.08] text-white border border-white/[0.15]'
                : 'bg-white/[0.02] text-neutral-500 border border-white/[0.04] hover:text-white hover:border-white/[0.12]'
            }`}
          >
            {s}
          </button>
        ))}
        {(filterAddr || sideFilter !== 'all') && positions.length !== sorted.length && (
          <span className="text-[10px] text-neutral-500 font-mono ml-1">
            {sorted.length} of {positions.length} shown
          </span>
        )}
      </div>

      {/* Positions table */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-hub-darker">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                <Th>Trader</Th>
                <Th>Venue</Th>
                <Th sortKey="symbol" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Symbol</Th>
                <Th>Side</Th>
                <Th sortKey="size" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Size</Th>
                <Th>Entry</Th>
                <Th>Mark</Th>
                <Th sortKey="pnl" activeKey={sortKey} dir={sortDir} onSort={handleSort}>PnL</Th>
                <Th sortKey="liqDist" activeKey={sortKey} dir={sortDir} onSort={handleSort}>Liq</Th>
                <Th>Funding 8h</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && hasLoadedOnce && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-neutral-600 text-sm">
                    {filterAddr || sideFilter !== 'all'
                      ? 'no positions match the current filter.'
                      : 'no open positions across watched traders right now.'}
                  </td>
                </tr>
              )}
              {sorted.length === 0 && !hasLoadedOnce && (
                // Skeleton rows so the table reserves the right height
                // during initial load instead of jumping when data arrives.
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-t border-white/[0.04]">
                    <td colSpan={11} className="px-3 py-3">
                      <div className="h-3 rounded bg-white/[0.04] animate-pulse" />
                    </td>
                  </tr>
                ))
              )}
              {sorted.map((p, i) => (
                <PositionRow
                  key={`${p.trader}-${p.venue}-${p.symbol}-${i}`}
                  p={p}
                  onTraderClick={(addr) => setFilterAddr(prev => prev === addr ? null : addr)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────── */

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'pump' | 'rekt' }) {
  // Accent-bar pattern matching /funding-arb, /watch, /positions.
  // Same visual vocabulary across every stat strip in the workflow
  // so trader-watch reads as part of the same family.
  const accent = tone === 'pump' ? 'before:bg-green-400'
               : tone === 'rekt' ? 'before:bg-red-400'
               : 'before:bg-white/10';
  const color = tone === 'pump' ? 'text-green-400'
              : tone === 'rekt' ? 'text-red-400'
              : 'text-white';
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01] px-4 py-3 before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] ${accent}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 mb-1 font-semibold">{label}</div>
      <div className={`text-lg font-bold font-mono tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function BookmarkChip({
  bookmark, active, onSelect, onRemove,
}: {
  bookmark: TraderBookmark;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const label = bookmark.displayName?.trim() || trunc(bookmark.address);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
        active
          ? 'bg-hub-yellow/[0.08] border-hub-yellow/40 text-white'
          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10]'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="inline-flex items-center gap-1.5"
        aria-pressed={active}
        title={active ? 'Click to clear filter' : 'Click to filter table to this trader'}
      >
        <Star className={`w-3 h-3 ${active ? 'text-hub-yellow' : 'text-hub-yellow'} fill-current`} />
        <span className="text-white">{label}</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="ml-1 text-neutral-600 hover:text-red-400"
        aria-label={`Remove ${label} from watchlist`}
        title="Remove from watchlist"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/** Table header. Pass `sortKey + activeKey + dir + onSort` to make
 *  the column sortable with an arrow indicator. Active column gets a
 *  brighter color so the user can see which one is currently driving
 *  the sort without having to remember. */
function Th({
  children, sortKey, activeKey, dir, onSort,
}: {
  children: React.ReactNode;
  sortKey?: 'pnl' | 'size' | 'liqDist' | 'symbol';
  activeKey?: 'pnl' | 'size' | 'liqDist' | 'symbol';
  dir?: 'asc' | 'desc';
  onSort?: (key: 'pnl' | 'size' | 'liqDist' | 'symbol') => void;
}) {
  const sortable = !!sortKey && !!onSort;
  const isActive = sortable && sortKey === activeKey;
  return (
    <th
      className={`text-left font-semibold px-3 py-2.5 whitespace-nowrap ${sortable ? 'cursor-pointer hover:text-neutral-300' : ''} ${isActive ? 'text-hub-yellow' : ''}`}
      onClick={sortable ? () => onSort!(sortKey) : undefined}
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && !isActive && <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
        {sortable && isActive && (
          <span className="text-[10px]" aria-hidden="true">
            {dir === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </span>
    </th>
  );
}

function PositionRow({ p, onTraderClick }: { p: NormalizedPosition; onTraderClick: (addr: string) => void }) {
  const sideColor = p.side === 'long' ? 'text-green-400 bg-green-500/[0.08]' : 'text-red-400 bg-red-500/[0.08]';
  const pnlColor = (p.unrealizedPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400';
  const liqColor = p.liqDistPct == null ? 'text-neutral-600'
                 : p.liqDistPct < 5 ? 'text-red-400'
                 : p.liqDistPct < 15 ? 'text-amber-400'
                 : 'text-neutral-400';
  // Subtle row-level highlight when a position is within 5% of liq
  // — catches the eye when scanning a 20+ row table. Was: only the
  // tiny AlertTriangle icon inside the Liq cell flagged it, easy to
  // miss in a dense view.
  const danger = p.liqDistPct != null && p.liqDistPct < 5;
  const rowClass = danger
    ? 'border-t border-red-500/30 bg-red-500/[0.04] hover:bg-red-500/[0.07]'
    : 'border-t border-white/[0.04] hover:bg-white/[0.02]';

  // Funding direction: which way is the carry flowing for THIS side?
  // Long + positive funding → trader pays (red, bleeding)
  // Short + negative funding → trader pays (red, bleeding)
  // Long + negative funding → trader receives (green, earning)
  // Short + positive funding → trader receives (green, earning)
  // null when funding data isn't available for this symbol. The watcher
  // mirror-trading the position would see the same direction, so the
  // color works for them too.
  let fundingColor = 'text-neutral-500';
  let fundingTitle: string | undefined;
  if (p.funding8hPct != null) {
    const paying = (p.side === 'long' && p.funding8hPct > 0) || (p.side === 'short' && p.funding8hPct < 0);
    if (Math.abs(p.funding8hPct) < 0.001) {
      // Near-zero — leave neutral
    } else if (paying) {
      fundingColor = 'text-red-400';
      fundingTitle = `${p.side} pays ${Math.abs(p.funding8hPct).toFixed(3)}% every 8h`;
    } else {
      fundingColor = 'text-green-400';
      fundingTitle = `${p.side} receives ${Math.abs(p.funding8hPct).toFixed(3)}% every 8h`;
    }
  }

  // Venue badge — colored chip instead of grey monospace text.
  const venueStyle =
    p.venue === 'GMX' ? 'bg-blue-500/[0.10] text-blue-300 border-blue-400/20' :
    p.venue === 'HL' ? 'bg-purple-500/[0.10] text-purple-300 border-purple-400/20' :
    'bg-amber-500/[0.10] text-amber-300 border-amber-400/20';

  return (
    <tr className={rowClass}>
      <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
        {/* Click trader label to filter — same action as the chip up
            top. Lets the user pivot to a single-trader view from any
            row without scrolling back up to the chip strip. */}
        <button
          type="button"
          onClick={() => onTraderClick(p.trader)}
          className="text-neutral-300 hover:text-hub-yellow transition-colors"
          title="Filter table to this trader"
        >
          {p.traderLabel}
        </button>
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${venueStyle}`}>
          {p.venue}
        </span>
      </td>
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
      <td
        className={`px-3 py-2.5 font-mono whitespace-nowrap ${fundingColor}`}
        title={fundingTitle}
      >
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
            // Tick driven — was Date.now() inline, evaluated once per
            // render so "30s ago" stayed frozen between the 30s refresh
            // ticks and jumped suddenly. nowTick updates every 1s.
            const ago = Math.floor((nowTick - a.timestamp) / 1000);
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
