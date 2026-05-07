import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { buildEarningsCalendar } from '@/lib/earnings-calendar';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/earnings-calendar
 *
 * Aggregated upcoming crypto events that historically move price:
 * token unlocks, TGEs, BTC halving, active Snapshot governance votes.
 *
 * Query params:
 *   ?type=unlock|tge|governance|halving|mainnet  — filter by event type
 *   ?days=30                                     — only return events <=N days out (default 90)
 *   ?limit=200                                   — max rows
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const filterType = request.nextUrl.searchParams.get('type') || undefined;
  const days = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('days') ?? '90', 10) || 90, 1), 730);
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '200', 10) || 200, 1), 1000);

  try {
    const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    const cal = await buildEarningsCalendar(origin);
    let events = cal.events.filter(e => e.daysFromNow <= days);
    if (filterType) events = events.filter(e => e.type === filterType);
    events = events.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: events,
      summary: cal.summary,
      meta: { timestamp: cal.ts, days, limit, type: filterType ?? null },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/earnings-calendar error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
