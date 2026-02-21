/**
 * GET /api/oi-delta
 *
 * Returns per-symbol OI with 1h/4h/24h percentage changes.
 * Data comes from oi_snapshots table (10-min cron intervals).
 * Cached in-memory for 5 minutes.
 */

import { NextResponse } from 'next/server';
import { initDB, isDBConfigured, getOIDeltas } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface CachedDelta {
  body: any;
  timestamp: number;
}

let deltaCache: CachedDelta | null = null;
const DELTA_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  // Return cached if fresh
  if (deltaCache && Date.now() - deltaCache.timestamp < DELTA_TTL) {
    return NextResponse.json(deltaCache.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ data: [], timestamp: Date.now() });
  }

  try {
    await initDB();
    const deltas = await getOIDeltas();

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
    console.error('OI delta error:', error);
    return NextResponse.json(
      { error: 'Failed to compute OI deltas', data: [] },
      { status: 500 },
    );
  }
}
