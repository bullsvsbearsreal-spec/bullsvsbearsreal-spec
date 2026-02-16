import { NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { oiFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// L1: In-memory cache (2-minute TTL — OI data refreshes slowly)
// ---------------------------------------------------------------------------
let l1Cache: { body: any; timestamp: number } | null = null;
const L1_TTL = 2 * 60 * 1000; // 2 minutes

export async function GET() {
  // L1: Return cached data if fresh
  if (l1Cache && Date.now() - l1Cache.timestamp < L1_TTL) {
    return NextResponse.json(l1Cache.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  try {
    const [{ data, health }, top500] = await Promise.all([
      fetchAllExchangesWithHealth(oiFetchers, fetchWithTimeout),
      getTop500Symbols(),
    ]);

    // Allow symbols listed on 2+ exchanges even if not top 500
    const exchangeCountMap = new Map<string, Set<string>>();
    data.forEach(r => {
      const sym = r.symbol.toUpperCase();
      if (!exchangeCountMap.has(sym)) exchangeCountMap.set(sym, new Set());
      exchangeCountMap.get(sym)!.add(r.exchange);
    });
    const multiExchangeSymbols = new Set<string>();
    exchangeCountMap.forEach((exchanges, sym) => {
      if (exchanges.size >= 2) multiExchangeSymbols.add(sym);
    });

    const filtered = data.filter(r =>
      isTop500Symbol(r.symbol, top500) || multiExchangeSymbols.has(r.symbol.toUpperCase())
    );

    const responseBody = {
      data: filtered,
      health,
      meta: {
        totalExchanges: oiFetchers.length,
        activeExchanges: health.filter(h => h.status === 'ok').length,
        totalEntries: filtered.length,
        timestamp: Date.now(),
      },
    };

    // Update L1 cache
    l1Cache = { body: responseBody, timestamp: Date.now() };

    return NextResponse.json(responseBody, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('OI API error:', msg);

    // Return stale cache if available
    if (l1Cache) {
      return NextResponse.json(l1Cache.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=30' },
      });
    }

    return NextResponse.json(
      { error: msg, data: [], health: [], meta: { timestamp: Date.now() } },
      { status: 500 },
    );
  }
}
