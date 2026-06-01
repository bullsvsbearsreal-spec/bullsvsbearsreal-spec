/**
 * GET /api/klines?symbol=BTC&interval=1h&limit=200
 *
 * Proxies Binance OHLCV (kline) data for charting.
 * Symbol is converted to USDT pair format.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const VALID_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawSymbol = searchParams.get('symbol')?.toUpperCase() || '';
  const symbol = /^[A-Z0-9]+$/.test(rawSymbol) ? rawSymbol : '';
  const interval = searchParams.get('interval') || '1h';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200') || 200, 1), 500);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: `Invalid interval. Use: ${VALID_INTERVALS.join(', ')}` }, { status: 400 });
  }

  // Robust input handling: accept BOTH the canonical bare base ("BTC")
  // AND the Binance-convention pair ("BTCUSDT") — many bot devs pass
  // the full pair out of muscle memory. Without this guard, "BTCUSDT"
  // → "BTCUSDTUSDT" → all 4 venues 404 → 504 gateway timeout HTML
  // response. Stripping a trailing USDT keeps both inputs working.
  const base = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
  const pair = `${base}USDT`;

  // Fan out to all 4 venues in parallel and return the first non-empty hit.
  // Previously this was serial with 8s+8s+8s+6s = 30s worst case, which
  // hit the gateway timeout for unknown symbols (all venues fail) and
  // returned 504 HTML instead of the intended 502 JSON. Now: 6s worst
  // case regardless of how many venues we have to consult.
  const bybitIntervalMap: Record<string, string> = {
    '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W',
  };
  const bybitInterval = bybitIntervalMap[interval] || '60';

  const okxIntervalMap: Record<string, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W',
  };
  const okxInterval = okxIntervalMap[interval] || '1H';
  const okxInstId = `${base}-USDT-SWAP`;

  const TIMEOUT = 6000;

  type Attempt = () => Promise<NextResponse | null>;

  const tryBinanceFutures: Attempt = async () => {
    try {
      const res = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
        { signal: AbortSignal.timeout(TIMEOUT) },
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      return formatBinanceResponse(data, pair, interval);
    } catch { return null; }
  };

  const tryBybit: Attempt = async () => {
    try {
      const res = await fetch(
        `https://api.bybit.com/v5/market/kline?category=linear&symbol=${pair}&interval=${bybitInterval}&limit=${limit}`,
        { signal: AbortSignal.timeout(TIMEOUT) },
      );
      if (!res.ok) return null;
      const json = await res.json();
      const list = json?.result?.list;
      if (!Array.isArray(list) || list.length === 0) return null;
      return formatBybitResponse(list, pair, interval);
    } catch { return null; }
  };

  const tryOKX: Attempt = async () => {
    try {
      const res = await fetch(
        `https://www.okx.com/api/v5/market/candles?instId=${okxInstId}&bar=${okxInterval}&limit=${Math.min(limit, 300)}`,
        { signal: AbortSignal.timeout(TIMEOUT) },
      );
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.code !== '0' || !Array.isArray(json.data) || json.data.length === 0) return null;
      return formatOkxResponse(json.data, pair, interval);
    } catch { return null; }
  };

  const tryBinanceSpot: Attempt = async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
        { signal: AbortSignal.timeout(TIMEOUT) },
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      return formatBinanceResponse(data, pair, interval);
    } catch { return null; }
  };

  // Race: take the first venue that returns data, with a preference order
  // (Binance perp → Bybit → OKX → Binance spot) used only as a tiebreaker
  // if multiple resolve in the same tick.
  const results = await Promise.allSettled([
    tryBinanceFutures(),
    tryBybit(),
    tryOKX(),
    tryBinanceSpot(),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }

  return NextResponse.json(
    { error: 'All kline sources failed', pair, interval },
    { status: 502 },
  );
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

  return NextResponse.json({ pair, interval, candles, count: candles.length, source: 'binance' }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
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

  return NextResponse.json({ pair, interval, candles, count: candles.length, source: 'bybit' }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
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

  return NextResponse.json({ pair, interval, candles, count: candles.length, source: 'okx' }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
