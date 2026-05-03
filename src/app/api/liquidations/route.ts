/**
 * GET /api/liquidations?symbol=BTC&exchange=okx&limit=100
 *
 * Returns recent liquidation orders via REST API.
 * Currently supports OKX (7-day history, no auth needed).
 * Complements the existing WebSocket-based real-time liquidation feed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { LiquidationsQuerySchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

// L1 in-memory cache (30s TTL)
const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 30_000;

/**
 * OKX perpetual contract sizes. `sz` from liquidation-orders is in CONTRACTS,
 * not base units. Without this multiplier, BTC/ETH liquidation values were
 * overstated 10-100×.
 */
const OKX_CONTRACT_MULTIPLIER: Record<string, number> = {
  BTC: 0.01,
  ETH: 0.1,
  SOL: 1,
  XRP: 100,
  DOGE: 1000,
  HYPE: 1,
  ASTER: 10,
  BNB: 0.01,
  AVAX: 1,
  LINK: 1,
  SUI: 10,
  LTC: 1,
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = LiquidationsQuerySchema.safeParse({
    symbol: searchParams.get('symbol') || undefined,
    exchange: searchParams.get('exchange') || undefined,
    limit: searchParams.get('limit') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid parameters' },
      { status: 400 },
    );
  }
  const { symbol, exchange, limit } = parsed.data;

  if (exchange !== 'okx') {
    return NextResponse.json(
      { error: 'Only OKX REST liquidations are supported. Use WebSocket for other exchanges.' },
      { status: 400 }
    );
  }

  const cacheKey = `liq_${exchange}_${symbol}_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  }

  try {
    const instId = `${symbol}-USDT-SWAP`;
    const uly = `${symbol}-USDT`;
    const res = await fetchWithTimeout(
      `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&instId=${instId}&uly=${uly}&state=filled&limit=${limit}`,
      {}, 10000,
    );

    if (!res.ok) {
      return NextResponse.json({ error: `OKX returned ${res.status}` }, { status: 502 });
    }

    const json = await res.json();
    const entries: any[] = json?.data || [];
    const contractMult = OKX_CONTRACT_MULTIPLIER[parsed.data.symbol] ?? 1;

    // OKX returns grouped by instrument, each with a details array
    const liquidations: any[] = [];
    for (const entry of entries) {
      const details: any[] = entry.details || [];
      for (const d of details) {
        // OKX side: "buy" = short liquidated (forced buy-back), "sell" = long liquidated (forced sell)
        const side = d.side === 'buy' ? 'short' : 'long';
        const contracts = parseFloat(d.sz) || 0;
        const price = parseFloat(d.bkPx) || 0; // bankruptcy price
        // `sz` is in contracts, not base units — apply per-symbol multiplier.
        // Size in base units × price = USD value.
        const baseSize = contracts * contractMult;
        liquidations.push({
          side,
          size: baseSize,      // base units (BTC, ETH, SOL, etc.)
          price,
          value: baseSize * price,
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
      // Evict expired entries first
      const now = Date.now();
      cache.forEach((v, k) => { if (now - v.ts > CACHE_TTL) cache.delete(k); });
      // If still over limit, evict oldest until at 75
      if (cache.size > 100) {
        const entries: [string, { body: any; ts: number }][] = [];
        cache.forEach((v, k) => entries.push([k, v]));
        entries.sort((a, b) => a[1].ts - b[1].ts);
        const toEvict = cache.size - 75;
        entries.slice(0, toEvict).forEach(([k]) => cache.delete(k));
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
