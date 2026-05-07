import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { buildWhaleLiqFeed } from '@/lib/whale-liq';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/whale-liq
 *
 * Public-API wrapper around /api/whale-liq. Same data, bearer-auth
 * required. Returns Hyperliquid whale positions sorted by proximity to
 * liquidation.
 *
 * Query params:
 *   ?within=0.10   — distance threshold (0..1), default 0.20
 *   ?limit=50      — max rows, 1..500, default 100
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const within = Math.min(Math.max(parseFloat(request.nextUrl.searchParams.get('within') ?? '0.20') || 0.20, 0.001), 1.0);
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10) || 100, 1), 500);

  try {
    const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    const feed = await buildWhaleLiqFeed(origin);
    const filtered = feed.rows.filter(r => r.distancePct < within).slice(0, limit);
    return NextResponse.json({
      success: true,
      data: filtered,
      summary: {
        timestamp: feed.ts,
        scanned: feed.scanned,
        positionsTotal: feed.positionsTotal,
        withinFive: feed.withinFive,
        withinTen: feed.withinTen,
      },
      meta: { within, limit },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/whale-liq error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
