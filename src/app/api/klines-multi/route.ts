export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// ── Exchange kline fetchers ──────────────────────────────────────────

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

const INTERVALS: Record<string, Record<string, string>> = {
  binance:  { '1h': '1h', '4h': '4h', '1d': '1d' },
  bybit:    { '1h': '60', '4h': '240', '1d': 'D' },
  okx:      { '1h': '1H', '4h': '4H', '1d': '1D' },
  bitget:   { '1h': '1h', '4h': '4h', '1d': '1d' },
  mexc:     { '1h': '1h', '4h': '4h', '1d': '1d' },
  kucoin:   { '1h': '1hour', '4h': '4hour', '1d': '1day' },
  htx:      { '1h': '60min', '4h': '4hour', '1d': '1day' },
  kraken:   { '1h': '60', '4h': '240', '1d': '1440' },
  gate:     { '1h': '1h', '4h': '4h', '1d': '1d' },
  coinbase: { '1h': 'ONE_HOUR', '4h': 'UNKNOWN', '1d': 'ONE_DAY' },
  hyperliquid: { '1h': '1h', '4h': '4h', '1d': '1d' },
  dydx:     { '1h': '1HOUR', '4h': '4HOURS', '1d': '1DAY' },
};

function normalizeSymbol(exchange: string, symbol: string): string {
  const s = symbol.toUpperCase();
  switch (exchange) {
    case 'binance': return `${s}USDT`;
    case 'bybit': return `${s}USDT`;
    case 'okx': return `${s}-USDT-SWAP`;
    case 'bitget': return `${s}USDT`;
    case 'mexc': return `${s}USDT`;
    case 'kucoin': return `${s}-USDT`;
    case 'htx': return `${s.toLowerCase()}usdt`;
    case 'kraken': return s === 'BTC' ? 'XXBTZUSD' : s === 'ETH' ? 'XETHZUSD' : `${s}USD`;
    case 'gate': return `${s}_USDT`;
    case 'coinbase': return `${s}-USD`;
    case 'hyperliquid': return s;
    case 'dydx': return `${s}-USD`;
    default: return `${s}USDT`;
  }
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}

async function fetchBinance(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('binance', symbol);
  const iv = INTERVALS.binance[interval] || '1h';
  const res = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${iv}&limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((k: any[]) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

async function fetchBybit(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('bybit', symbol);
  const iv = INTERVALS.bybit[interval] || '60';
  const res = await fetchWithTimeout(`https://api.bybit.nl/v5/market/kline?category=linear&symbol=${pair}&interval=${iv}&limit=${limit}`);
  if (!res.ok) return [];
  const json = await res.json();
  const list = json.result?.list || [];
  return list.reverse().map((k: string[]) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

async function fetchOKX(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('okx', symbol);
  const iv = INTERVALS.okx[interval] || '1H';
  const res = await fetchWithTimeout(`https://www.okx.com/api/v5/market/candles?instId=${pair}&bar=${iv}&limit=${limit}`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data || [];
  return data.reverse().map((k: string[]) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

async function fetchBitget(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('bitget', symbol);
  const iv = INTERVALS.bitget[interval] || '1h';
  const res = await fetchWithTimeout(`https://api.bitget.com/api/v2/mix/market/candles?productType=USDT-FUTURES&symbol=${pair}&granularity=${iv}&limit=${limit}`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data || [];
  return data.reverse().map((k: string[]) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}

async function fetchMEXC(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('mexc', symbol);
  const iv = INTERVALS.mexc[interval] || '1h';
  // MEXC futures use contract klines
  const res = await fetchWithTimeout(`https://contract.mexc.com/api/v1/contract/kline/${pair}?interval=${iv === '1h' ? 'Min60' : iv === '4h' ? 'Hour4' : 'Day1'}&limit=${limit}`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data?.time || [];
  const open = json.data?.open || [];
  const high = json.data?.high || [];
  const low = json.data?.low || [];
  const close = json.data?.close || [];
  const vol = json.data?.vol || [];
  return data.map((t: number, i: number) => ({ t: t * 1000, o: +open[i], h: +high[i], l: +low[i], c: +close[i], v: +vol[i] }));
}

async function fetchHTX(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('htx', symbol);
  const iv = INTERVALS.htx[interval] || '60min';
  const res = await fetchWithTimeout(`https://api.htx.com/market/history/kline?symbol=${pair}&period=${iv}&size=${limit}`);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data || [];
  return data.reverse().map((k: any) => ({ t: k.id * 1000, o: k.open, h: k.high, l: k.low, c: k.close, v: k.vol }));
}

async function fetchHyperliquid(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const s = normalizeSymbol('hyperliquid', symbol);
  const ivMs = interval === '1d' ? 86400000 : interval === '4h' ? 14400000 : 3600000;
  const endTime = Date.now();
  const startTime = endTime - ivMs * limit;
  const res2 = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'candleSnapshot', req: { coin: s, interval: interval === '1d' ? '1d' : interval === '4h' ? '4h' : '1h', startTime, endTime } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res2.ok) return [];
  const data = await res2.json();
  return (data || []).map((k: any) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }));
}

async function fetchDYDX(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('dydx', symbol);
  const iv = INTERVALS.dydx[interval] || '1HOUR';
  const res = await fetchWithTimeout(`https://indexer.dydx.trade/v4/candles/perpetualMarkets/${pair}?resolution=${iv}&limit=${limit}`);
  if (!res.ok) return [];
  const json = await res.json();
  const candles = json.candles || [];
  return candles.reverse().map((k: any) => ({
    t: new Date(k.startedAt).getTime(),
    o: +k.open, h: +k.high, l: +k.low, c: +k.close,
    v: +k.baseTokenVolume,
  }));
}

// ── Main handler ─────────────────────────────────────────────────────

async function fetchGate(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('gate', symbol);
  const iv = INTERVALS.gate[interval] || '1h';
  const res = await fetchWithTimeout(`https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${pair}&interval=${iv}&limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((k: any) => ({ t: k.t * 1000, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }));
}

async function fetchKraken(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = normalizeSymbol('kraken', symbol);
  const iv = INTERVALS.kraken[interval] || '60';
  const since = Math.floor((Date.now() - limit * (interval === '1d' ? 86400000 : interval === '4h' ? 14400000 : 3600000)) / 1000);
  const res = await fetchWithTimeout(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${iv}&since=${since}`);
  if (!res.ok) return [];
  const json = await res.json();
  const result = json.result || {};
  const key = Object.keys(result).find(k => k !== 'last');
  if (!key) return [];
  return result[key].map((k: any[]) => ({ t: k[0] * 1000, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[6] }));
}

const EXCHANGE_FETCHERS: Record<string, (s: string, iv: string, limit: number) => Promise<Candle[]>> = {
  Binance: fetchBinance,
  Bybit: fetchBybit,
  OKX: fetchOKX,
  Bitget: fetchBitget,
  MEXC: fetchMEXC,
  HTX: fetchHTX,
  Kraken: fetchKraken,
  'Gate.io': fetchGate,
  Hyperliquid: fetchHyperliquid,
  dYdX: fetchDYDX,
};

// In-memory cache (5 min TTL)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60_000;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const symbol = (sp.get('symbol') || 'BTC').toUpperCase();
  const interval = sp.get('interval') || '1h'; // '1h', '4h', '1d'
  const limitParam = Number(sp.get('limit')) || 0;
  const exchangeFilter = sp.get('exchanges')?.split(',') || [];

  // Compute limit based on interval
  const limit = limitParam || (interval === '1h' ? 168 : interval === '4h' ? 180 : 90);

  const cacheKey = `${symbol}-${interval}-${limit}-${exchangeFilter.sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' },
    });
  }

  // Determine which exchanges to fetch
  const exchanges = exchangeFilter.length > 0
    ? exchangeFilter.filter(e => EXCHANGE_FETCHERS[e])
    : Object.keys(EXCHANGE_FETCHERS);

  // Fetch all in parallel
  const results = await Promise.allSettled(
    exchanges.map(async (ex) => {
      try {
        const candles = await EXCHANGE_FETCHERS[ex](symbol, interval, limit);
        return { exchange: ex, candles };
      } catch {
        return { exchange: ex, candles: [] };
      }
    })
  );

  const exchangeData: Record<string, Candle[]> = {};
  let successCount = 0;

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.candles.length > 0) {
      exchangeData[r.value.exchange] = r.value.candles;
      successCount++;
    }
  }

  const response = {
    symbol,
    interval,
    limit,
    exchanges: exchangeData,
    meta: {
      requested: exchanges.length,
      success: successCount,
      timestamp: Date.now(),
    },
  };

  cache.set(cacheKey, { data: response, ts: Date.now() });

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' },
  });
}
