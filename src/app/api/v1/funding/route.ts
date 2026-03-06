import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/funding
 *
 * Returns real-time funding rates across all exchanges.
 * Query params:
 *   ?symbols=BTC,ETH        — filter by symbols (comma-separated)
 *   ?exchanges=binance,bybit — filter by exchange (comma-separated, case-insensitive)
 *   ?assetClass=crypto       — crypto|stocks|forex|commodities|all (default: crypto)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const assetClass = searchParams.get('assetClass') || 'crypto';

  try {
    // Fetch from internal API (reuses its caching layer)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/funding?assetClass=${assetClass}`, {
      headers: { 'x-internal': '1' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch funding data' },
        { status: 502 },
      );
    }

    const json = await res.json();
    let data: any[] = json.data || [];

    // Apply symbol filter
    if (symbolFilter && symbolFilter.length > 0) {
      data = data.filter((d: any) => symbolFilter.includes(d.symbol?.toUpperCase()));
    }

    // Apply exchange filter
    if (exchangeFilter && exchangeFilter.length > 0) {
      data = data.filter((d: any) => exchangeFilter.includes(d.exchange?.toLowerCase()));
    }

    // Clean response shape for public API
    const cleaned = data.map((d: any) => ({
      symbol: d.symbol,
      exchange: d.exchange,
      rate: d.fundingRate,
      rate8h: d.fundingInterval === '1h' ? d.fundingRate * 8
            : d.fundingInterval === '4h' ? d.fundingRate * 2
            : d.fundingRate,
      predictedRate: d.predictedRate ?? null,
      markPrice: d.markPrice ?? null,
      indexPrice: d.indexPrice ?? null,
      fundingInterval: d.fundingInterval,
      nextFundingTime: d.nextFundingTime ?? null,
      type: d.type || 'cex',
      assetClass: d.assetClass || 'crypto',
    }));

    return NextResponse.json({
      success: true,
      data: cleaned,
      meta: {
        timestamp: Date.now(),
        exchanges: json.meta?.activeExchanges ?? 0,
        pairs: cleaned.length,
        cacheAge: json.meta?.timestamp ? Math.round((Date.now() - json.meta.timestamp) / 1000) : 0,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    console.error('v1/funding error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
