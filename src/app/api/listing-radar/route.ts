/**
 * GET /api/listing-radar
 *
 * Pre-listing leak tracker: aggregates Binance announcement catalogs
 * (new listings + delistings), classifies by type, extracts tickers.
 *
 * Cache: 5 min in-process. Listings move slowly enough.
 */
import { NextResponse } from 'next/server';
import { buildListingRadar } from '@/lib/listing-radar';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

let l1: { ts: number; body: any } | null = null;
const L1_TTL = 5 * 60 * 1000;

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  }
  const feed = await buildListingRadar();
  if (feed.events.length > 0) l1 = { ts: feed.ts, body: feed };
  return NextResponse.json(feed, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': feed.events.length > 0
        ? 'public, s-maxage=300, stale-while-revalidate=900'
        : 'no-store',
    },
  });
}
