/**
 * GET /api/aggtrades?symbol=BTC&limit=500
 *
 * Proxies Binance aggTrades for CVD (Cumulative Volume Delta) calculation.
 * Returns recent aggregate trades to compute buy/sell volume delta.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const limit = Math.min(parseInt(searchParams.get('limit') || '500') || 500, 1000);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const pair = `${symbol}USDT`;

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/aggTrades?symbol=${pair}&limit=${limit}`,
      { next: { revalidate: 10 } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Binance returned ${res.status}` }, { status: 502 });
    }

    const trades: any[] = await res.json();

    // Process trades: m = true means the buyer is the maker (sell aggressor)
    // m = false means the seller is the maker (buy aggressor)
    const processed = trades.map((t: any) => ({
      time: t.T, // Timestamp
      price: parseFloat(t.p),
      qty: parseFloat(t.q),
      isBuy: !t.m, // If m=false, it's a buy (taker bought)
    }));

    // Compute CVD buckets (1-minute intervals)
    const bucketMs = 60 * 1000;
    const bucketMap = new Map<number, { buyVol: number; sellVol: number; buyQty: number; sellQty: number }>();

    processed.forEach((t: any) => {
      const key = Math.floor(t.time / bucketMs) * bucketMs;
      const b = bucketMap.get(key) || { buyVol: 0, sellVol: 0, buyQty: 0, sellQty: 0 };
      const vol = t.price * t.qty;
      if (t.isBuy) {
        b.buyVol += vol;
        b.buyQty += t.qty;
      } else {
        b.sellVol += vol;
        b.sellQty += t.qty;
      }
      bucketMap.set(key, b);
    });

    // Convert to array and compute cumulative delta
    const buckets: Array<{
      time: number;
      buyVol: number;
      sellVol: number;
      delta: number;
      cvd: number;
    }> = [];

    let cumDelta = 0;
    const sortedKeys: number[] = [];
    bucketMap.forEach((_, k) => sortedKeys.push(k));
    sortedKeys.sort((a, b) => a - b);

    sortedKeys.forEach((key) => {
      const b = bucketMap.get(key)!;
      const delta = b.buyVol - b.sellVol;
      cumDelta += delta;
      buckets.push({
        time: key,
        buyVol: b.buyVol,
        sellVol: b.sellVol,
        delta,
        cvd: cumDelta,
      });
    });

    // Summary stats
    const totalBuyVol = processed.filter((t: any) => t.isBuy).reduce((s: number, t: any) => s + t.price * t.qty, 0);
    const totalSellVol = processed.filter((t: any) => !t.isBuy).reduce((s: number, t: any) => s + t.price * t.qty, 0);

    return NextResponse.json({
      symbol,
      pair,
      tradeCount: processed.length,
      totalBuyVol,
      totalSellVol,
      netDelta: totalBuyVol - totalSellVol,
      buckets,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch trade data' },
      { status: 500 },
    );
  }
}
