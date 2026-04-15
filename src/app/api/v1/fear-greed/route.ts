import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// L1 cache (5min TTL — F&G doesn't change often)
let l1Cache: { data: any; ts: number } | null = null;
const L1_TTL = 300_000;

/**
 * GET /api/v1/fear-greed
 *
 * Returns the current Fear & Greed Index value (sourced from CoinMarketCap).
 * Query params:
 *   ?history=true — include 30-day historical values
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const wantHistory = request.nextUrl.searchParams.get('history') === 'true';

  try {
    // Use the internal fear-greed route data
    if (l1Cache && Date.now() - l1Cache.ts < L1_TTL) {
      return respond(l1Cache.data, wantHistory);
    }

    const origin = request.nextUrl.origin;
    const res = await fetch(`${origin}/api/fear-greed?history=true`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'InfoHub-v1-internal' },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Upstream fetch failed' }, { status: 502 });
    }

    const data = await res.json();
    l1Cache = { data, ts: Date.now() };
    return respond(data, wantHistory);
  } catch (e) {
    console.error('v1/fear-greed error:', e);
    if (l1Cache) return respond(l1Cache.data, wantHistory);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function respond(data: any, includeHistory: boolean) {
  const result: any = {
    success: true,
    data: {
      value: data.value ?? data.data?.value ?? null,
      label: data.label ?? data.classification ?? data.data?.label ?? data.data?.classification ?? null,
      timestamp: data.timestamp ?? Date.now(),
    },
    meta: { timestamp: Date.now() },
  };

  if (includeHistory && data.history) {
    result.data.history = data.history;
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
