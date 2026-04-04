import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || '', { max: 2 });

// Cache for 5 minutes
let cache: Record<string, { data: any; ts: number }> = {};
const CACHE_MS = 300_000;

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'BTC').toUpperCase();
  const days = Math.min(+(req.nextUrl.searchParams.get('days') || '30'), 90);

  const key = `${symbol}-${days}`;
  if (cache[key] && Date.now() - cache[key].ts < CACHE_MS) {
    return NextResponse.json(cache[key].data);
  }

  try {
    // Group by day-of-week (0=Sun, 6=Sat) and hour (0-23)
    const rows = await sql`
      SELECT
        EXTRACT(DOW FROM ts)::int AS dow,
        EXTRACT(HOUR FROM ts)::int AS hour,
        AVG(spread_pct) AS avg_pct,
        AVG(spread_usd) AS avg_usd,
        COUNT(*)::int AS samples
      FROM spread_snapshots
      WHERE symbol = ${symbol}
        AND ts > NOW() - ${days + ' days'}::interval
      GROUP BY dow, hour
      ORDER BY dow, hour
    `;

    // Build 7x24 grid
    const grid: Record<number, Record<number, { pct: number; usd: number; samples: number }>> = {};
    for (let dow = 0; dow < 7; dow++) {
      grid[dow] = {};
      for (let h = 0; h < 24; h++) {
        grid[dow][h] = { pct: 0, usd: 0, samples: 0 };
      }
    }
    for (const r of rows) {
      grid[r.dow][r.hour] = { pct: +r.avg_pct, usd: +r.avg_usd, samples: r.samples };
    }

    const resp = { symbol, days, grid, totalSamples: rows.reduce((s: number, r: any) => s + r.samples, 0) };
    cache[key] = { data: resp, ts: Date.now() };
    return NextResponse.json(resp, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err: any) {
    console.error('[spreads/heatmap]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
