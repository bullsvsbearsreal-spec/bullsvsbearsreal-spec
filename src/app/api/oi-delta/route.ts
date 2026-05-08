/**
 * GET /api/oi-delta
 *
 * Returns per-symbol OI with 1h/4h/24h percentage changes.
 * Data comes from oi_snapshots table (10-min cron intervals).
 * Cached in-memory for 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getOIDeltas, getSQL } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface CachedDelta {
  body: any;
  timestamp: number;
}

let deltaCache: CachedDelta | null = null;
const DELTA_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get('debug') === '1';

  // Return cached if fresh (skip cache when debugging)
  if (!debug && deltaCache && Date.now() - deltaCache.timestamp < DELTA_TTL) {
    return NextResponse.json(deltaCache.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ data: [], timestamp: Date.now() });
  }

  // Debug mode: surface row counts so we can see if the table has data
  // and whether the time-window filters in the SQL query are matching.
  if (debug) {
    try {
      await initDB();
      const sql = getSQL();
      const recent = await sql`SELECT COUNT(*) AS n, MAX(ts) AS latest FROM oi_snapshots WHERE ts >= NOW() - INTERVAL '12 minutes'`;
      const past1h = await sql`SELECT COUNT(*) AS n FROM oi_snapshots WHERE ts BETWEEN NOW() - INTERVAL '66 minutes' AND NOW() - INTERVAL '54 minutes'`;
      const past4h = await sql`SELECT COUNT(*) AS n FROM oi_snapshots WHERE ts BETWEEN NOW() - INTERVAL '246 minutes' AND NOW() - INTERVAL '234 minutes'`;
      const past24h = await sql`SELECT COUNT(*) AS n FROM oi_snapshots WHERE ts BETWEEN NOW() - INTERVAL '1446 minutes' AND NOW() - INTERVAL '1434 minutes'`;
      const total = await sql`SELECT COUNT(*) AS n, MIN(ts) AS oldest, MAX(ts) AS newest FROM oi_snapshots`;
      const deltas = await getOIDeltas();
      return NextResponse.json({
        debug: true,
        windows: {
          current_12min: recent[0],
          past_1h: past1h[0],
          past_4h: past4h[0],
          past_24h: past24h[0],
        },
        total: total[0],
        deltas_returned: deltas.length,
        sample_deltas: deltas.slice(0, 3),
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      return NextResponse.json({ debug: true, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  try {
    // Race the entire DB operation (init + query) against a 25s timeout
    // to avoid Vercel 504s. The query scans oi_snapshots 4x with different
    // time windows and can exceed 60s under load.
    const deltas = await Promise.race([
      (async () => { await initDB(); return getOIDeltas(); })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OI delta query timeout (25s)')), 25_000)
      ),
    ]);

    const responseBody = {
      data: deltas,
      meta: {
        count: deltas.length,
        timestamp: Date.now(),
        note: 'OI changes computed from 10-min snapshots. 1h/4h/24h values are percentage changes. null means no historical data available for that timeframe.',
      },
    };

    deltaCache = { body: responseBody, timestamp: Date.now() };

    return NextResponse.json(responseBody, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('OI delta error:', error instanceof Error ? error.message : error);

    // Serve stale cache instead of erroring
    if (deltaCache) {
      return NextResponse.json(deltaCache.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    return NextResponse.json(
      { error: 'Failed to compute OI deltas', data: [] },
      { status: 500 },
    );
  }
}
