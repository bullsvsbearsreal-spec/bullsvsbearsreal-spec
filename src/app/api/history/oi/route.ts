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

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const VALID_PERIODS = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

// L1 in-memory cache for Binance source (120s TTL)
const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 120_000;

// Binance fapi domains — .com is often geo-blocked from Vercel bom1, try .me fallback
const BINANCE_FAPI_BASES = ['https://fapi.binance.com', 'https://fapi.binance.me'];

function mapPeriodToOKX(period: string): string {
  if (period === '5m') return '5m';
  if (['15m', '30m', '1h', '2h'].includes(period)) return '1H';
  return '1D';
}

async function fetchBinanceOIHistory(symbol: string, period: string, limit: number) {
  for (const base of BINANCE_FAPI_BASES) {
    try {
      const res = await fetchWithTimeout(
        `${base}/futures/data/openInterestHist?symbol=${symbol}USDT&period=${period}&limit=${limit}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;
      return data.map((d: any) => ({
        t: d.timestamp,
        oi: parseFloat(d.sumOpenInterestValue),
        oiCoins: parseFloat(d.sumOpenInterest),
      }));
    } catch { continue; }
  }
  return null;
}

async function fetchOKXOIHistory(symbol: string, period: string) {
  try {
    const okxPeriod = mapPeriodToOKX(period);
    const res = await fetchWithTimeout(
      `https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${symbol}&period=${okxPeriod}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const rows: any[] = json?.data;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // OKX returns [timestamp, oi_usd, vol_usd] sorted DESC — reverse to ASC to match Binance
    return rows
      .map((r: any) => ({
        t: parseInt(r[0], 10) || 0,
        oi: parseFloat(r[1]) || 0,
        vol: parseFloat(r[2]) || 0,
        oiCoins: null,
      }))
      .sort((a, b) => a.t - b.t);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const source = searchParams.get('source') || 'db';

  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) {
    return NextResponse.json({ error: 'Missing or invalid symbol parameter' }, { status: 400 });
  }

  // --- Exchange source (Binance primary, OKX fallback when Binance is geo-blocked) ---
  if (source === 'binance' || source === 'okx' || source === 'exchange') {
    const period = VALID_PERIODS.includes(searchParams.get('period') || '')
      ? searchParams.get('period')!
      : '1h';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10), 1), 500);

    const cacheKey = `oi_ex_${symbol}_${period}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.body, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    try {
      // Fire Binance and OKX in parallel for robustness
      const [binanceResult, okxResult] = await Promise.allSettled([
        source === 'okx' ? Promise.resolve(null) : fetchBinanceOIHistory(symbol, period, limit),
        fetchOKXOIHistory(symbol, period),
      ]);
      const binancePoints = binanceResult.status === 'fulfilled' ? binanceResult.value : null;
      const okxPoints = okxResult.status === 'fulfilled' ? okxResult.value : null;

      let resolvedSource: 'binance' | 'okx' = 'binance';
      let points: any[] | null = null;
      if (source === 'okx') {
        points = okxPoints;
        resolvedSource = 'okx';
      } else if (binancePoints && binancePoints.length > 0) {
        points = binancePoints;
        resolvedSource = 'binance';
      } else if (okxPoints && okxPoints.length > 0) {
        points = okxPoints;
        resolvedSource = 'okx';
      }

      if (!points || points.length === 0) {
        return NextResponse.json({ symbol, source: resolvedSource, period, points: [], count: 0 });
      }

      const body = { symbol, source: resolvedSource, period, points, count: points.length };

      cache.set(cacheKey, { body, ts: Date.now() });
      if (cache.size > 200) {
        const keys = Array.from(cache.keys()).slice(0, 50);
        for (const k of keys) cache.delete(k);
      }

      return NextResponse.json(body, {
        headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    } catch (error) {
      console.error('Exchange OI history error:', error);
      if (cached) {
        return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
      }
      return NextResponse.json({ error: 'Failed to fetch OI history' }, { status: 502 });
    }
  }

  // --- DB source (default) ---
  if (!isDBConfigured()) {
    return NextResponse.json({ symbol, days: 7, points: [] });
  }

  // Days ceiling matches Whale-tier historyDays (5y). Was 90, which
  // re-clamped paid users coming through /api/chat after the chat
  // layer already applied its per-tier cap. DB returns less if it
  // has less — no harm asking for more than exists.
  const MAX_DAYS = 365 * 5;
  const days = Math.min(parseInt(searchParams.get('days') || '7') || 7, MAX_DAYS);
  const points = await getOIHistory(symbol, days);

  return NextResponse.json({
    symbol,
    days,
    points,
    count: points.length,
  });
}
