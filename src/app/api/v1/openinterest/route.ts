import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { getOIData, getOIChanges } from '../../_shared/oi-core';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/openinterest
 *
 * Returns open interest data across exchanges. Per-exchange rows by
 * default; pass `aggregate=1` to collapse to one row per symbol.
 *
 * Query params:
 *   ?symbols=BTC,ETH        — filter by symbols
 *   ?exchanges=binance,bybit — filter by exchange
 *   ?aggregate=1            — sum openInterestUsd per symbol (one row per symbol)
 *   ?changes=1              — include 24h % change (server-side snapshots)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const exchangeFilter = searchParams.get('exchanges')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const aggregate = searchParams.get('aggregate') === '1' || searchParams.get('aggregate') === 'true';
  const withChanges = searchParams.get('changes') === '1' || searchParams.get('changes') === 'true';

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

    // OI change percentages (1h / 4h / 24h) when ?changes=1.
    // Built from server-stored 5-min snapshots in oi-core.
    let changesMap = new Map<string, { pct1h?: number; pct4h?: number; pct24h?: number }>();
    if (withChanges) {
      changesMap = getOIChanges().changes;
    }

    if (aggregate) {
      // Sum openInterestUsd per symbol; preserve venueCount + per-venue
      // breakdown for downstream display.
      type AggRow = {
        symbol: string;
        openInterestUsd: number;
        venues: { exchange: string; openInterestUsd: number }[];
        timestamp: number;
      };
      const bySymbol = new Map<string, AggRow>();
      for (const d of data) {
        const sym = (d.symbol || '').toUpperCase();
        if (!sym) continue;
        const venueOi = d.openInterestValue ?? 0;
        if (!bySymbol.has(sym)) {
          bySymbol.set(sym, { symbol: sym, openInterestUsd: 0, venues: [], timestamp: d.timestamp ?? Date.now() });
        }
        const row = bySymbol.get(sym)!;
        row.openInterestUsd += venueOi;
        row.venues.push({ exchange: d.exchange, openInterestUsd: venueOi });
      }
      const aggArr = Array.from(bySymbol.values())
        .sort((a, b) => b.openInterestUsd - a.openInterestUsd)
        .map(r => ({
          ...r,
          venueCount: r.venues.length,
          ...(withChanges && changesMap.has(r.symbol) ? { changes: changesMap.get(r.symbol) } : {}),
        }));

      return NextResponse.json({
        success: true,
        data: aggArr,
        meta: {
          timestamp: Date.now(),
          entries: aggArr.length,
          mode: 'aggregate',
          ...(withChanges ? { changesAvailable: changesMap.size > 0 } : {}),
        },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          ...auth.headers,
        },
      });
    }

    const cleaned = data.map((d: any) => ({
      symbol: d.symbol,
      exchange: d.exchange,
      openInterest: d.openInterest ?? 0,
      openInterestUsd: d.openInterestValue ?? 0,
      timestamp: d.timestamp ?? Date.now(),
      ...(withChanges && changesMap.has(d.symbol?.toUpperCase())
        ? { changes: changesMap.get(d.symbol.toUpperCase()) }
        : {}),
    }));

    return NextResponse.json({
      success: true,
      data: cleaned,
      meta: {
        timestamp: Date.now(),
        entries: cleaned.length,
        exchanges: oiResult.result.meta?.activeExchanges ?? 0,
        mode: 'per-venue',
        ...(withChanges ? { changesAvailable: changesMap.size > 0 } : {}),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/openinterest error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
