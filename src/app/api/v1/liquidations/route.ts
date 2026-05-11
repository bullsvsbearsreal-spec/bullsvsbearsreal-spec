import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { isDBConfigured, getLiquidationFeedFiltered, getLiquidationSummary } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/liquidations
 *
 * Returns recent liquidation data from the database.
 * Two modes:
 *   - default (no `summary`): returns the recent liquidation feed
 *   - `?summary=1` + `?symbol=BTC`: returns aggregated stats (total,
 *      long vs short volume, largest single hit) for the symbol over
 *      the lookback window. Avoids paging through hundreds of events
 *      client-side just to compute counts.
 *
 * Query params:
 *   ?symbol=BTC        — filter by symbol (required for summary mode)
 *   ?exchange=binance  — filter by exchange (feed mode only)
 *   ?side=long         — filter by side (feed mode only)
 *   ?hours=1           — lookback window in hours (1–24, default 1)
 *   ?limit=100         — max entries (1–500, default 100; feed mode)
 *   ?summary=1         — return aggregated summary instead of feed
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
  const summaryMode = searchParams.get('summary') === '1' || searchParams.get('summary') === 'true';

  try {
    if (summaryMode) {
      if (!symbol) {
        return NextResponse.json(
          { success: false, error: 'summary mode requires ?symbol=' },
          { status: 400 },
        );
      }
      const summary = await getLiquidationSummary(symbol, hours);
      if (!summary) {
        return NextResponse.json({
          success: true,
          data: {
            symbol, hours,
            totalCount: 0, totalVolumeUsd: 0,
            longVolumeUsd: 0, shortVolumeUsd: 0,
            longShortRatio: null,
            largest: null,
          },
          meta: { timestamp: Date.now(), mode: 'summary' },
        }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30', ...auth.headers } });
      }
      // Long/short ratio: how lopsided the wipeout was. Use long vs total
      // for a 0..1 share rather than the ratio (avoids /0 when only one side).
      const total = summary.totalVolume;
      const longShare = total > 0 ? summary.longVolume / total : null;
      return NextResponse.json({
        success: true,
        data: {
          symbol, hours,
          totalCount: summary.totalCount,
          totalVolumeUsd: summary.totalVolume,
          longVolumeUsd: summary.longVolume,
          shortVolumeUsd: summary.shortVolume,
          longShare,                          // 0..1, share of total wiped that was long
          largest: summary.largestVolume > 0 ? {
            valueUsd: summary.largestVolume,
            price: summary.largestPrice,
            side: summary.largestSide,
            exchange: summary.largestExchange,
            timestamp: summary.largestTime,
          } : null,
        },
        meta: { timestamp: Date.now(), mode: 'summary' },
      }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } });
    }

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
      meta: { timestamp: Date.now(), hours, entries: cleaned.length, limit, mode: 'feed' },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/liquidations error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
