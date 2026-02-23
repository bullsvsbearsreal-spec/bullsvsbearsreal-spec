/**
 * GET /api/orderbook?symbol=BTC&limit=25
 *
 * Aggregated order book depth from Binance Futures.
 * Returns bids, asks, and recent trades for depth visualization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// Cache: 5-second TTL (order book changes rapidly)
interface CachedOB {
  body: any;
  timestamp: number;
}
const l1Cache = new Map<string, CachedOB>();
const L1_TTL = 5 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50);
  const pair = `${symbol}USDT`;

  // L1 cache
  const cacheKey = `ob_${pair}_${limit}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < L1_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    // Fetch depth + recent trades in parallel
    const [depthRes, tradesRes] = await Promise.all([
      fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/depth?symbol=${pair}&limit=${limit}`,
        {},
        8000,
      ),
      fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/trades?symbol=${pair}&limit=50`,
        {},
        8000,
      ),
    ]);

    if (!depthRes.ok) {
      return NextResponse.json({ error: `Binance depth API returned ${depthRes.status}` }, { status: 502 });
    }

    const depth = await depthRes.json();
    const trades = tradesRes.ok ? await tradesRes.json() : [];

    // Process bids/asks
    const bids = (depth.bids || []).map(([price, qty]: [string, string]) => ({
      price: parseFloat(price),
      quantity: parseFloat(qty),
      total: parseFloat(price) * parseFloat(qty),
    }));

    const asks = (depth.asks || []).map(([price, qty]: [string, string]) => ({
      price: parseFloat(price),
      quantity: parseFloat(qty),
      total: parseFloat(price) * parseFloat(qty),
    }));

    // Cumulative depth
    let cumBid = 0;
    const cumulativeBids = bids.map((b: any) => {
      cumBid += b.total;
      return { ...b, cumulative: cumBid };
    });

    let cumAsk = 0;
    const cumulativeAsks = asks.map((a: any) => {
      cumAsk += a.total;
      return { ...a, cumulative: cumAsk };
    });

    // Process trades
    const recentTrades = (trades as any[]).slice(-30).map((t: any) => ({
      price: parseFloat(t.price),
      quantity: parseFloat(t.qty),
      quoteQty: parseFloat(t.quoteQty),
      isBuyerMaker: t.isBuyerMaker,
      time: t.time,
    }));

    // Buy/sell volume ratio from recent trades
    const buyVol = recentTrades.filter((t: any) => !t.isBuyerMaker).reduce((s: number, t: any) => s + t.quoteQty, 0);
    const sellVol = recentTrades.filter((t: any) => t.isBuyerMaker).reduce((s: number, t: any) => s + t.quoteQty, 0);
    const totalTradeVol = buyVol + sellVol;

    const body = {
      symbol,
      pair,
      bids: cumulativeBids,
      asks: cumulativeAsks,
      trades: recentTrades.reverse(), // newest first
      spread: asks.length > 0 && bids.length > 0 ? asks[0].price - bids[0].price : 0,
      midPrice: asks.length > 0 && bids.length > 0 ? (asks[0].price + bids[0].price) / 2 : 0,
      bidDepth: cumBid,
      askDepth: cumAsk,
      buyVolume: buyVol,
      sellVolume: sellVol,
      buySellRatio: totalTradeVol > 0 ? buyVol / totalTradeVol : 0.5,
      timestamp: Date.now(),
    };

    l1Cache.set(cacheKey, { body, timestamp: Date.now() });

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=5' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch order book data' }, { status: 502 });
  }
}
