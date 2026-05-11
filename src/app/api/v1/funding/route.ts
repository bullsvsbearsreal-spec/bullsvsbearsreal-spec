import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { getFundingData } from '../../_shared/funding-core';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/funding
 *
 * Returns real-time funding rates across all exchanges. Per-exchange
 * rows by default; pass `aggregate=1` to collapse to one row per symbol
 * with the average + min + max 8h-normalised rate across venues.
 *
 * Query params:
 *   ?symbols=BTC,ETH        — filter by symbols (comma-separated)
 *   ?exchanges=binance,bybit — filter by exchange (comma-separated, case-insensitive)
 *   ?assetClass=crypto       — crypto|stocks|forex|commodities|all (default: crypto)
 *   ?aggregate=1             — one row per symbol with avg/min/max rate8h across venues
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const VALID_ASSET_CLASSES = ['crypto', 'stocks', 'forex', 'commodities', 'all'] as const;
  const rawAssetClass = searchParams.get('assetClass') || 'crypto';
  const assetClass = (VALID_ASSET_CLASSES as readonly string[]).includes(rawAssetClass) ? rawAssetClass as typeof VALID_ASSET_CLASSES[number] : 'crypto';
  const aggregate = searchParams.get('aggregate') === '1' || searchParams.get('aggregate') === 'true';

  try {
    // Call shared funding data module directly (no self-referential HTTP)
    const fundingResult = await getFundingData(assetClass);

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

    // Per-entry 8h-normalised rate (rate × 8 for 1h venues, × 2 for 4h, × 1 for 8h)
    const norm8h = (d: { fundingRate: number; fundingInterval?: string }) =>
      d.fundingRate * (d.fundingInterval === '1h' ? 8 : d.fundingInterval === '4h' ? 2 : 1);

    if (aggregate) {
      // One row per symbol: avg / min / max 8h-normalised rate + which
      // venues hit the extremes (helpful for spotting cheap longs vs
      // expensive shorts at a glance).
      type AggFunding = {
        symbol: string;
        venueCount: number;
        avgRate8h: number;
        minRate8h: number;
        minExchange: string;
        maxRate8h: number;
        maxExchange: string;
        spread8h: number;
      };
      const bySymbol = new Map<string, { symbol: string; entries: { exchange: string; rate8h: number }[] }>();
      for (const d of data) {
        const sym = (d.symbol || '').toUpperCase();
        if (!sym) continue;
        const r8 = norm8h(d);
        if (!Number.isFinite(r8)) continue;
        if (!bySymbol.has(sym)) bySymbol.set(sym, { symbol: sym, entries: [] });
        bySymbol.get(sym)!.entries.push({ exchange: d.exchange, rate8h: r8 });
      }
      const aggArr: AggFunding[] = Array.from(bySymbol.values())
        .filter(r => r.entries.length > 0)
        .map(r => {
          const sorted = [...r.entries].sort((a, b) => a.rate8h - b.rate8h);
          const min = sorted[0];
          const max = sorted[sorted.length - 1];
          const avg = r.entries.reduce((a, b) => a + b.rate8h, 0) / r.entries.length;
          return {
            symbol: r.symbol,
            venueCount: r.entries.length,
            avgRate8h: avg,
            minRate8h: min.rate8h,
            minExchange: min.exchange,
            maxRate8h: max.rate8h,
            maxExchange: max.exchange,
            spread8h: max.rate8h - min.rate8h,
          };
        })
        .sort((a, b) => b.spread8h - a.spread8h);

      return NextResponse.json({
        success: true,
        data: aggArr,
        meta: {
          timestamp: Date.now(),
          entries: aggArr.length,
          mode: 'aggregate',
          assetClass,
        },
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    // Clean response shape for public API
    const cleaned = data.map((d: any) => ({
      symbol: d.symbol,
      exchange: d.exchange,
      rate: d.fundingRate,
      rate8h: norm8h(d),
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
        mode: 'per-venue',
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
