/**
 * Multi-venue wallet position watcher — shared types + state fetchers +
 * diff function used by both /api/cron/watch-hl-wallets (server) and
 * /watch (UI for previewing what would fire).
 *
 * Venues currently supported:
 *   - 'hyperliquid' — clearinghouseState via api.hyperliquid.xyz
 *   - 'gtrade'      — getTrades(address) on Arbitrum diamond, via the
 *                     existing src/lib/wallet-clients/gtrade.ts client.
 *   - 'gmx'         — GMX V2 positions on Arbitrum + Avalanche via the
 *                     gmxWalletClient (which already merges both chains
 *                     and disambiguates collisions). Added May 2026 in
 *                     response to christian needing Telegram pings on
 *                     0xabF6 / 0xB8ba (his counter-traders on Arbitrum)
 *                     — /trader-watch shows the same data but only
 *                     while a tab's open.
 *
 * The cron polls each watched address every 60s for each venue, calls
 * `fetchVenueState(address, venue)` to grab current positions, then
 * `diffSnapshots(prev, curr)` against the row stored per (address, venue)
 * in hl_position_snapshots. Each event the differ returns is appended
 * to hl_position_events and fanned out to every subscribed user (with
 * per-trigger filtering applied) for Telegram delivery.
 *
 * Funding tracking is HL-only — gTrade + GMX V2 settle borrow/funding on
 * close and the on-chain readers don't surface a running cumulative
 * figure, so funding_paid events never fire for gTrade or GMX addresses.
 */

import type { HLClearingHouseState, HLPosition } from '@/app/api/_shared/hyperliquid-types';
import { gtradeWalletClient } from '@/lib/wallet-clients/gtrade';
import { gmxWalletClient } from '@/lib/wallet-clients/gmx';

export type Venue = 'hyperliquid' | 'gtrade' | 'gmx';
export const VENUES: Venue[] = ['hyperliquid', 'gtrade', 'gmx'];

export type WatchEventKind =
  | 'opened'        // new symbol on the book
  | 'closed'        // symbol gone from book (with realized PnL approx)
  | 'size_changed'  // notional changed by > threshold
  | 'liq_danger'    // distance-to-liq crossed below threshold
  | 'realized_pnl'  // (subset of closed) close with abs(realized) > threshold
  | 'funding_paid'; // cumFunding delta exceeds threshold

export interface PositionLite {
  coin: string;
  szi: number;             // signed size (negative = short)
  positionValue: number;   // |notional| in USD
  entryPx: number;
  /** Current mark price — required for liq-danger distance calculation
   *  to actually move tick-over-tick. Falls back to entryPx if upstream
   *  doesn't surface a separate mark (early tick, partial data, etc). */
  markPx: number;
  liquidationPx: number | null;
  unrealizedPnl: number;
  cumFundingAllTime: number;
}

export interface AccountSnapshot {
  address: string;
  venue: Venue;
  positions: PositionLite[];
  accountValue: number;
  ts: number;
}

/** Side-effecting payload of a single watch event. Exported so the
 *  /watch UI can type its EventRow against the same shape the differ
 *  emits and never drift out of sync. */
export interface WatchEventPayload {
  side?: 'long' | 'short';
  sizeUsd?: number;       // current notional
  prevSizeUsd?: number;
  deltaPct?: number;      // signed delta vs previous notional
  distPct?: number;       // distance to liq, fraction (current tick)
  prevDistPct?: number;   // distance to liq, fraction (previous tick) — used by
                          // applyThresholds for edge-triggered liq_danger alerts
  realizedPnl?: number;
  fundingDelta?: number;  // signed, negative = paid
}

export interface WatchEvent {
  kind: WatchEventKind;
  symbol: string;
  payload: WatchEventPayload;
}

/**
 * Cron-safety ceiling on watched wallets per user. Imported by both
 * the /watch UI ('Watching N/MAX' counter, disabled state) and the
 * /api/watch/wallets POST handler (server enforcement). Acts as a
 * floor on `min(tierLimit, MAX_WATCHED_WALLETS)` — the tier limit
 * from TIER_LIMITS still applies on top of this.
 *
 * Sizing: VENUES.length === 3 (hyperliquid + gtrade + gmx) and the
 * runner's CONCURRENCY === 8 (see hl-watch-runner.ts). So a full
 * tick with N wallets does ~(N × 3 / 8) seconds of work in the
 * worst case where every fetch takes ~1s. The 60s tick window
 * comfortably supports N = 100 (≈ 37s) which matches the Pro tier's
 * advertised "100 watched wallets" cap. Bump only after re-running
 * the math; raising past ~150 risks runs overlapping ticks.
 *
 * Previously 25 — that ceiling silently capped Pro users (paying
 * for 100) at 25 and Whale users (paying for unlimited) at 25,
 * making the pricing copy a lie. Fixed May 2026.
 */
export const MAX_WATCHED_WALLETS = 100;

export interface Thresholds {
  triggerOpened: boolean;
  triggerClosed: boolean;
  triggerSizeChanged: boolean;
  triggerLiqDanger: boolean;
  triggerRealizedPnl: boolean;
  triggerFundingPaid: boolean;
  sizeChangePct: number;     // 0.10 = 10%
  liqDangerPct: number;      // 0.05 = 5%
  realizedPnlUsd: number;    // 1000
  fundingPaidUsd: number;    // 1000
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  triggerOpened: true,
  triggerClosed: true,
  triggerSizeChanged: true,
  triggerLiqDanger: true,
  triggerRealizedPnl: true,
  triggerFundingPaid: true,
  sizeChangePct: 0.10,
  liqDangerPct: 0.05,
  realizedPnlUsd: 1000,
  fundingPaidUsd: 1000,
};

const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';

/** Dispatch — pull the current state for an (address, venue) pair and
 *  reduce it to the trim "lite" shape the differ expects. Returns null
 *  on error. */
export async function fetchVenueState(address: string, venue: Venue): Promise<AccountSnapshot | null> {
  if (venue === 'hyperliquid') return fetchHLState(address);
  if (venue === 'gtrade')      return fetchGTradeState(address);
  if (venue === 'gmx')         return fetchGMXState(address);
  return null;
}

/** Back-compat alias — the cron used to call fetchHLState directly. */
export async function fetchHLState(address: string): Promise<AccountSnapshot | null> {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as HLClearingHouseState;
    return reduceHLState(address, json);
  } catch {
    return null;
  }
}

async function fetchGTradeState(address: string): Promise<AccountSnapshot | null> {
  try {
    const positions = await gtradeWalletClient.fetchPositions(address);
    return {
      address: address.toLowerCase(),
      venue: 'gtrade',
      positions: positions.map(p => {
        const szi = (p.side === 'short' ? -1 : 1) * (p.size ?? 0);
        const entryPx = p.entryPrice ?? 0;
        // gTrade reader fetches mark via Binance fapi already — use it
        // so liq-danger has real per-tick distance. Falls back to entry
        // when Binance doesn't list the symbol.
        const markPx = p.markPrice ?? entryPx;
        const reportedValue = Math.abs(p.positionValue ?? 0);
        const fallbackValue = Math.abs(szi * markPx);
        return {
          coin: p.symbol,
          // sign szi so size_changed % math + side detection both work.
          szi,
          // Same $0-fallback as HL — if positionValue is 0/null, recompute
          // from |szi × mark| so the 'opened' Telegram doesn't read "$0.00".
          positionValue: reportedValue > 0 ? reportedValue : fallbackValue,
          entryPx,
          markPx,
          liquidationPx: p.liquidationPrice ?? null,
          unrealizedPnl: p.unrealizedPnl ?? 0,
          // gTrade doesn't surface a running cumulative funding figure;
          // borrow fees are computed on close. Set to 0 so the funding
          // delta is always 0 → funding_paid never fires for gTrade.
          cumFundingAllTime: 0,
        };
      }),
      accountValue: 0, // gTrade trades are isolated-margin; no account-wide equity
      ts: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchGMXState(address: string): Promise<AccountSnapshot | null> {
  // gmxWalletClient.fetchPositions hits BOTH Arbitrum and Avalanche
  // subsquids in parallel and tags Avalanche-only collisions with
  // a "(Avax)" suffix, so we get one merged list per address. That
  // matches the "one snapshot row per (address, venue) pair" DB
  // shape — we don't need two separate gmx-arbitrum / gmx-avalanche
  // venues for the differ to work, since the symbol field already
  // disambiguates cross-chain duplicates.
  try {
    const positions = await gmxWalletClient.fetchPositions(address);
    return {
      address: address.toLowerCase(),
      venue: 'gmx',
      positions: positions.map(p => {
        const szi = (p.side === 'short' ? -1 : 1) * (p.size ?? 0);
        const entryPx = p.entryPrice ?? 0;
        // GMX subsquid + tickers gives us a live mark — fall back to
        // entry so liq-danger distance still has a value on partial
        // ticks rather than computing distance against entry forever.
        const markPx = p.markPrice ?? entryPx;
        const reportedValue = Math.abs(p.positionValue ?? 0);
        const fallbackValue = markPx > 0 ? Math.abs(szi * markPx) : 0;
        return {
          coin: p.symbol,
          szi,
          positionValue: reportedValue > 0 ? reportedValue : fallbackValue,
          entryPx,
          markPx,
          liquidationPx: p.liquidationPrice ?? null,
          unrealizedPnl: p.unrealizedPnl ?? 0,
          // Same as gTrade — GMX V2 doesn't surface a running funding
          // accumulator (funding settles on close). Setting this to 0
          // means the funding delta is always 0 → funding_paid events
          // never fire for GMX wallets, matching the user-visible
          // promise documented at the top of this file.
          cumFundingAllTime: 0,
        };
      }),
      // GMX positions are isolated-margin per pool — no single
      // account-wide equity figure to surface.
      accountValue: 0,
      ts: Date.now(),
    };
  } catch {
    return null;
  }
}

function reduceHLState(address: string, json: HLClearingHouseState): AccountSnapshot {
  const positions: PositionLite[] = (json.assetPositions ?? [])
    .map(ap => parsePosition(ap.position))
    .filter((p): p is PositionLite => p !== null);
  return {
    address: address.toLowerCase(),
    venue: 'hyperliquid',
    positions,
    accountValue: parseFloat(json.marginSummary?.accountValue ?? '0') || 0,
    ts: json.time ?? Date.now(),
  };
}

function parsePosition(p: HLPosition): PositionLite | null {
  const szi = parseFloat(p.szi);
  if (!Number.isFinite(szi) || szi === 0) return null;
  const entryPx = parseFloat(p.entryPx) || 0;
  const unrealizedPnl = parseFloat(p.unrealizedPnl) || 0;
  // HL doesn't return mark directly on clearinghouseState. Back it out
  // from unrealizedPnl: pnl = szi * (mark - entry) → mark = entry + pnl/szi.
  // (szi is signed: positive long, negative short.)
  const markPxFromPnl = szi !== 0 && entryPx > 0
    ? entryPx + (unrealizedPnl / szi)
    : entryPx;
  const markPx = Number.isFinite(markPxFromPnl) && markPxFromPnl > 0 ? markPxFromPnl : entryPx;

  // positionValue (notional in USD): HL sometimes returns "0" or empty
  // string on the very first tick after open before the field populates,
  // which makes our 'opened' event payload show "$0.00". Fall back to
  // |szi × markPx| (or × entryPx) so the user still sees a real notional
  // for those edge ticks. The wallet-size validation upstream guarantees
  // szi × markPx is non-zero for any szi !== 0.
  const reportedValue = Math.abs(parseFloat(p.positionValue) || 0);
  const fallbackValue = Math.abs(szi * markPx);
  const positionValue = reportedValue > 0 ? reportedValue : fallbackValue;

  return {
    coin: p.coin,
    szi,
    positionValue,
    entryPx,
    markPx,
    liquidationPx: p.liquidationPx ? (parseFloat(p.liquidationPx) || null) : null,
    unrealizedPnl,
    cumFundingAllTime: parseCumFundingAllTime(p),
  };
}

/**
 * Read HL cumulative funding-paid with explicit schema-drift logging.
 * Was inline as `parseFloat(p.cumFunding?.allTime ?? '0') || 0` — the
 * optional chain silently returned 0 for every position if HL ever
 * renamed `cumFunding` (they've done it: it was once `funding`). That
 * killed `funding_paid` Telegram alerts across all watched HL wallets
 * with zero log signal, since 0 − 0 = 0 in the diff. Now we warn loudly
 * the first time it goes missing, while still falling back to 0 so a
 * single bad position doesn't kill the whole tick.
 */
let cumFundingDriftWarned = false;
function parseCumFundingAllTime(p: HLPosition): number {
  if (!p.cumFunding || typeof p.cumFunding.allTime !== 'string') {
    if (!cumFundingDriftWarned) {
      console.warn(`[hl-watch] HL schema drift: cumFunding.allTime missing (first seen on coin=${p.coin})`);
      cumFundingDriftWarned = true;
    }
    return 0;
  }
  const parsed = parseFloat(p.cumFunding.allTime);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sideOf(szi: number): 'long' | 'short' {
  return szi >= 0 ? 'long' : 'short';
}

// ─── JSONB parse helpers ──────────────────────────────────────────────
// postgres.js returns JSONB columns either as parsed objects/arrays OR
// as raw JSON strings, depending on connection setup. Without these
// guards the runner's snapshot diff sees prev=[] every tick (string is
// not Array), the UI's formatEvent reads payload.side on a string and
// gets undefined — silent breakage in both cases.

/** Safely parse a JSONB array column. Returns the array (parsed if string,
 *  passed through if already array, [] otherwise). Generic so callers can
 *  type the inner element. */
export function parseJsonbArray<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch { return []; }
  }
  return [];
}

/** Safely parse a JSONB object column. Returns the object (parsed if
 *  string, passed through if already object, {} otherwise). Generic
 *  so callers can type the shape. */
export function parseJsonbObject<T extends Record<string, unknown> = Record<string, unknown>>(raw: unknown): T {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as T;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed as T : {} as T;
    } catch { return {} as T; }
  }
  return {} as T;
}

/** Diff two snapshots and emit one event per detected change. Caller
 *  filters by Thresholds before delivery (so we still log everything,
 *  but only ping users for their enabled triggers). */
export function diffSnapshots(prev: AccountSnapshot | null, curr: AccountSnapshot): WatchEvent[] {
  // First snapshot ever — nothing to diff against, no events.
  if (!prev) return [];

  const events: WatchEvent[] = [];
  const prevMap = new Map(prev.positions.map(p => [p.coin, p]));
  const currMap = new Map(curr.positions.map(p => [p.coin, p]));

  // ── Opens: in curr, not in prev ───────────────────────────────────
  for (const [coin, pos] of Array.from(currMap.entries())) {
    if (prevMap.has(coin)) continue;
    events.push({
      kind: 'opened',
      symbol: coin,
      payload: { side: sideOf(pos.szi), sizeUsd: pos.positionValue },
    });
  }

  // ── Closes: in prev, not in curr ──────────────────────────────────
  // Use the previous unrealizedPnl as an approximation of realized PnL.
  // It's not exact (the close fill price might differ from prev mark)
  // but it's the best we have without scraping fills, and the user
  // gets a same-direction approximation.
  for (const [coin, prevPos] of Array.from(prevMap.entries())) {
    if (currMap.has(coin)) continue;
    events.push({
      kind: 'closed',
      symbol: coin,
      payload: {
        side: sideOf(prevPos.szi),
        prevSizeUsd: prevPos.positionValue,
        realizedPnl: prevPos.unrealizedPnl,
      },
    });
  }

  // ── Size changes / liq danger / funding deltas: in both ───────────
  for (const [coin, currPos] of Array.from(currMap.entries())) {
    const prevPos = prevMap.get(coin);
    if (!prevPos) continue;

    // Size change
    if (prevPos.positionValue > 0) {
      const delta = (currPos.positionValue - prevPos.positionValue) / prevPos.positionValue;
      if (Math.abs(delta) >= 0.01) {  // emit raw, threshold filtering happens at send time
        events.push({
          kind: 'size_changed',
          symbol: coin,
          payload: {
            side: sideOf(currPos.szi),
            prevSizeUsd: prevPos.positionValue,
            sizeUsd: currPos.positionValue,
            deltaPct: delta,
          },
        });
      }
    }

    // Liq danger — fired when distance just crossed lower vs the prev
    // tick. Distance is mark-vs-liq (NOT entry-vs-liq); entry is constant
    // for the life of the position so an entry-based distance never
    // changes tick-to-tick and the alert would never fire. mark moves
    // every tick from upstream (HL: derived from unrealizedPnl; gTrade:
    // Binance fapi spot lookup).
    if (currPos.liquidationPx && currPos.markPx > 0) {
      const currDist = Math.abs(currPos.markPx - currPos.liquidationPx) / currPos.markPx;
      const prevDist = prevPos.liquidationPx && prevPos.markPx > 0
        ? Math.abs(prevPos.markPx - prevPos.liquidationPx) / prevPos.markPx
        : 1;
      // Always emit when distance moved closer; the EDGE-trigger check
      // (prev was above threshold, curr is at/below) happens in
      // applyThresholds where the user's per-wallet threshold lives.
      // Without that edge check, a position decaying toward liq fires
      // an alert on EVERY 60s tick instead of once when the danger
      // band is crossed.
      if (currDist < prevDist) {
        events.push({
          kind: 'liq_danger',
          symbol: coin,
          payload: { side: sideOf(currPos.szi), distPct: currDist, prevDistPct: prevDist },
        });
      }
    }

    // Funding paid — track cumFunding allTime delta. cumFunding is
    // negative when paid (to longs receiving), so delta sign tells
    // direction. We emit on |delta| >= 1; threshold filter is at send.
    const fundingDelta = currPos.cumFundingAllTime - prevPos.cumFundingAllTime;
    if (Math.abs(fundingDelta) >= 1) {
      events.push({
        kind: 'funding_paid',
        symbol: coin,
        payload: { side: sideOf(currPos.szi), fundingDelta },
      });
    }
  }

  return events;
}

/** Filter raw events by user thresholds. The differ emits everything;
 *  this is the per-user filter applied at send time so each user only
 *  hears about events that matter to them. */
export function applyThresholds(events: WatchEvent[], t: Thresholds): WatchEvent[] {
  return events.filter(e => {
    switch (e.kind) {
      case 'opened':
        return t.triggerOpened;
      case 'closed': {
        if (!t.triggerClosed && !t.triggerRealizedPnl) return false;
        // realized_pnl is a subset of closed — if user enabled realized_pnl
        // but not closed, only fire when |realized| exceeds threshold
        if (!t.triggerClosed && t.triggerRealizedPnl) {
          const realized = e.payload.realizedPnl ?? 0;
          return Math.abs(realized) >= t.realizedPnlUsd;
        }
        return true;
      }
      case 'size_changed':
        return t.triggerSizeChanged && Math.abs(e.payload.deltaPct ?? 0) >= t.sizeChangePct;
      case 'liq_danger': {
        // Edge-triggered: fire ONLY when this tick crossed from above
        // the danger threshold to at/below it. Was firing every tick
        // a position kept moving toward liq, which produced a steady
        // notification storm and tripped Telegram rate limits.
        if (!t.triggerLiqDanger) return false;
        const curr = e.payload.distPct ?? 1;
        const prev = e.payload.prevDistPct ?? 1;
        // Cross-into-band: prev was above threshold, curr is at/below.
        // If we don't have a prevDistPct (older event from before this
        // fix shipped) fall back to level-trigger so existing rows
        // still surface — they'll deduplicate via hl_event_notifications
        // anyway.
        if (prev > t.liqDangerPct) return curr <= t.liqDangerPct;
        return false;
      }
      case 'realized_pnl':
        return t.triggerRealizedPnl && Math.abs(e.payload.realizedPnl ?? 0) >= t.realizedPnlUsd;
      case 'funding_paid':
        return t.triggerFundingPaid && Math.abs(e.payload.fundingDelta ?? 0) >= t.fundingPaidUsd;
      default:
        return false;
    }
  });
}

/** Format an event into a Telegram-ready message. */
export function formatEvent(e: WatchEvent, address: string, label?: string, venue: Venue = 'hyperliquid'): string {
  const who = label ? `*${escapeMd(label)}* (\`${shortAddr(address)}\`)` : `\`${shortAddr(address)}\``;
  const sym = `*${escapeMd(e.symbol)}*`;
  const venueTag = venue === 'gtrade' ? ' · _gTrade_'
                 : venue === 'gmx'    ? ' · _GMX_'
                 : ' · _Hyperliquid_';
  switch (e.kind) {
    case 'opened': {
      const dir = e.payload.side === 'short' ? '🔻 SHORT' : '🟢 LONG';
      return `${dir} opened${venueTag}\n${who}\n${sym} · ${fmtUsd(e.payload.sizeUsd ?? 0)}`;
    }
    case 'closed': {
      const dir = e.payload.side === 'short' ? '🔻 SHORT' : '🟢 LONG';
      const pnl = e.payload.realizedPnl ?? 0;
      const pnlLine = pnl >= 0 ? `realized *+${fmtUsd(pnl)}* ✅` : `realized *${fmtUsd(pnl)}* ❌`;
      return `${dir} CLOSED${venueTag}\n${who}\n${sym} · was ${fmtUsd(e.payload.prevSizeUsd ?? 0)} · ${pnlLine}`;
    }
    case 'size_changed': {
      const delta = e.payload.deltaPct ?? 0;
      const arrow = delta > 0 ? '📈 INCREASED' : '📉 DECREASED';
      return `${arrow}${venueTag}\n${who}\n${sym} · ${fmtUsd(e.payload.prevSizeUsd ?? 0)} → ${fmtUsd(e.payload.sizeUsd ?? 0)} (${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%)`;
    }
    case 'liq_danger': {
      // Severity grade — copy-traders ignore raw "8.2%" but a coloured
      // tag forces a glance-triage. Thresholds picked from cascade
      // behaviour observed on Hyperliquid (<5% = cascade-likely zone).
      const dist = Math.abs(e.payload.distPct ?? 1);
      const d = dist * 100;
      const tag = dist < 0.05 ? '🔴 *CRITICAL*'
                : dist < 0.10 ? '🟡 *WARNING*'
                : '🟢 caution';
      return `${tag} · NEAR LIQ${venueTag}\n${who}\n${sym} now *${d.toFixed(2)}%* from liquidation`;
    }
    case 'realized_pnl': {
      return formatEvent({ ...e, kind: 'closed' }, address, label, venue);
    }
    case 'funding_paid': {
      const fd = e.payload.fundingDelta ?? 0;
      const verb = fd < 0 ? '💸 PAID' : '💰 RECEIVED';
      return `${verb} funding${venueTag}\n${who}\n${sym} · ${fmtUsd(Math.abs(fd))}`;
    }
  }
}

function shortAddr(a: string): string {
  if (!a) return '0x…';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function escapeMd(s: string): string {
  // Telegram MarkdownV1 — only need to escape '*' '_' '`' for our format
  return s.replace(/[*_`]/g, '\\$&');
}
