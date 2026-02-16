import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { tickerFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// L1: In-memory cache (30-second TTL — prices need to be reasonably fresh)
// ---------------------------------------------------------------------------
let l1Cache: { body: any; timestamp: number } | null = null;
const L1_TTL = 30 * 1000; // 30 seconds

export async function GET() {
  // L1: Return cached data if fresh
  if (l1Cache && Date.now() - l1Cache.timestamp < L1_TTL) {
    return NextResponse.json(l1Cache.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  }

  try {
    const { data, health } = await fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout);

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

    // Update L1 cache
    l1Cache = { body: responseBody, timestamp: Date.now() };

    return NextResponse.json(responseBody, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Tickers API error:', msg);

    // Return stale cache if available
    if (l1Cache) {
      return NextResponse.json(l1Cache.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=10' },
      });
    }

    return NextResponse.json({ data: [], health: [], meta: { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() } }, { status: 500 });
  }
}
