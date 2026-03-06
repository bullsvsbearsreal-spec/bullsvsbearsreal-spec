import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
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
  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/openinterest`, { headers: { 'x-internal': '1' } });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch OI data' },
        { status: 502 },
      );
    }

    const json = await res.json();
    let data: any[] = json.data || [];

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
        exchanges: json.meta?.activeExchanges ?? 0,
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
