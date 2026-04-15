import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

let l1Cache = new Map<string, { data: any; ts: number }>();
const L1_TTL = 60_000; // 1 min

/**
 * GET /api/v1/longshort
 *
 * Returns long/short ratio data for a symbol.
 * Query params:
 *   ?symbol=BTC     — symbol (default BTC)
 *   ?period=1h      — time period: 5m, 15m, 30m, 1h, 4h, 1d (default 1h)
 *   ?source=global  — data source: global, topTraders, taker (default global)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const period = searchParams.get('period') || '1h';
  const source = searchParams.get('source') || 'global';
  const cacheKey = `${symbol}-${period}-${source}`;

  try {
    let raw: any;
    const cached = l1Cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < L1_TTL) {
      raw = cached.data;
    } else {
      const origin = request.nextUrl.origin;
      // Internal route expects BTCUSDT format for Binance; append USDT if bare symbol
      const internalSymbol = /USDT$/i.test(symbol) ? symbol : `${symbol}USDT`;
      const res = await fetch(
        `${origin}/api/longshort?symbol=${internalSymbol}&period=${period}&source=${source}&limit=30`,
        { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'InfoHub-v1-internal' } },
      );
      if (!res.ok) return NextResponse.json({ success: false, error: 'Upstream fetch failed' }, { status: 502 });
      raw = await res.json();
      l1Cache.set(cacheKey, { data: raw, ts: Date.now() });
      // Cap cache entries
      if (l1Cache.size > 50) {
        const oldest = Array.from(l1Cache.entries()).sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) l1Cache.delete(oldest[0]);
      }
    }

    // Internal API returns { points: [...] } for limit>1, or flat { longRatio, shortRatio } for limit=1
    const points = raw.points ?? [];
    const latest = points.length > 0 ? points[points.length - 1] : raw;

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        period,
        source,
        longRatio: latest.longRatio ?? raw.longRatio ?? null,
        shortRatio: latest.shortRatio ?? raw.shortRatio ?? null,
        exchange: raw.exchange ?? null,
        history: points,
      },
      meta: { timestamp: Date.now() },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    console.error('v1/longshort error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
