/**
 * GET /api/gmx-traders/[address]
 *
 * Full dossier for a single GMX V2 trader: summary stats + open positions.
 * Pulls the AccountStat row and the trader's recent Position entities from
 * the GMX subsquid indexer on Arbitrum.
 *
 * Cache: 30s TTL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGMXMarkets, getGMXTickers, resolveEntryPriceUsd } from '@/lib/gmx/markets';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const GMX_SUBSQUID_BY_CHAIN: Record<'arbitrum' | 'avalanche', string> = {
  arbitrum: 'https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql',
  avalanche: 'https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql',
};
const USD_DECIMALS = 1e30;

interface PositionRow {
  positionKey: string;
  market: string;
  collateralToken: string;
  isLong: boolean;
  sizeInUsd: string;
  sizeInTokens: string;
  collateralAmount: string;
  entryPrice: string | null;
  realizedPnl: string;
  unrealizedPnl: string;
  realizedFees: string;
  leverage: string | null;
  openedAt: number | string | null;
  isSnapshot: boolean;
}

// Entry-price decimals resolution lives in @/lib/gmx/markets and uses live
// GMX tickers to calibrate per-token precision. Removed the local heuristic.

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 30_000;

function toUSD(v: string | null | undefined): number {
  if (!v) return 0;
  try {
    const n = Number(BigInt(v)) / USD_DECIMALS;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } },
) {
  const raw = params.address || '';
  // Basic address sanitization — only allow 0x-prefixed hex. GMX's subsquid
  // stores checksum-cased addresses and `account_eq` is string-exact. We
  // query both forms (lowercase + EIP-55 checksum) regardless of which
  // case the caller passed, since /trader/[address] lowercases on entry
  // and the subsquid would miss the lowercase form alone.
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }
  const lower = raw.toLowerCase();
  let checksum = raw;
  try {
    const { getAddress } = await import('@ethersproject/address');
    checksum = getAddress(raw);
  } catch { /* fall back to whatever raw was */ }
  const addressCandidates = Array.from(new Set([lower, checksum, raw]));

  const chainRaw = (request.nextUrl.searchParams.get('chain') || 'arbitrum').toLowerCase();
  const chain = (['arbitrum', 'avalanche'].includes(chainRaw) ? chainRaw : 'arbitrum') as 'arbitrum' | 'avalanche';

  const cacheKey = `gmx-trader:${chain}:${lower}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const query = `
    query TraderDossier($addresses: [String!]!) {
      stats: accountStats(
        where: { account_in: $addresses, period_eq: "total" }
        limit: 1
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
      openPositions: positions(
        where: { account_in: $addresses, isSnapshot_eq: false, sizeInUsd_gt: "0" }
        orderBy: sizeInUsd_DESC
        limit: 20
      ) {
        positionKey
        market
        collateralToken
        isLong
        sizeInUsd
        sizeInTokens
        collateralAmount
        entryPrice
        realizedPnl
        unrealizedPnl
        realizedFees
        leverage
        openedAt
        isSnapshot
      }
      recentCloses: positionChanges(
        where: {
          account_in: $addresses,
          type_eq: decrease,
          basePnlUsd_not_eq: "0"
        }
        orderBy: timestamp_DESC
        limit: 15
      ) {
        positionKey
        market
        isLong
        sizeDeltaUsd
        executionPrice
        basePnlUsd
        feesAmount
        timestamp
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
      body: JSON.stringify({ query, variables: { addresses: addressCandidates } }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GMX subgraph returned ${res.status}` },
        { status: 502 },
      );
    }

    const json = await res.json();
    if (json.errors) {
      return NextResponse.json(
        { error: 'GMX subgraph query error', details: json.errors },
        { status: 502 },
      );
    }

    const statsRow = json?.data?.stats?.[0];
    const openPositionsRaw: PositionRow[] = json?.data?.openPositions || [];
    const recentClosesRaw: Array<{
      positionKey: string;
      market: string;
      isLong: boolean;
      sizeDeltaUsd: string;
      executionPrice: string | null;
      basePnlUsd: string;
      feesAmount: string;
      timestamp: number;
    }> = json?.data?.recentCloses || [];

    if (!statsRow) {
      return NextResponse.json({ error: 'Trader not found', address: lower }, { status: 404 });
    }

    const realizedPnl = toUSD(statsRow.realizedPnl);
    const volume = toUSD(statsRow.volume);
    const wins = Number(statsRow.wins) || 0;
    const losses = Number(statsRow.losses) || 0;
    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Resolve market addresses → human symbols and live tickers for per-token
    // decimals calibration. Both are cached (markets 1h, tickers 1min).
    const [marketMap, tickers] = await Promise.all([
      getGMXMarkets(chain).catch(() => new Map()),
      getGMXTickers(chain).catch(() => ({ byAddress: new Map(), bySymbol: new Map(), ts: 0 })),
    ]);

    // Map recent close/reduce events → clean shape. Each is a real-world trade
    // where the trader removed size (full close or partial take-profit/stop).
    const recentTrades = recentClosesRaw.map(c => {
      const marketInfo = marketMap.get((c.market || '').toLowerCase());
      const pnl = toUSD(c.basePnlUsd);
      const sizeDelta = toUSD(c.sizeDeltaUsd);
      const fees = toUSD(c.feesAmount);
      const execPrice = resolveEntryPriceUsd(c.executionPrice, marketInfo?.symbol, tickers);
      const netPnl = pnl - fees;
      return {
        positionKey: c.positionKey,
        market: c.market,
        marketSymbol: marketInfo?.symbol || '?',
        isLong: !!c.isLong,
        sizeUsd: sizeDelta,
        executionPrice: execPrice,
        pnl,
        fees,
        netPnl,
        pnlPct: sizeDelta > 0 ? (netPnl / sizeDelta) * 100 : 0,
        timestamp: Number(c.timestamp) || 0,
      };
    });

    const openPositions = openPositionsRaw.map(p => {
      const sizeUsd = toUSD(p.sizeInUsd);
      const unrealizedPnl = toUSD(p.unrealizedPnl);
      const pnlPct = sizeUsd > 0 ? (unrealizedPnl / sizeUsd) * 100 : 0;
      const marketInfo = marketMap.get((p.market || '').toLowerCase());
      const entryPrice = resolveEntryPriceUsd(p.entryPrice, marketInfo?.symbol, tickers);
      const livePrice = marketInfo?.symbol ? tickers.bySymbol.get(marketInfo.symbol)?.priceUsd ?? 0 : 0;
      return {
        positionKey: p.positionKey,
        market: p.market,
        marketSymbol: marketInfo?.symbol || '?',
        marketName: marketInfo?.fullName || p.market,
        marketPair: marketInfo?.pair || '',
        marketDeprecated: marketInfo?.isDeprecated || false,
        isLong: !!p.isLong,
        sizeUsd,
        entryPrice,
        livePrice,
        realizedPnl: toUSD(p.realizedPnl),
        unrealizedPnl,
        pnlPct,
        realizedFees: toUSD(p.realizedFees),
        leverage: p.leverage ? Number(p.leverage) / 1e4 : null, // GMX v2 leverage precision is 1e4
        openedAt: p.openedAt ? Number(p.openedAt) : null,
      };
    });

    const body = {
      address: statsRow.account || lower,
      summary: {
        realizedPnl,
        unrealizedPnl: openPositions.reduce((s, p) => s + p.unrealizedPnl, 0),
        volume,
        wins,
        losses,
        totalTrades,
        winRate,
        closedCount: Number(statsRow.closedCount) || 0,
        maxCapital: toUSD(statsRow.maxCapital),
        realizedFees: toUSD(statsRow.realizedFees),
      },
      openPositions,
      recentTrades,
      meta: { source: `gmx-v2-${chain}`, chain, timestamp: Date.now() },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    if (cache.size > 100) {
      const now = Date.now();
      Array.from(cache.entries()).forEach(([k, v]) => {
        if (now - v.ts > CACHE_TTL * 3) cache.delete(k);
      });
    }

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gmx-traders/:address] fetch error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
