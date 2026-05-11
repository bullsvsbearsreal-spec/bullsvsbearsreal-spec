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
// Whitelisted enum values — these are forwarded verbatim into the
// internal `${origin}/api/longshort?period=X&source=Y` URL. Without
// whitelist validation an attacker could forge cache keys with
// path-traversal-like values OR inject arbitrary upstream params.
const VALID_PERIODS = new Set(['5m', '15m', '30m', '1h', '4h', '1d']);
const VALID_SOURCES = new Set(['global', 'topTraders', 'taker']);
const SYMBOL_RE = /^[A-Z0-9]{1,16}$/;

export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const rawSymbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const symbol = SYMBOL_RE.test(rawSymbol) ? rawSymbol : 'BTC';
  const rawPeriod = searchParams.get('period') || '1h';
  const period = VALID_PERIODS.has(rawPeriod) ? rawPeriod : '1h';
  const rawSource = searchParams.get('source') || 'global';
  const source = VALID_SOURCES.has(rawSource) ? rawSource : 'global';
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
    const longPct  = latest.longRatio  ?? raw.longRatio  ?? null;
    const shortPct = latest.shortRatio ?? raw.shortRatio ?? null;

    // Derived view — convenient for callers that don't want to compute it.
    let longShortRatio: number | null = null;
    let regime: 'crowded-long' | 'long-heavy' | 'balanced' | 'short-heavy' | 'crowded-short' | null = null;
    if (longPct != null && shortPct != null && shortPct > 0) {
      longShortRatio = longPct / shortPct;
      if (longPct >= 70) regime = 'crowded-long';
      else if (longPct >= 60) regime = 'long-heavy';
      else if (longPct >= 40) regime = 'balanced';
      else if (longPct >= 30) regime = 'short-heavy';
      else regime = 'crowded-short';
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        period,
        source,
        longRatio: longPct,
        shortRatio: shortPct,
        longShortRatio,
        regime,
        exchange: raw.exchange ?? null,
        history: points,
      },
      meta: { timestamp: Date.now() },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...auth.headers,
      },
    });
  } catch (e) {
    console.error('v1/longshort error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
