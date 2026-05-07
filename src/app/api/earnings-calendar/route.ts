/**
 * GET /api/earnings-calendar
 *
 * Unified upcoming protocol-events feed: token unlocks, TGEs, BTC halving,
 * active governance votes (Snapshot). Sorted by date asc; cropped to
 * the next 24 months.
 *
 * Cache: 15 min in-process — none of these change minute-to-minute.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildEarningsCalendar } from '@/lib/earnings-calendar';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

let l1: { ts: number; body: any } | null = null;
const L1_TTL = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }
  const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  const cal = await buildEarningsCalendar(origin);
  if (cal.events.length > 0) l1 = { ts: cal.ts, body: cal };
  return NextResponse.json(cal, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': cal.events.length > 0
        ? 'public, s-maxage=900, stale-while-revalidate=3600'
        : 'no-store',
    },
  });
}
