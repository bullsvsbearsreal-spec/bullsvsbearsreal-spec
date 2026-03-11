import { NextResponse } from 'next/server';
import { fetchWithTimeout, normalizeSymbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { dedupedFetch } from '../_shared/inflight';
import { spotPriceFetchers } from './exchanges';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// L1: In-memory cache (30s TTL — spot prices change fast)
let l1Cache: { body: any; timestamp: number } | null = null;
const L1_TTL = 30 * 1000;

export async function GET() {
  // L1: Return cached data if fresh
  if (l1Cache && Date.now() - l1Cache.timestamp < L1_TTL) {
    return NextResponse.json(l1Cache.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  }

  try {
    const { data, health } = await dedupedFetch('spot-prices', () =>
      fetchAllExchangesWithHealth(spotPriceFetchers, fetchWithTimeout),
    );

    // Normalize symbols for token rebrands
    data.forEach((entry: any) => { entry.symbol = normalizeSymbol(entry.symbol); });

    const activeExchanges = health.filter(h => h.status === 'ok').length;
    const responseBody = {
      data,
      health,
      meta: {
        totalExchanges: health.length,
        activeExchanges,
        totalEntries: data.length,
        timestamp: Date.now(),
      },
    };

    l1Cache = { body: responseBody, timestamp: Date.now() };
    return NextResponse.json(responseBody, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Spot prices API error:', msg);

    if (l1Cache) {
      return NextResponse.json(l1Cache.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=10' },
      });
    }
    return NextResponse.json(
      { data: [], health: [], meta: { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() } },
      { status: 500 }
    );
  }
}
