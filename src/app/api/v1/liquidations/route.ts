import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { isDBConfigured, getLiquidationFeedFiltered } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/liquidations
 *
 * Returns recent liquidation data from the database.
 * Query params:
 *   ?symbol=BTC        — filter by symbol
 *   ?exchange=binance  — filter by exchange
 *   ?side=long         — filter by side (long|short)
 *   ?hours=1           — lookback window in hours (1–24, default 1)
 *   ?limit=100         — max entries (1–500, default 100)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  if (!isDBConfigured()) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase() || undefined;
  const exchange = searchParams.get('exchange')?.toLowerCase() || undefined;
  const side = searchParams.get('side') as 'long' | 'short' | undefined;
  const hours = Math.min(Math.max(parseInt(searchParams.get('hours') || '1', 10) || 1, 1), 24);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

  try {
    const feed = await getLiquidationFeedFiltered(hours, limit, exchange, side === 'long' || side === 'short' ? side : undefined, symbol);
    const cleaned = (feed || []).map((d: any) => ({
      symbol: d.symbol,
      exchange: d.exchange,
      side: d.side,
      price: d.price,
      quantity: d.quantity,
      valueUsd: d.valueUsd ?? d.value_usd ?? (d.price * d.quantity),
      timestamp: d.ts ?? d.timestamp,
    }));

    return NextResponse.json({
      success: true,
      data: cleaned,
      meta: { timestamp: Date.now(), hours, entries: cleaned.length, limit },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  } catch (e) {
    console.error('v1/liquidations error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
