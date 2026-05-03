/**
 * GET /api/gmx-traders/sparklines?addresses=0x..,0x..&chain=arbitrum&days=30
 *
 * Batch-fetches last-N-day daily PnL for up to 50 GMX traders in a single
 * GraphQL call. Returns cumulative-PnL series per address — the kind of
 * sawtooth you see next to each trader name on the leaderboard.
 *
 * Response shape:
 *   { series: { [address: string]: number[] }, days, chain }
 *
 * Cache: 2 min TTL.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const GMX_SUBSQUID_BY_CHAIN: Record<'arbitrum' | 'avalanche', string> = {
  arbitrum: 'https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql',
  avalanche: 'https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql',
};

const USD_DECIMALS = 1e30;
const MAX_ADDRESSES = 50;
const MAX_DAYS = 60;

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 120_000;

function toUSD(v: string | null | undefined): number {
  if (!v) return 0;
  try {
    const n = Number(BigInt(v)) / USD_DECIMALS;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const addressesRaw = searchParams.get('addresses') || '';
  const chainRaw = (searchParams.get('chain') || 'arbitrum').toLowerCase();
  const chain = (['arbitrum', 'avalanche'].includes(chainRaw) ? chainRaw : 'arbitrum') as 'arbitrum' | 'avalanche';
  const days = Math.min(MAX_DAYS, Math.max(1, parseInt(searchParams.get('days') || '30', 10) || 30));

  // Parse + validate addresses. We send both received-case and lowercase to
  // handle GMX subsquid's string-exact match semantics.
  const unique = new Set<string>();
  for (const raw of addressesRaw.split(',')) {
    const trimmed = raw.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) continue;
    unique.add(trimmed);
    unique.add(trimmed.toLowerCase());
    if (unique.size >= MAX_ADDRESSES * 2) break;
  }

  if (unique.size === 0) {
    return NextResponse.json({ series: {}, days, chain }, { status: 200 });
  }

  const candidates = Array.from(unique);
  const cacheKey = `gmx-sparklines:${chain}:${days}:${candidates.slice().sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;

  const query = `
    query TraderSparklines($addresses: [String!]!, $cutoff: Int!) {
      rows: accountStats(
        where: { account_in: $addresses, period_eq: "1d", dayTimestamp_gte: $cutoff }
        orderBy: dayTimestamp_ASC
        limit: 1000
      ) {
        account
        dayTimestamp
        realizedPnl
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
      body: JSON.stringify({ query, variables: { addresses: candidates, cutoff } }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `GMX subgraph returned ${res.status}`, series: {} }, { status: 502 });
    }
    const json = await res.json();
    if (json.errors) {
      return NextResponse.json({ error: 'GMX subgraph query error', series: {} }, { status: 502 });
    }

    type Row = { account: string; dayTimestamp: number; realizedPnl: string };
    const rows: Row[] = json?.data?.rows || [];

    // Build per-account ordered daily PnL, then convert to cumulative series.
    // Output values are USD, already pre-scaled (not raw bigint).
    const series: Record<string, number[]> = {};
    // Initialize every requested address with empty array so callers can
    // reliably `series[addr]?.length === 0` check for "no data" traders.
    for (const addr of candidates) series[addr.toLowerCase()] = [];

    const dailyByAccount = new Map<string, Map<number, number>>();
    for (const r of rows) {
      const accKey = r.account.toLowerCase();
      let daily = dailyByAccount.get(accKey);
      if (!daily) { daily = new Map(); dailyByAccount.set(accKey, daily); }
      // Sum multiple rows with same dayTimestamp (shouldn't happen, but safe)
      const prev = daily.get(r.dayTimestamp) || 0;
      daily.set(r.dayTimestamp, prev + toUSD(r.realizedPnl));
    }

    // Build a unified day-timestamp axis so sparklines are comparable across traders
    const dayMs = 86_400_000;
    const endDay = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const startDay = endDay - (days - 1) * 86400;
    const dayAxis: number[] = [];
    for (let d = startDay; d <= endDay; d += 86400) dayAxis.push(d);

    dailyByAccount.forEach((daily, acc) => {
      let cum = 0;
      const sparkline: number[] = [];
      for (const d of dayAxis) {
        cum += daily.get(d) || 0;
        sparkline.push(cum);
      }
      series[acc] = sparkline;
    });

    const body = { series, days, chain, points: dayAxis.length };
    cache.set(cacheKey, { body, ts: Date.now() });
    // simple cache pruning
    if (cache.size > 100) {
      const now = Date.now();
      Array.from(cache.entries()).forEach(([k, v]) => {
        if (now - v.ts > CACHE_TTL * 3) cache.delete(k);
      });
    }

    void dayMs; // suppress unused warning — kept for future window features

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gmx-traders/sparklines] fetch error:', msg);
    return NextResponse.json({ error: msg, series: {} }, { status: 502 });
  }
}
