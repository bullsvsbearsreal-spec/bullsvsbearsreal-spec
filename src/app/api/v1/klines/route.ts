import { NextRequest, NextResponse } from 'next/server';
import { authenticateV1Request } from '@/lib/api/v1-auth';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/klines
 *
 * Returns OHLCV candle data for a symbol on the requested timeframe.
 * Backed by the same multi-venue fallback chain as /api/klines
 * (Binance perp → Bybit → OKX → Binance spot) so a single venue
 * outage doesn't break the response.
 *
 * Query params:
 *   ?symbol=BTC       — base symbol (USDT pair appended internally)
 *   ?interval=1h      — 1m | 5m | 15m | 1h | 4h | 1d | 1w
 *   ?limit=100        — number of candles (1..500, default 100)
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       pair:     "BTCUSDT",
 *       interval: "1h",
 *       source:   "binance" | "bybit" | "okx",
 *       count:    100,
 *       candles:  [{ time, open, high, low, close, volume, closeTime }, ...]
 *     },
 *     meta: { timestamp }
 *   }
 *
 * Auth: Bearer ih_xxx (free tier OK).
 * Cache: 30s edge.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://info-hub.io';
  const qs = request.nextUrl.search; // includes leading ? when non-empty

  try {
    const upstreamRes = await fetch(`${baseUrl}/api/klines${qs}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    });

    if (!upstreamRes.ok) {
      let err: string = 'upstream failure';
      try {
        const j = await upstreamRes.json();
        err = j?.error || err;
      } catch { /* fall through */ }
      return NextResponse.json(
        { success: false, error: err },
        { status: upstreamRes.status === 400 ? 400 : 502 },
      );
    }

    const upstream = await upstreamRes.json();
    return NextResponse.json({
      success: true,
      data: upstream,
      meta: { timestamp: Date.now() },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/klines error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
