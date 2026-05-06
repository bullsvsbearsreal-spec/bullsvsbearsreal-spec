/**
 * GET /api/cme-basis
 *
 * CME Bitcoin + Ether futures basis vs spot. The basis is the % premium
 * (or discount) of the CME futures contract relative to spot, annualized
 * to the contract's expiry — also called the cash-and-carry rate.
 *
 * Persistent positive basis means leveraged longs are bidding the futures
 * price above spot — institutional risk-on. Negative basis (backwardation)
 * is rare and usually marks fear / forced deleveraging.
 *
 * Free Yahoo Finance for CME futures (BTC=F front-month, ETHUSD=F),
 * CoinGecko for spot. L1 cached 5 min — actual logic in @/lib/basis.
 */
import { NextResponse } from 'next/server';
import { getCmeBasis } from '@/lib/basis';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows, ts, fromCache } = await getCmeBasis();
  return NextResponse.json({ rows, ts }, {
    headers: {
      'X-Cache': fromCache ? 'HIT' : 'MISS',
      'Cache-Control': rows.length > 0
        ? 'public, s-maxage=240, stale-while-revalidate=600'
        : 'no-store',
    },
  });
}
