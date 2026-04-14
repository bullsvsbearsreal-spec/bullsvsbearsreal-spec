import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

const sql = postgres(process.env.DATABASE_URL || '', { max: 2 });

// Cache for 5 minutes
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_MS = 300_000;

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'BTC').toUpperCase();
  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30, 1), 90);

  const key = `${symbol}-${days}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data);
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
    cache.set(key, { data: resp, ts: Date.now() });
    // Evict stale entries when cache grows large
    if (cache.size > 100) {
      const now = Date.now();
      Array.from(cache.entries()).forEach(([k, v]) => {
        if (now - v.ts > CACHE_MS) cache.delete(k);
      });
    }
    return NextResponse.json(resp, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err: any) {
    console.error('[spreads/heatmap]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
