/**
 * GET /api/liquidations?symbol=BTC&exchange=okx&limit=100
 *
 * Returns recent liquidation orders via REST API.
 * Currently supports OKX (7-day history, no auth needed).
 * Complements the existing WebSocket-based real-time liquidation feed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// L1 in-memory cache (30s TTL)
const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 30_000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const exchange = (searchParams.get('exchange') || 'okx').toLowerCase();
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 100);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  if (exchange !== 'okx') {
    return NextResponse.json(
      { error: 'Only OKX REST liquidations are supported. Use WebSocket for other exchanges.' },
      { status: 400 }
    );
  }

  const cacheKey = `liq_${exchange}_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  }

  try {
    const instId = `${symbol}-USDT-SWAP`;
    const res = await fetchWithTimeout(
      `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&instId=${instId}&state=filled&limit=${limit}`
    );

    if (!res.ok) {
      return NextResponse.json({ error: `OKX returned ${res.status}` }, { status: 502 });
    }

    const json = await res.json();
    const entries: any[] = json?.data || [];

    // OKX returns grouped by instrument, each with a details array
    const liquidations: any[] = [];
    for (const entry of entries) {
      const details: any[] = entry.details || [];
      for (const d of details) {
        // OKX side: "buy" = short liquidated (forced buy-back), "sell" = long liquidated (forced sell)
        const side = d.side === 'buy' ? 'short' : 'long';
        const size = parseFloat(d.sz) || 0;
        const price = parseFloat(d.bkPx) || 0; // bankruptcy price
        liquidations.push({
          side,
          size,
          price,
          value: size * price,
          timestamp: parseInt(d.ts, 10),
        });
      }
    }

    // Sort by timestamp descending (most recent first)
    liquidations.sort((a, b) => b.timestamp - a.timestamp);

    const body = {
      symbol,
      exchange: 'OKX',
      data: liquidations,
      meta: {
        count: liquidations.length,
        timestamp: Date.now(),
      },
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
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Liquidations error:', error);
    if (cached) {
      return NextResponse.json(cached.body, { headers: { 'X-Cache': 'STALE' } });
    }
    return NextResponse.json({ error: 'Failed to fetch liquidation data' }, { status: 502 });
  }
}
