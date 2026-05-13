/**
 * GET /api/hl-vaults
 *
 * Hyperliquid public vault leaderboard. Pulls from the same stats feed the
 * HL app uses. Each vault has: name, leader wallet, TVL, APR, PnL timeseries
 * across day/week/month/allTime, createTime, isClosed.
 *
 * Upstream:
 *   GET https://stats-data.hyperliquid.xyz/Mainnet/vaults
 *
 * Query params:
 *   limit   — default 100, max 500
 *   sort    — 'tvl' | 'apr' | 'pnl30d' | 'age'  (default: tvl)
 *   status  — 'active' | 'closed' | 'all'  (default: active)
 *   window  — 'day' | 'week' | 'month' | 'allTime'  (default: month) — chooses the PnL window surfaced in rows
 *
 * Cache: 5 min.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface RawVault {
  apr: number;
  pnls: Array<[string, string[]]>;
  summary: {
    name: string;
    vaultAddress: string;
    leader: string;
    tvl: string;
    isClosed: boolean;
    createTimeMillis: number;
    relationship?: { type: string };
  };
}

export interface VaultRow {
  address: string;
  leader: string;
  name: string;
  tvlUsd: number;
  aprPct: number;
  pnlDay: number;
  pnlWeek: number;
  pnlMonth: number;
  pnlAllTime: number;
  windowPnl: number;       // chosen via ?window=
  ageDays: number;
  isClosed: boolean;
  createdAt: number;
}

interface VaultsResponse {
  data: VaultRow[];
  summary: {
    totalVaults: number;
    activeVaults: number;
    closedVaults: number;
    totalTvlUsd: number;
    medianApr: number;
    biggestVault: string | null;
    biggestVaultTvl: number;
  };
  meta: {
    source: 'hyperliquid';
    timestamp: number;
    window: 'day' | 'week' | 'month' | 'allTime';
    sort: string;
    status: string;
    returned: number;
  };
}

const cache = new Map<string, { body: VaultsResponse; ts: number }>();
const CACHE_TTL = 300_000;

// The allTime series typically has a handful of checkpoints. Prefer the last
// (latest) value minus the first — that's the net PnL for that window.
function computeSeriesPnl(series: string[] | undefined): number {
  if (!Array.isArray(series) || series.length < 2) return 0;
  const last = parseFloat(series[series.length - 1]);
  const first = parseFloat(series[0]);
  if (!Number.isFinite(last) || !Number.isFinite(first)) return 0;
  return last - first;
}

function extractPnls(raw: RawVault): Record<string, number> {
  const out: Record<string, number> = { day: 0, week: 0, month: 0, allTime: 0 };
  if (!Array.isArray(raw.pnls)) return out;
  for (const entry of raw.pnls) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [label, series] = entry;
    if (typeof label !== 'string') continue;
    out[label] = computeSeriesPnl(series);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));
  const sort = (searchParams.get('sort') || 'tvl').toLowerCase();
  const status = (searchParams.get('status') || 'active').toLowerCase();
  const window = (searchParams.get('window') || 'month').toLowerCase() as 'day' | 'week' | 'month' | 'allTime';

  const cacheKey = `hl-vaults:${limit}:${sort}:${status}:${window}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const res = await fetch('https://stats-data.hyperliquid.xyz/Mainnet/vaults', {
      signal: AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `hyperliquid ${res.status}`, data: [] }, { status: 502 });
    }
    const raw = await res.json() as RawVault[];
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: 'unexpected shape', data: [] }, { status: 502 });
    }

    const now = Date.now();
    const windowKey: 'day' | 'week' | 'month' | 'allTime' =
      ['day', 'week', 'month', 'allTime'].includes(window) ? window : 'month';

    let rows: VaultRow[] = raw
      .filter(v => v && v.summary && v.summary.vaultAddress)
      .map(v => {
        const pnls = extractPnls(v);
        const tvl = parseFloat(v.summary.tvl) || 0;
        const created = v.summary.createTimeMillis || now;
        const ageDays = Math.max(0, Math.floor((now - created) / 86_400_000));
        return {
          address: v.summary.vaultAddress.toLowerCase(),
          leader: (v.summary.leader || '').toLowerCase(),
          name: v.summary.name || 'Unnamed Vault',
          tvlUsd: tvl,
          aprPct: Number.isFinite(v.apr) ? v.apr * 100 : 0,
          pnlDay: pnls.day,
          pnlWeek: pnls.week,
          pnlMonth: pnls.month,
          pnlAllTime: pnls.allTime,
          windowPnl: pnls[windowKey] ?? 0,
          ageDays,
          isClosed: !!v.summary.isClosed,
          createdAt: created,
        };
      });

    // Filter by status
    if (status === 'active')  rows = rows.filter(r => !r.isClosed);
    else if (status === 'closed') rows = rows.filter(r => r.isClosed);

    // Sort
    if (sort === 'apr')        rows.sort((a, b) => b.aprPct - a.aprPct);
    else if (sort === 'pnl30d')rows.sort((a, b) => b.pnlMonth - a.pnlMonth);
    else if (sort === 'age')   rows.sort((a, b) => b.ageDays - a.ageDays);
    else                       rows.sort((a, b) => b.tvlUsd - a.tvlUsd);

    const trimmed = rows.slice(0, limit);

    const totalActive = raw.filter(v => v?.summary && !v.summary.isClosed).length;
    const totalClosed = raw.length - totalActive;
    const totalTvl = trimmed.reduce((s, r) => s + r.tvlUsd, 0);
    // Median APR among profitable vaults only (otherwise a huge tail of 0-APR
    // new vaults drags the median down to ~0 and hides real yield).
    const profitable = trimmed.map(r => r.aprPct).filter(a => a > 0).sort((a, b) => a - b);
    const median = profitable.length ? profitable[Math.floor(profitable.length / 2)] : 0;
    const biggest = trimmed[0] && sort === 'tvl' ? trimmed[0] : trimmed.slice().sort((a, b) => b.tvlUsd - a.tvlUsd)[0];

    const body: VaultsResponse = {
      data: trimmed,
      summary: {
        totalVaults: raw.length,
        activeVaults: totalActive,
        closedVaults: totalClosed,
        totalTvlUsd: totalTvl,
        medianApr: median,
        biggestVault: biggest?.name ?? null,
        biggestVaultTvl: biggest?.tvlUsd ?? 0,
      },
      meta: {
        source: 'hyperliquid',
        timestamp: Date.now(),
        window: windowKey,
        sort,
        status,
        returned: trimmed.length,
      },
    };

    // Only pin cache when we have vaults. Was: cached empty for 5 min
    // when HL's vault index returned 200 with no rows (rare but
    // possible during their schema migrations).
    if (trimmed.length > 0) {
      cache.set(cacheKey, { body, ts: Date.now() });
    }
    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': trimmed.length > 0
          ? 'public, s-maxage=300, stale-while-revalidate=900'
          : 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[hl-vaults] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
