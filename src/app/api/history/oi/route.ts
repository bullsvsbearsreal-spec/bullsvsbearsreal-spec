/**
 * GET /api/history/oi?symbol=BTC&days=7
 * GET /api/history/oi?symbol=BTC&source=binance&period=1h&limit=200
 *
 * Returns historical open interest data.
 * source=db (default): aggregated from database (10-min cron snapshots).
 * source=binance: fetched directly from Binance openInterestHist API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOIHistory, isDBConfigured } from '@/lib/db';
import { fetchWithTimeout } from '../../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const VALID_PERIODS = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

// L1 in-memory cache for Binance source (120s TTL)
const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 120_000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const source = searchParams.get('source') || 'db';

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  // --- Binance source ---
  if (source === 'binance') {
    const period = VALID_PERIODS.includes(searchParams.get('period') || '')
      ? searchParams.get('period')!
      : '1h';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10), 1), 500);

    const cacheKey = `oi_binance_${symbol}_${period}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.body, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    try {
      const res = await fetchWithTimeout(
        `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}USDT&period=${period}&limit=${limit}`
      );
      if (!res.ok) {
        return NextResponse.json({ error: `Binance returned ${res.status}` }, { status: 502 });
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json({ symbol, source: 'binance', period, points: [], count: 0 });
      }

      const points = data.map((d: any) => ({
        t: d.timestamp,
        oi: parseFloat(d.sumOpenInterestValue),
        oiCoins: parseFloat(d.sumOpenInterest),
      }));

      const body = { symbol, source: 'binance', period, points, count: points.length };

      cache.set(cacheKey, { body, ts: Date.now() });
      if (cache.size > 200) {
        const iter = cache.keys();
        for (let i = 0; i < 50; i++) {
          const k = iter.next().value;
          if (k) cache.delete(k);
        }
      }

      return NextResponse.json(body, {
        headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    } catch (error) {
      console.error('Binance OI history error:', error);
      if (cached) {
        return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
      }
      return NextResponse.json({ error: 'Failed to fetch Binance OI history' }, { status: 502 });
    }
  }

  // --- DB source (default) ---
  if (!isDBConfigured()) {
    return NextResponse.json({ symbol, days: 7, points: [] });
  }

  const days = Math.min(parseInt(searchParams.get('days') || '7') || 7, 90);
  const points = await getOIHistory(symbol, days);

  return NextResponse.json({
    symbol,
    days,
    points,
    count: points.length,
  });
}
