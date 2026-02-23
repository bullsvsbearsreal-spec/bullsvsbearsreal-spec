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

  // Try Binance first, then Bybit as fallback
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const data = await res.json();
      return formatBinanceResponse(data, pair, interval);
    }
  } catch { /* fall through to Bybit */ }

  // Bybit fallback — interval format differs: 1=1m,5=5m,15=15m,60=1h,240=4h,D=1d,W=1w
  const bybitIntervalMap: Record<string, string> = {
    '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W',
  };
  const bybitInterval = bybitIntervalMap[interval] || '60';

  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/kline?category=linear&symbol=${pair}&interval=${bybitInterval}&limit=${limit}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const json = await res.json();
      const list = json?.result?.list;
      if (Array.isArray(list) && list.length > 0) {
        return formatBybitResponse(list, pair, interval);
      }
    }
  } catch { /* fall through to OKX */ }

  // OKX fallback — interval format: 1m,5m,15m,1H,4H,1D,1W
  const okxIntervalMap: Record<string, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W',
  };
  const okxInterval = okxIntervalMap[interval] || '1H';
  const okxInstId = `${symbol}-USDT-SWAP`;

  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/candles?instId=${okxInstId}&bar=${okxInterval}&limit=${Math.min(limit, 300)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const json = await res.json();
      if (json?.code === '0' && Array.isArray(json.data) && json.data.length > 0) {
        return formatOkxResponse(json.data, pair, interval);
      }
    }
  } catch { /* fall through */ }

  return NextResponse.json({ error: 'All kline sources failed' }, { status: 502 });
}

function formatBinanceResponse(data: any[], pair: string, interval: string) {
  const candles = data.map((k: any[]) => ({
    time: k[0],       // Open time (ms)
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }));

  return NextResponse.json({ pair, interval, candles, count: candles.length, source: 'binance' });
}

function formatBybitResponse(list: any[], pair: string, interval: string) {
  // Bybit returns: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
  // In REVERSE chronological order — newest first
  const candles = list
    .map((k: any) => ({
      time: parseInt(k[0], 10),  // Open time (ms)
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: parseInt(k[0], 10) + 60000,
    }))
    .reverse(); // Bybit returns newest first, we want oldest first

  return NextResponse.json({ pair, interval, candles, count: candles.length, source: 'bybit' });
}

function formatOkxResponse(data: any[], pair: string, interval: string) {
  // OKX returns: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
  // In REVERSE chronological order — newest first
  const candles = data
    .map((k: any) => ({
      time: parseInt(k[0], 10),  // Open time (ms)
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: parseInt(k[0], 10) + 60000,
    }))
    .reverse(); // OKX returns newest first

  return NextResponse.json({ pair, interval, candles, count: candles.length, source: 'okx' });
}
