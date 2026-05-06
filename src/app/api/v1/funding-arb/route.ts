import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/funding-arb
 *
 * Cross-exchange funding-rate arbitrage scanner. For every symbol that
 * trades on >= min_venues exchanges, returns the venue with the lowest
 * funding rate (LONG to collect/pay-less) and the venue with the highest
 * (SHORT to collect), plus the 8h-normalised spread and annualised yield.
 *
 * Query params:
 *   ?min_venues=3       2..40, only include symbols with >= N venues (default 3)
 *   ?min_spread=0.01    minimum spread (% per 8h) to include (default 0.01 = 1bp)
 *   ?sort=annualized    annualized | spread | venues  (default: annualized)
 *   ?limit=100          max symbols returned, 1..500 (default 100)
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: [{ symbol, venueCount, min, max, spread8h, annualized, venues, ... }],
 *     summary: { totalSymbols, displayed, topAnnualized, topSymbol, medianSpread, dexCrossSymbols },
 *     meta: { timestamp, minVenues, minSpread, sort, limit }
 *   }
 *
 * Auth: Bearer ih_xxx (free tier OK).
 *
 * Note: this proxies the existing /api/funding-arb logic. Both share an
 * in-process cache so v1 callers benefit from the public route's warm
 * results without doubling upstream load.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  // Forward the user's query params verbatim to the underlying public
  // route — the upstream already does input validation + caching.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
  const qs = request.nextUrl.search; // includes leading ? when non-empty
  try {
    const res = await fetch(`${baseUrl}/api/funding-arb${qs}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `funding-arb upstream ${res.status}` },
        { status: 502 },
      );
    }
    const upstream = await res.json();
    // Wrap in the v1 response envelope.
    return NextResponse.json({
      success: true,
      data: upstream.data ?? [],
      summary: upstream.summary ?? null,
      meta: upstream.meta ?? { timestamp: Date.now() },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/funding-arb error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
