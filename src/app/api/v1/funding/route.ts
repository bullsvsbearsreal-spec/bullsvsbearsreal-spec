import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { getFundingData } from '../../_shared/funding-core';

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
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const assetClass = searchParams.get('assetClass') || 'crypto';

  try {
    // Call shared funding data module directly (no self-referential HTTP)
    const fundingResult = await getFundingData(assetClass as any);

    if (!fundingResult) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch funding data' },
        { status: 502 },
      );
    }

    let data: any[] = fundingResult.result.data || [];

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
        exchanges: fundingResult.result.meta?.activeExchanges ?? 0,
        pairs: cleaned.length,
        cacheAge: fundingResult.result.meta?.timestamp
          ? Math.round((Date.now() - fundingResult.result.meta.timestamp) / 1000)
          : 0,
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
