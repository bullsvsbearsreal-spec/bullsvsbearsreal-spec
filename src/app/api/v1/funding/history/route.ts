import { NextRequest, NextResponse } from 'next/server';
import { getBulkFundingHistory } from '@/lib/db';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/funding/history
 *
 * Returns historical funding rate snapshots from DB.
 * Query params:
 *   ?symbols=BTC,ETH   — required, comma-separated symbols (max 20)
 *   ?days=7             — lookback period (1-14, default: 7)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const symbolsParam = searchParams.get('symbols');
  const days = Math.min(14, Math.max(1, parseInt(searchParams.get('days') || '7', 10) || 7));

  if (!symbolsParam) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: symbols (e.g. ?symbols=BTC,ETH)' },
      { status: 400 },
    );
  }

  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (symbols.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid symbols provided' },
      { status: 400 },
    );
  }

  try {
    const history = await getBulkFundingHistory(symbols, days);

    return NextResponse.json({
      success: true,
      data: history,
      meta: {
        timestamp: Date.now(),
        symbols: symbols.length,
        days,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (e) {
    console.error('v1/funding/history error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch historical data' },
      { status: 500 },
    );
  }
}
