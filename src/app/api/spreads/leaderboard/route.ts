import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || '', { max: 2 });

let cache: { data: any; ts: number } | null = null;
const CACHE_MS = 300_000; // 5 min

export async function GET(req: NextRequest) {
  const days = Math.min(+(req.nextUrl.searchParams.get('days') || '7'), 30);

  if (cache && Date.now() - cache.ts < CACHE_MS) {
    return NextResponse.json(cache.data);
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
    cache = { data: resp, ts: Date.now() };
    return NextResponse.json(resp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
