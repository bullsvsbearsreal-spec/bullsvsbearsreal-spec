import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { buildBridgeFlowFeed } from '@/lib/bridge-flows';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/bridge-flows
 *
 * Cross-chain bridge flow data via Wormhole. Returns:
 *   - Scorecard (24h/7d/30d volume + message counts)
 *   - Top chain pairs by transfer count
 *   - Top assets bridged by USD volume
 *   - Top corridors (specific token + chain-pair combos)
 *
 * Useful as a leading indicator: capital flowing INTO a chain ahead of
 * price moves, narrative rotation, new ecosystem inflows.
 *
 * Query params:
 *   ?timeSpan=1d|7d|30d   default 7d
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const tsRaw = request.nextUrl.searchParams.get('timeSpan');
  const timeSpan: '1d' | '7d' | '30d' = tsRaw === '1d' || tsRaw === '30d' ? tsRaw : '7d';

  try {
    const feed = await buildBridgeFlowFeed({ timeSpan });
    return NextResponse.json({
      success: true,
      data: feed,
      meta: { timestamp: feed.ts, timeSpan, source: 'Wormhole' },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/bridge-flows error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
