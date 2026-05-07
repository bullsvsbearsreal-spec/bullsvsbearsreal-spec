import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { buildSmartMoneyFeed } from '@/lib/smart-money';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/v1/smart-money-leaderboard
 *
 * Top Hyperliquid wallets ranked by 90-day realized PnL with full closing-
 * trade analytics: win rate, biggest win, biggest loss, top symbols,
 * days since last trade.
 *
 * Heavy compute first call (~5-15s); cached 30 min.
 *
 * Query params:
 *   ?topN=50          5..200, default 50
 *   ?lookbackDays=90  1..180, default 90
 *
 * Auth: Bearer ih_xxx (free tier OK).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const topN = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('topN') ?? '50', 10) || 50, 5), 200);
  const lookbackDays = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('lookbackDays') ?? '90', 10) || 90, 1), 180);

  try {
    const feed = await buildSmartMoneyFeed({ topN, lookbackDays });
    return NextResponse.json({
      success: true,
      data: feed.entries,
      summary: { scanned: feed.scanned, lookbackDays: feed.lookbackDays, count: feed.entries.length },
      meta: { timestamp: feed.ts, topN, lookbackDays },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/smart-money-leaderboard error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
