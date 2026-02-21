/**
 * GET /api/history/funding?symbol=BTC&exchange=Binance&days=30
 * GET /api/history/funding?symbol=BTC&source=exchange&exchange=hyperliquid&days=7
 * GET /api/history/funding?symbol=BTC&source=exchange&exchange=bitget&days=30
 *
 * Returns historical funding rate data.
 * source=db (default): from database (10-min cron snapshots).
 * source=exchange: fetched directly from Hyperliquid or Bitget APIs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundingHistory, isDBConfigured } from '@/lib/db';
import { fetchWithTimeout } from '../../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// L1 in-memory cache for exchange sources (300s TTL)
const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 300_000;

const SUPPORTED_EXCHANGE_SOURCES = ['hyperliquid', 'bitget'];

async function fetchHyperliquidFundingHistory(symbol: string, days: number) {
  const endTime = Date.now();
  const startTime = endTime - days * 86_400_000;

  const res = await fetchWithTimeout(
    `https://api.hyperliquid.xyz/info?_t=${Date.now()}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
      },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: symbol,
        startTime,
        endTime,
      }),
    },
    15000
  );

  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return data.map((d: any) => ({
    t: d.time,
    rate: parseFloat(d.fundingRate) * 100, // fraction → %
    premium: parseFloat(d.premium) || undefined,
  }));
}

async function fetchBitgetFundingHistory(symbol: string, days: number) {
  const res = await fetchWithTimeout(
    `https://api.bitget.com/api/v2/mix/market/history-fund-rate?productType=USDT-FUTURES&symbol=${symbol}USDT`
  );

  if (!res.ok) return null;
  const json = await res.json();
  const data: any[] = json?.data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const cutoff = Date.now() - days * 86_400_000;
  return data
    .map((d: any) => ({
      t: parseInt(d.settleTime || d.fundingTime, 10),
      rate: parseFloat(d.fundingRate) * 100, // fraction → %
    }))
    .filter((p: any) => p.t >= cutoff)
    .sort((a: any, b: any) => a.t - b.t);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const source = searchParams.get('source') || 'db';
  const exchange = searchParams.get('exchange') || undefined;
  const days = Math.min(parseInt(searchParams.get('days') || '30') || 30, 90);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  // --- Exchange source (Hyperliquid, Bitget) ---
  if (source === 'exchange') {
    const exLower = (exchange || '').toLowerCase();
    if (!SUPPORTED_EXCHANGE_SOURCES.includes(exLower)) {
      return NextResponse.json(
        { error: `Exchange source not supported. Use: ${SUPPORTED_EXCHANGE_SOURCES.join(', ')}` },
        { status: 400 }
      );
    }

    const cacheKey = `fh_${exLower}_${symbol}_${days}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.body, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
      });
    }

    try {
      let points: any[] | null = null;
      let exchangeName = '';

      if (exLower === 'hyperliquid') {
        points = await fetchHyperliquidFundingHistory(symbol, days);
        exchangeName = 'Hyperliquid';
      } else if (exLower === 'bitget') {
        points = await fetchBitgetFundingHistory(symbol, days);
        exchangeName = 'Bitget';
      }

      const body = {
        symbol,
        exchange: exchangeName,
        source: 'exchange',
        days,
        points: points || [],
        count: points?.length || 0,
      };

      cache.set(cacheKey, { body, ts: Date.now() });
      if (cache.size > 100) {
        const iter = cache.keys();
        for (let i = 0; i < 25; i++) {
          const k = iter.next().value;
          if (k) cache.delete(k);
        }
      }

      return NextResponse.json(body, {
        headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
      });
    } catch (error) {
      console.error(`Funding history (${exLower}) error:`, error);
      if (cached) {
        return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
      }
      return NextResponse.json({ error: `Failed to fetch ${exchange} funding history` }, { status: 502 });
    }
  }

  // --- DB source (default) ---
  if (!isDBConfigured()) {
    return NextResponse.json({ symbol, exchange: exchange || 'all', days, points: [] });
  }

  const points = await getFundingHistory(symbol, exchange, days);

  return NextResponse.json({
    symbol,
    exchange: exchange || 'all',
    days,
    points,
    count: points.length,
  });
}
