import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

let l1Cache: { data: any; ts: number } | null = null;
const L1_TTL = 120_000; // 2 min

/**
 * GET /api/v1/top-movers
 *
 * Returns top gaining and losing coins by 24h price change.
 * Query params:
 *   ?limit=20 — max gainers/losers to return (1–50, default 20)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20, 1), 50);

  try {
    let raw: any;
    if (l1Cache && Date.now() - l1Cache.ts < L1_TTL) {
      raw = l1Cache.data;
    } else {
      const origin = request.nextUrl.origin;
      const res = await fetch(`${origin}/api/top-movers`, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'InfoHub-v1-internal' },
      });
      if (!res.ok) return NextResponse.json({ success: false, error: 'Upstream fetch failed' }, { status: 502 });
      raw = await res.json();
      l1Cache = { data: raw, ts: Date.now() };
    }

    return NextResponse.json({
      success: true,
      data: {
        gainers: (raw.gainers || []).slice(0, limit),
        losers: (raw.losers || []).slice(0, limit),
      },
      meta: { timestamp: Date.now(), limit },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (e) {
    console.error('v1/top-movers error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
