/**
 * GET /api/klines?symbol=BTC&interval=1h&limit=200
 *
 * Proxies Binance OHLCV (kline) data for charting.
 * Symbol is converted to USDT pair format.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const VALID_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const interval = searchParams.get('interval') || '1h';
  const limit = Math.min(parseInt(searchParams.get('limit') || '200') || 200, 500);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: `Invalid interval. Use: ${VALID_INTERVALS.join(', ')}` }, { status: 400 });
  }

  const pair = `${symbol}USDT`;

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
      { next: { revalidate: 60 } },
    );

    if (!res.ok) {
      // Try without USDT (maybe it's already a full pair)
      const res2 = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        { next: { revalidate: 60 } },
      );
      if (!res2.ok) {
        return NextResponse.json({ error: `Binance returned ${res.status}` }, { status: 502 });
      }
      const data2 = await res2.json();
      return formatResponse(data2, symbol, interval);
    }

    const data = await res.json();
    return formatResponse(data, pair, interval);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch kline data' },
      { status: 500 },
    );
  }
}

function formatResponse(data: any[], pair: string, interval: string) {
  const candles = data.map((k: any[]) => ({
    time: k[0],       // Open time (ms)
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }));

  return NextResponse.json({
    pair,
    interval,
    candles,
    count: candles.length,
  });
}
