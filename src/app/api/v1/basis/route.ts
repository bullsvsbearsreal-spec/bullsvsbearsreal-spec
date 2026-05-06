import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { getCmeBasis } from '@/lib/basis';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/basis
 *
 * CME futures basis vs spot for Bitcoin and Ether.
 *
 * Returns the cash-and-carry rate institutions use to size their basis
 * trades — when annualised basis is positive, longs in CME futures are
 * paying for the privilege (risk-on). When negative, the opposite.
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: [
 *       { asset, spot, cmeFront, daysToExpiry, basisPct, annualizedPct, cmeSource, spotSource }
 *     ],
 *     meta: { timestamp, fromCache }
 *   }
 *
 * Auth: Bearer ih_xxx (free tier OK).
 * Cache: 5 minutes upstream + edge cache, basis moves slowly.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  try {
    const { rows, ts, fromCache } = await getCmeBasis();
    return NextResponse.json({
      success: true,
      data: rows,
      meta: { timestamp: ts, fromCache },
    }, {
      headers: {
        'X-Cache': fromCache ? 'HIT' : 'MISS',
        'Cache-Control': rows.length > 0
          ? 'public, s-maxage=240, stale-while-revalidate=600'
          : 'no-store',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/basis error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
