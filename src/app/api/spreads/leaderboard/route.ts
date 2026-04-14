import { NextRequest, NextResponse } from 'next/server';
import { getSQL, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

const sql = getSQL();

const cacheMap = new Map<number, { data: any; ts: number }>();
const CACHE_MS = 300_000; // 5 min

export async function GET(req: NextRequest) {
  if (!isDBConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('days') || '7', 10) || 7, 1), 30);

  const cached = cacheMap.get(days);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const rows = await sql`
      SELECT symbol,
             MAX(spread_usd) AS max_spread_usd,
             MAX(spread_pct) AS max_spread_pct,
             AVG(spread_usd) AS avg_spread_usd,
             AVG(spread_pct) AS avg_spread_pct,
             COUNT(*)::int AS samples
      FROM spread_snapshots
      WHERE ts > NOW() - ${days + ' days'}::interval
        AND spread_pct < 10
      GROUP BY symbol
      HAVING COUNT(*) >= 5
      ORDER BY MAX(spread_pct) DESC
      LIMIT 50
    `;

    const data = rows.map(r => ({
      symbol: r.symbol,
      maxSpreadUsd: +r.max_spread_usd,
      maxSpreadPct: +r.max_spread_pct,
      avgSpreadUsd: +r.avg_spread_usd,
      avgSpreadPct: +r.avg_spread_pct,
      samples: r.samples,
    }));

    const resp = { data, days, count: data.length, ts: Date.now() };
    cacheMap.set(days, { data: resp, ts: Date.now() });
    return NextResponse.json(resp, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err: any) {
    console.error('[spreads/leaderboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
