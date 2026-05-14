import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

let l1Cache = new Map<string, { data: any; ts: number }>();
const L1_TTL = 60_000; // 1 min

/**
 * GET /api/v1/options
 *
 * Returns options market data: max pain, put/call ratio, OI by strike, IV.
 * Query params:
 *   ?currency=BTC — currency (BTC, ETH, SOL — default BTC)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const currency = (request.nextUrl.searchParams.get('currency') || 'BTC').toUpperCase();
  const SUPPORTED = ['BTC', 'ETH', 'SOL'];
  if (!SUPPORTED.includes(currency)) {
    return NextResponse.json({ success: false, error: `Supported currencies: ${SUPPORTED.join(', ')}` }, { status: 400 });
  }

  try {
    let raw: any;
    const cached = l1Cache.get(currency);
    if (cached && Date.now() - cached.ts < L1_TTL) {
      raw = cached.data;
    } else {
      const origin = request.nextUrl.origin;
      const res = await fetch(
        `${origin}/api/options?currency=${currency}`,
        { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'InfoHub-v1-internal' } },
      );
      if (!res.ok) return NextResponse.json({ success: false, error: 'Upstream fetch failed' }, { status: 502 });
      raw = await res.json();
      // Only pin cache when we got real options data. /api/options can
      // return `{ instrumentCount: 0, ... }` when Deribit is in
      // maintenance — pinning that for 60s meant /api/v1/options
      // partners saw "no options data" as authoritative for the cache
      // window after Deribit recovered.
      if (raw && (raw.instrumentCount > 0 || (Array.isArray(raw.ivSmile) && raw.ivSmile.length > 0))) {
        l1Cache.set(currency, { data: raw, ts: Date.now() });
      }
    }

    // Derive ATM IV from ivSmile (strike closest to underlying price)
    let ivAtm: number | null = null;
    if (raw.ivSmile?.length > 0 && raw.underlyingPrice > 0) {
      const closest = raw.ivSmile.reduce((best: any, s: any) =>
        Math.abs(s.strike - raw.underlyingPrice) < Math.abs(best.strike - raw.underlyingPrice) ? s : best
      );
      ivAtm = closest.callIV > 0 ? closest.callIV : closest.putIV > 0 ? closest.putIV : null;
    }

    return NextResponse.json({
      success: true,
      data: {
        currency,
        underlyingPrice: raw.underlyingPrice ?? null,
        maxPain: raw.maxPain ?? null,
        putCallRatio: raw.putCallRatio ?? null,
        totalCallOI: raw.totalCallOI ?? null,
        totalPutOI: raw.totalPutOI ?? null,
        totalOI: raw.totalOI ?? null,
        instrumentCount: raw.instrumentCount ?? null,
        ivAtm,
        exchanges: raw.exchangeBreakdown ?? [],
        expirations: raw.expiryBreakdown ?? [],
        strikeData: raw.strikeData ?? [],
        ivSmile: raw.ivSmile ?? [],
      },
      meta: { timestamp: Date.now() },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/options error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
