/**
 * GET /api/restaking
 *
 * Aggregated restaking yield pools from EigenLayer, Symbiotic, Karak,
 * Babylon, Renzo, EtherFi, Kelp, Puffer, etc. Source: yields.llama.fi.
 *
 * Cache: 10 min — APYs move slowly; TVL changes more often but a 10min
 * stale read is still useful.
 */
import { NextResponse } from 'next/server';
import { fetchRestakingPools } from '@/lib/restaking';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

let l1: { ts: number; body: any } | null = null;
const L1_TTL = 10 * 60 * 1000;

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  }
  const feed = await fetchRestakingPools();
  if (feed.pools.length > 0) l1 = { ts: feed.ts, body: feed };
  return NextResponse.json(feed, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': feed.pools.length > 0
        ? 'public, s-maxage=600, stale-while-revalidate=1800'
        : 'no-store',
    },
  });
}
