/**
 * Smart Money Follow — rank top Hyperliquid wallets by REALIZED PnL.
 *
 * Different from /hl-whales (which shows OPEN positions ranked by account
 * value): this lib pulls every top wallet's recent fills via the public
 * userFillsByTime endpoint, sums closed-trade PnL, and ranks.
 *
 * Hyperliquid is the rare venue where every fill is publicly indexable
 * for any address — Nansen / Arkham charge $$$$ for the EVM equivalent
 * because chain reads are heavy. We get this for free on HL.
 *
 * Ranking horizon: 90 days. Fills cached 30 min per wallet to keep load
 * bounded (one cron tick per 30min refreshes the whole top-50 list).
 */
import { hyperliquidWalletClient } from './wallet-clients/hyperliquid';
import type { NormalizedTrade } from './wallet-clients/types';

const HL_LEADERBOARD_URL = 'https://api.hyperliquid.xyz/leaderboard';
const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
const TIMEOUT_MS = 8_000;

export interface SmartMoneyEntry {
  rank: number;
  address: string;
  label: string;
  /** Account NAV at HL right now. */
  accountValueUsd: number;
  /** All-time HL leaderboard PnL — what HL itself reports. */
  allTimePnlUsd: number;
  allTimeRoiPct: number;
  /** Closed-trade realized PnL summed from fills. */
  realised90dUsd: number;
  realised30dUsd: number;
  /** Closing-trade count over the lookback. */
  closingTrades90d: number;
  /** Wins / total closes (only counts trades with non-zero realized PnL). */
  winRatePct: number | null;
  /** Largest single-fill win/loss in the lookback. */
  biggestWinUsd: number;
  biggestLossUsd: number;
  /** Top traded symbols by close volume in 90d. */
  topSymbols: string[];
  /** Most recent fill timestamp. */
  lastTradeTs: number | null;
  /** Days since last trade. */
  daysSinceLastTrade: number | null;
}

export interface SmartMoneyFeed {
  ts: number;
  entries: SmartMoneyEntry[];
  /** Total wallets the leaderboard returned BEFORE filtering / ranking. */
  scanned: number;
  /** Lookback window in days (90 for now). */
  lookbackDays: number;
}

interface LeaderboardRow {
  ethAddress: string;
  accountValue: string;
  displayName: string | null;
  windowPerformances: Array<[string, { pnl: string; roi: string; vlm: string }]>;
}

async function fetchLeaderboard(timeWindow: 'allTime' | 'month' | 'week' | 'day' = 'allTime'): Promise<LeaderboardRow[]> {
  try {
    const res = await fetch(HL_LEADERBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ timeWindow }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.leaderboardRows ?? [];
  } catch {
    return [];
  }
}

/** Mine fill stats: realized PnL, win rate, biggest win/loss, top symbols. */
function summariseFills(fills: NormalizedTrade[], lookbackMs: number): {
  realised: number; closing: number; wins: number;
  biggestWin: number; biggestLoss: number; topSymbols: string[]; lastTs: number | null;
} {
  const cutoff = Date.now() - lookbackMs;
  let realised = 0, closing = 0, wins = 0;
  let biggestWin = 0, biggestLoss = 0;
  let lastTs: number | null = null;
  const symbolVolumes = new Map<string, number>();

  for (const f of fills) {
    const t = f.ts.getTime();
    if (t < cutoff) continue;
    if (lastTs == null || t > lastTs) lastTs = t;
    if (f.realizedPnlUsd != null) {
      realised += f.realizedPnlUsd;
      closing++;
      if (f.realizedPnlUsd > 0) wins++;
      if (f.realizedPnlUsd > biggestWin) biggestWin = f.realizedPnlUsd;
      if (f.realizedPnlUsd < biggestLoss) biggestLoss = f.realizedPnlUsd;
    }
    symbolVolumes.set(f.symbol, (symbolVolumes.get(f.symbol) ?? 0) + f.valueUsd);
  }

  const topSymbols = Array.from(symbolVolumes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);

  return { realised, closing, wins, biggestWin, biggestLoss, topSymbols, lastTs };
}

/**
 * Concurrency-limited parallel map (no external dep). Each worker pulls
 * the next item from a shared cursor, calls fn, and writes the result
 * into the pre-sized output array. Errors thrown by fn are caught and
 * the slot is set to undefined so a single bad fetch can't kill the
 * whole batch (caller .filter()s undefined entries).
 */
async function pmap<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<Array<R | undefined>> {
  if (items.length === 0) return [];
  const out: Array<R | undefined> = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i], i);
      } catch (e) {
        out[i] = undefined; // sentinel for caller to filter
      }
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array(workerCount).fill(0).map(() => worker()));
  return out;
}

/**
 * Build the smart-money feed. Pulls the all-time leaderboard, takes the
 * top N wallets, fetches each wallet's last 90 days of fills in parallel
 * (concurrency 10 to stay friendly to HL rate limits), summarises.
 *
 * Returns at most `topN` entries sorted by realised90dUsd desc.
 */
export async function buildSmartMoneyFeed(opts: { topN?: number; lookbackDays?: number } = {}): Promise<SmartMoneyFeed> {
  const topN = Math.min(Math.max(opts.topN ?? 50, 5), 200);
  const lookbackDays = Math.min(Math.max(opts.lookbackDays ?? 90, 1), 180);
  const lookbackMs = lookbackDays * 86_400_000;
  const ts = Date.now();

  const board = await fetchLeaderboard('allTime');
  if (board.length === 0) return { ts, entries: [], scanned: 0, lookbackDays };

  const seedSlice = board.slice(0, topN);

  const enriched = await pmap(seedSlice, 10, async (row, _i) => {
    const address = row.ethAddress.toLowerCase();
    const allTime = row.windowPerformances.find(w => w[0] === 'allTime')?.[1];
    const allTimePnl = allTime ? parseFloat(allTime.pnl) || 0 : 0;
    const allTimeRoi = allTime ? (parseFloat(allTime.roi) || 0) * 100 : 0;
    const accountValue = parseFloat(row.accountValue) || 0;

    let fills: NormalizedTrade[] = [];
    try {
      fills = await hyperliquidWalletClient.fetchTradeHistory!(address, ts - lookbackMs);
    } catch {
      // Skip wallets we can't fetch; fall through with empty fills.
    }

    const summ = summariseFills(fills, lookbackMs);
    const realised30 = summariseFills(fills, 30 * 86_400_000).realised;
    const winRate = summ.closing > 0 ? (summ.wins / summ.closing) * 100 : null;
    const lastTs = summ.lastTs;
    const days = lastTs ? (Date.now() - lastTs) / 86_400_000 : null;

    const entry: SmartMoneyEntry = {
      rank: 0, // assigned post-sort
      address,
      label: row.displayName ?? `${address.slice(0, 6)}…${address.slice(-4)}`,
      accountValueUsd: accountValue,
      allTimePnlUsd: allTimePnl,
      allTimeRoiPct: allTimeRoi,
      realised90dUsd: summ.realised,
      realised30dUsd: realised30,
      closingTrades90d: summ.closing,
      winRatePct: winRate,
      biggestWinUsd: summ.biggestWin,
      biggestLossUsd: summ.biggestLoss,
      topSymbols: summ.topSymbols,
      lastTradeTs: lastTs,
      daysSinceLastTrade: days != null ? Math.round(days * 10) / 10 : null,
    };
    return entry;
  });

  // Filter dead wallets (no recent activity) AND drop any undefined slots
  // from pmap (set to undefined when a worker threw — bad fetches don't
  // kill the whole batch). Sort by 90d realised PnL.
  const live = enriched.filter((e): e is SmartMoneyEntry => e != null && e.lastTradeTs != null);
  live.sort((a, b) => b.realised90dUsd - a.realised90dUsd);
  for (let i = 0; i < live.length; i++) live[i].rank = i + 1;

  return { ts, entries: live, scanned: board.length, lookbackDays };
}
