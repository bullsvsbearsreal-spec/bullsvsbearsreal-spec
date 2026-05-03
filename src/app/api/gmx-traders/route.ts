/**
 * GET /api/gmx-traders
 *
 * Top GMX V2 traders on Arbitrum. Pulls from GMX's official subsquid indexer
 * (https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql) and
 * reshapes the raw AccountStat entities into a clean leaderboard payload.
 *
 * Query params:
 *   sort   — pnl (default) | volume | winrate | volume_weighted
 *   limit  — 1..200 (default 50)
 *   min_trades — optional minimum closed position count (default 5)
 *
 * Cache: 60s TTL, stale-while-revalidate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGMXMarkets } from '@/lib/gmx/markets';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const GMX_SUBSQUID_BY_CHAIN: Record<'arbitrum' | 'avalanche', string> = {
  arbitrum: 'https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql',
  avalanche: 'https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql',
};

// GMX amounts are 1e30 precision — divide to get USD
const USD_DECIMALS = 1e30;

export interface GMXTrader {
  address: string;
  realizedPnl: number;       // USD
  volume: number;            // USD
  wins: number;
  losses: number;
  totalTrades: number;
  winRate: number;           // 0..100
  closedCount: number;
  netCapital: number;        // USD
  maxCapital: number;        // USD
  realizedFees: number;      // USD
  cumsumSize: number;        // USD (cumulative size)
  avgTradeSize: number;      // USD
  roi: number;               // realizedPnl / maxCapital * 100, capped at 10_000
  profitFactor: number;      // pnl per $1k fees (vanity metric, clamped)
}

interface RawAccountStat {
  account: string;
  realizedPnl: string;
  volume: string;
  wins: string;
  losses: string;
  closedCount: string;
  netCapital: string;
  maxCapital: string;
  realizedFees: string;
  cumsumSize: string;
}

// In-memory cache — 60s TTL
const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 60_000;

function toUSD(v: string | null | undefined): number {
  if (!v) return 0;
  try {
    // BigInt for precision, then divide as float
    const n = Number(BigInt(v)) / USD_DECIMALS;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function shapeTrader(s: RawAccountStat): GMXTrader {
  const realizedPnl = toUSD(s.realizedPnl);
  const volume = toUSD(s.volume);
  const wins = Number(s.wins) || 0;
  const losses = Number(s.losses) || 0;
  const closedCount = Number(s.closedCount) || 0;
  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const netCapital = toUSD(s.netCapital);
  const maxCapital = toUSD(s.maxCapital);
  const realizedFees = toUSD(s.realizedFees);
  const cumsumSize = toUSD(s.cumsumSize);
  const avgTradeSize = closedCount > 0 ? cumsumSize / closedCount : 0;
  // ROI: pnl relative to peak capital deployed. Clamp outliers — early testers
  // with $1 of capital and $1k of PnL would produce useless percentages.
  const roi = maxCapital > 0 ? Math.max(-100, Math.min(10_000, (realizedPnl / maxCapital) * 100)) : 0;
  // Profit factor per $1k of fees paid. Tells you "for every $1k you paid in
  // fees, did you make money?" Great signal for separating scalpers from holders.
  const profitFactor = realizedFees > 0 ? realizedPnl / (realizedFees / 1000) : 0;

  return {
    address: s.account,
    realizedPnl,
    volume,
    wins,
    losses,
    totalTrades,
    winRate,
    closedCount,
    netCapital,
    maxCapital,
    realizedFees,
    cumsumSize,
    avgTradeSize,
    roi,
    profitFactor,
  };
}

type Period = 'total' | '7d' | '30d';

/**
 * Aggregate multiple 1d AccountStat rows belonging to one account into a
 * single synthetic "total-for-window" row matching the RawAccountStat shape.
 * BigInt summing keeps USD precision intact across many-day windows.
 */
function aggregateDailyRows(rows: RawAccountStat[]): RawAccountStat[] {
  const byAccount = new Map<string, RawAccountStat>();
  for (const r of rows) {
    const existing = byAccount.get(r.account);
    if (!existing) {
      byAccount.set(r.account, {
        account: r.account,
        realizedPnl: r.realizedPnl,
        volume: r.volume,
        wins: r.wins,
        losses: r.losses,
        closedCount: r.closedCount,
        netCapital: r.netCapital,
        maxCapital: r.maxCapital,
        realizedFees: r.realizedFees,
        cumsumSize: r.cumsumSize,
      });
      continue;
    }
    try {
      existing.realizedPnl = (BigInt(existing.realizedPnl) + BigInt(r.realizedPnl)).toString();
      existing.volume     = (BigInt(existing.volume)     + BigInt(r.volume)).toString();
      existing.realizedFees = (BigInt(existing.realizedFees) + BigInt(r.realizedFees)).toString();
      existing.cumsumSize = (BigInt(existing.cumsumSize) + BigInt(r.cumsumSize)).toString();
      existing.wins         = (Number(existing.wins) + Number(r.wins)).toString();
      existing.losses       = (Number(existing.losses) + Number(r.losses)).toString();
      existing.closedCount  = (Number(existing.closedCount) + Number(r.closedCount)).toString();
      // netCapital / maxCapital don't meaningfully aggregate across days —
      // keep the peak across the window for maxCapital so ROI stays honest.
      if (BigInt(r.maxCapital) > BigInt(existing.maxCapital)) existing.maxCapital = r.maxCapital;
      // netCapital: take most-recent (rows come in realizedPnl_DESC order, not time order,
      // so this is approximate — close enough for a leaderboard)
      existing.netCapital = r.netCapital;
    } catch {
      // If BigInt parsing fails on a row, just keep the existing — caller
      // will not flag; this is best-effort aggregation.
    }
  }
  return Array.from(byAccount.values());
}

/**
 * Per-market leaderboard — live, active positions only. Different data shape
 * from the lifetime/window leaderboard because the underlying source is the
 * positions table (not accountStats). Returns a GMXTrader-like record per
 * account so the UI can render without branching, but some fields (wins,
 * losses, closedCount, roi) are left as 0 since they're lifetime metrics
 * and don't make sense for a live-market snapshot.
 */
async function handleMarketView(opts: {
  market: string;
  chain: 'arbitrum' | 'avalanche';
  sort: 'pnl' | 'volume' | 'winrate' | 'volume_weighted';
  limit: number;
}): Promise<NextResponse> {
  const { market, chain, sort, limit } = opts;
  const cacheKey = `gmx-traders:market:${chain}:${market}:${sort}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  // Look up checksum casing from the markets cache — GMX's subsquid string-
  // matches `market_eq` exact-case, so we need both candidates.
  const marketMap = await getGMXMarkets(chain).catch(() => new Map());
  const info = marketMap.get(market);
  const marketCandidates = info
    ? Array.from(new Set([info.addressOriginal, info.address]))
    : [market];

  const query = `
    query PerMarketLeaderboard($markets: [String!]!) {
      live: positions(
        where: { market_in: $markets, isSnapshot_eq: false, sizeInUsd_gt: "0" }
        orderBy: sizeInUsd_DESC
        limit: 500
      ) {
        account
        isLong
        sizeInUsd
        realizedPnl
        unrealizedPnl
        realizedFees
      }
    }
  `;

  try {
    const res = await fetch(GMX_SUBSQUID_BY_CHAIN[chain], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'InfoHub/2.0 (info-hub.io)',
      },
      body: JSON.stringify({ query, variables: { markets: marketCandidates } }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `GMX subgraph returned ${res.status}`, data: [] }, { status: 502 });
    }
    const json = await res.json();
    if (json.errors) {
      return NextResponse.json({ error: 'GMX subgraph query error', data: [] }, { status: 502 });
    }

    type Row = { account: string; isLong: boolean; sizeInUsd: string; realizedPnl: string; unrealizedPnl: string; realizedFees: string };
    const rows: Row[] = json?.data?.live || [];

    // Aggregate per account — a trader can have both long + short on the
    // same market (rare, but supported), so sum both.
    const byAccount = new Map<string, { account: string; sizeUsd: number; realizedPnl: number; unrealizedPnl: number; fees: number; longCount: number; shortCount: number }>();
    for (const r of rows) {
      const acc = r.account;
      const entry = byAccount.get(acc) || { account: acc, sizeUsd: 0, realizedPnl: 0, unrealizedPnl: 0, fees: 0, longCount: 0, shortCount: 0 };
      entry.sizeUsd += Number(BigInt(r.sizeInUsd)) / USD_DECIMALS;
      entry.realizedPnl += Number(BigInt(r.realizedPnl)) / USD_DECIMALS;
      entry.unrealizedPnl += Number(BigInt(r.unrealizedPnl)) / USD_DECIMALS;
      entry.fees += Number(BigInt(r.realizedFees)) / USD_DECIMALS;
      if (r.isLong) entry.longCount++; else entry.shortCount++;
      byAccount.set(acc, entry);
    }

    // Shape into GMXTrader-compatible records — totalPnl = realized + unrealized
    // on this market. Fields that don't apply (wins/losses/roi) left at 0.
    let traders: GMXTrader[] = Array.from(byAccount.values()).map(e => ({
      address: e.account,
      realizedPnl: e.realizedPnl + e.unrealizedPnl, // treat combined as "total" on this market
      volume: e.sizeUsd, // use current-notional as the volume metric for this view
      wins: 0,
      losses: 0,
      totalTrades: e.longCount + e.shortCount,
      winRate: 0,
      closedCount: 0,
      netCapital: 0,
      maxCapital: 0,
      realizedFees: e.fees,
      cumsumSize: e.sizeUsd,
      avgTradeSize: e.sizeUsd,
      roi: 0,
      profitFactor: 0,
    }));

    // Sort by chosen metric. Winrate/volume_weighted not useful here —
    // fall back to combined-PnL for those.
    if (sort === 'volume') traders.sort((a, b) => b.volume - a.volume);
    else traders.sort((a, b) => b.realizedPnl - a.realizedPnl);

    traders = traders.slice(0, limit);

    const summary = {
      traderCount: traders.length,
      totalPnl: traders.reduce((s, t) => s + t.realizedPnl, 0),
      totalVolume: traders.reduce((s, t) => s + t.volume, 0),
      avgWinRate: 0,
      winners: traders.filter(t => t.realizedPnl > 0).length,
      losers: traders.filter(t => t.realizedPnl < 0).length,
    };

    const body = {
      data: traders,
      summary,
      meta: {
        sort,
        period: 'live',
        chain,
        market,
        view: 'per-market',
        source: `gmx-v2-${chain}`,
        timestamp: Date.now(),
      },
    };
    cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gmx-traders/market] fetch error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sortRaw = (searchParams.get('sort') || 'pnl').toLowerCase();
  const sort = (['pnl', 'volume', 'winrate', 'volume_weighted'].includes(sortRaw) ? sortRaw : 'pnl') as
    | 'pnl' | 'volume' | 'winrate' | 'volume_weighted';
  const periodRaw = (searchParams.get('period') || 'total').toLowerCase();
  const period = (['total', '7d', '30d'].includes(periodRaw) ? periodRaw : 'total') as Period;
  const chainRaw = (searchParams.get('chain') || 'arbitrum').toLowerCase();
  const chain = (['arbitrum', 'avalanche'].includes(chainRaw) ? chainRaw : 'arbitrum') as 'arbitrum' | 'avalanche';
  const marketRaw = (searchParams.get('market') || '').trim().toLowerCase();
  const market = /^0x[a-f0-9]{40}$/.test(marketRaw) ? marketRaw : null;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const minTrades = Math.max(0, parseInt(searchParams.get('min_trades') || '5', 10) || 5);

  // Per-market view is a completely different data shape — live positions
  // aggregated by account on a single market, sorted by the chosen metric.
  if (market) {
    return handleMarketView({ market, chain, sort, limit });
  }

  const cacheKey = `gmx-traders:${chain}:${period}:${sort}:${limit}:${minTrades}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  // Subsquid orderBy mapping. For winrate + volume_weighted we oversample and
  // sort client-side — the indexer only supports simple scalar orderings.
  const indexerOrderBy =
    sort === 'volume' || sort === 'volume_weighted' ? 'volume_DESC' :
    sort === 'winrate' ? 'wins_DESC' :
    'realizedPnl_DESC';

  let query: string;
  if (period === 'total') {
    // Oversample so filtering by min_trades + client-side sort still yields `limit`.
    const fetchLimit = Math.min(500, limit * 4);
    query = `
      query TopTraders {
        accountStats(
          limit: ${fetchLimit}
          orderBy: ${indexerOrderBy}
          where: { period_eq: "total", closedCount_gte: ${minTrades} }
        ) {
          account
          realizedPnl
          volume
          wins
          losses
          closedCount
          netCapital
          maxCapital
          realizedFees
          cumsumSize
        }
      }
    `;
  } else {
    // Rolling window: fetch enough 1d rows within the window, aggregate per account.
    // Subsquid caps responses around ~1500-1800 rows (size limit), and 1000
    // rows × ~2-3 rows per account = ~350-500 unique traders — plenty for
    // a leaderboard. 30d hits the cap so we stay at 1000 everywhere.
    const windowDays = period === '7d' ? 7 : 30;
    const cutoff = Math.floor(Date.now() / 1000) - windowDays * 86_400;
    const rowFetchLimit = 1000;
    query = `
      query TraderWindow {
        accountStats(
          limit: ${rowFetchLimit}
          orderBy: ${indexerOrderBy}
          where: { period_eq: "1d", dayTimestamp_gte: ${cutoff}, closedCount_gte: 1 }
        ) {
          account
          realizedPnl
          volume
          wins
          losses
          closedCount
          netCapital
          maxCapital
          realizedFees
          cumsumSize
        }
      }
    `;
  }

  try {
    const res = await fetch(GMX_SUBSQUID_BY_CHAIN[chain], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'InfoHub/2.0 (info-hub.io)',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GMX subgraph returned ${res.status}`, data: [] },
        { status: 502 },
      );
    }

    const json = await res.json();
    if (json.errors) {
      return NextResponse.json(
        { error: 'GMX subgraph query error', details: json.errors, data: [] },
        { status: 502 },
      );
    }

    const rawStats: RawAccountStat[] = json?.data?.accountStats || [];
    // Aggregate daily rows into synthetic window totals, then shape as usual.
    const aggregated = period === 'total' ? rawStats : aggregateDailyRows(rawStats);
    let traders = aggregated
      .filter(a => Number(a.closedCount) >= minTrades)
      .map(shapeTrader);

    // After aggregation (7d/30d), the indexer's per-row sort no longer matches
    // per-account totals — re-sort by the user's chosen metric.
    if (period !== 'total') {
      if (sort === 'pnl') traders.sort((a, b) => b.realizedPnl - a.realizedPnl);
      else if (sort === 'volume') traders.sort((a, b) => b.volume - a.volume);
    }

    // Client-side re-sort for compound metrics (regardless of period)
    if (sort === 'winrate') {
      traders = traders
        .filter(t => t.totalTrades >= minTrades)
        .sort((a, b) => b.winRate - a.winRate || b.realizedPnl - a.realizedPnl);
    } else if (sort === 'volume_weighted') {
      // Score = PnL × log(volume + 1) — rewards traders with both size and edge
      traders.sort((a, b) => {
        const sa = a.realizedPnl * Math.log10(a.volume + 1);
        const sb = b.realizedPnl * Math.log10(b.volume + 1);
        return sb - sa;
      });
    }

    // Compute population stats BEFORE slicing to `limit`. Otherwise a Top-PnL
    // view always shows "100 winners / 0 losers" which tells the user nothing
    // about actual market breadth.
    const populationWinners = traders.filter(t => t.realizedPnl > 0).length;
    const populationLosers = traders.filter(t => t.realizedPnl < 0).length;
    const populationCount = traders.length;
    const populationTotalPnl = traders.reduce((s, t) => s + t.realizedPnl, 0);
    const populationTotalVolume = traders.reduce((s, t) => s + t.volume, 0);
    const populationAvgWinRate = populationCount
      ? traders.reduce((s, t) => s + t.winRate, 0) / populationCount
      : 0;

    traders = traders.slice(0, limit);

    const summary = {
      traderCount: populationCount,        // total eligible pool, not the displayed slice
      displayedCount: traders.length,      // how many rows are actually rendered
      totalPnl: populationTotalPnl,        // sum across the whole pool
      totalVolume: populationTotalVolume,
      avgWinRate: populationAvgWinRate,
      winners: populationWinners,          // real market breadth signal
      losers: populationLosers,
    };

    const body = {
      data: traders,
      summary,
      meta: {
        sort,
        period,
        chain,
        limit,
        minTrades,
        source: `gmx-v2-${chain}`,
        timestamp: Date.now(),
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    if (cache.size > 50) {
      const now = Date.now();
      Array.from(cache.entries()).forEach(([k, v]) => {
        if (now - v.ts > CACHE_TTL * 3) cache.delete(k);
      });
    }

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gmx-traders] fetch error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
