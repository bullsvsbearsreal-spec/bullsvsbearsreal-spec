import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { getOIData } from '../../_shared/oi-core';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/openinterest
 *
 * Returns open interest data across exchanges.
 * Query params:
 *   ?symbols=BTC,ETH        — filter by symbols
 *   ?exchanges=binance,bybit — filter by exchange
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  try {
    // Call shared OI data module directly (no self-referential HTTP)
    const oiResult = await getOIData();

    if (!oiResult) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch OI data' },
        { status: 502 },
      );
    }

    let data: any[] = oiResult.result.data || [];

    if (symbolFilter && symbolFilter.length > 0) {
      data = data.filter((d: any) => symbolFilter.includes(d.symbol?.toUpperCase()));
    }
    if (exchangeFilter && exchangeFilter.length > 0) {
      data = data.filter((d: any) => exchangeFilter.includes(d.exchange?.toLowerCase()));
    }

    const cleaned = data.map((d: any) => ({
      symbol: d.symbol,
      exchange: d.exchange,
      openInterest: d.openInterest ?? 0,
      openInterestUsd: d.openInterestValue ?? 0,
      timestamp: d.timestamp ?? Date.now(),
    }));

    return NextResponse.json({
      success: true,
      data: cleaned,
      meta: {
        timestamp: Date.now(),
        entries: cleaned.length,
        exchanges: oiResult.result.meta?.activeExchanges ?? 0,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    console.error('v1/openinterest error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
