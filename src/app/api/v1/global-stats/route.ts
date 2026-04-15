import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

let l1Cache: { data: any; ts: number } | null = null;
const L1_TTL = 120_000; // 2 min

/**
 * GET /api/v1/global-stats
 *
 * Returns market-wide stats: altcoin season index, BTC dominance, total market cap.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  try {
    let raw: any;
    if (l1Cache && Date.now() - l1Cache.ts < L1_TTL) {
      raw = l1Cache.data;
    } else {
      const origin = request.nextUrl.origin;
      const res = await fetch(`${origin}/api/global-stats`, {
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
        altcoinSeasonIndex: raw.altcoinSeasonIndex ?? null,
        btcDominance: raw.btcDominance ?? null,
        totalMarketCap: raw.totalMarketCap ?? null,
        totalMarketCapChange24h: raw.totalMarketCapChange24h ?? null,
        totalVolume24h: raw.totalVolume24h ?? null,
        btcPrice: raw.btcPrice ?? null,
        ethPrice: raw.ethPrice ?? null,
      },
      meta: { timestamp: Date.now() },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (e) {
    console.error('v1/global-stats error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
