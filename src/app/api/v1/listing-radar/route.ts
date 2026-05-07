import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { buildListingRadar } from '@/lib/listing-radar';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/listing-radar
 *
 * Pre-listing leak tracker. Aggregates Binance announcements (new
 * listings + delistings), classifies by type (spot / perp / futures /
 * delisting), extracts tickers, marks hot (<6h old).
 *
 * Listings historically move price 30-200% in the first 24 hours;
 * catching them in the announcement window is real alpha.
 *
 * Query params:
 *   ?type=spot|perp|futures|delisting   filter to one type
 *   ?hot=1                              only return events <6h old
 *   ?limit=50                           default 50
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const typeFilter = request.nextUrl.searchParams.get('type') || undefined;
  const hotOnly = request.nextUrl.searchParams.get('hot') === '1';
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10) || 50, 1), 200);

  try {
    const feed = await buildListingRadar();
    let events = feed.events;
    if (typeFilter) events = events.filter(e => e.type === typeFilter);
    if (hotOnly) events = events.filter(e => e.hot);
    events = events.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: events,
      summary: feed.summary,
      meta: { timestamp: feed.ts, type: typeFilter ?? null, hot: hotOnly, limit },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/listing-radar error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
