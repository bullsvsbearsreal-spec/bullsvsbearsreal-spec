export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

type Candle = { t: number; c: number };

async function f(url: string, ms = 8000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}

function sym(ex: string, s: string): string {
  const u = s.toUpperCase();
  const map: Record<string, string> = {
    binance: `${u}USDT`, bybit: `${u}USDT`, okx: `${u}-USDT-SWAP`,
    bitget: `${u}USDT`, mexc: `${u}_USDT`, htx: `${u.toLowerCase()}usdt`,
    hyperliquid: u, dydx: `${u}-USD`,
  };
  return map[ex] || `${u}USDT`;
}

const fetchers: Record<string, (s: string, iv: string, n: number) => Promise<Candle[]>> = {
  Binance: async (s, iv, n) => {
    const r = await f(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym('binance',s)}&interval=${iv}&limit=${n}`);
    if (!r.ok) return [];
    return (await r.json()).map((k: any[]) => ({ t: k[0], c: +k[4] })).filter((c: Candle) => c.c > 0);
  },
  Bybit: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '60', '4h': '240', '1d': 'D' };
    const r = await f(`https://api.bybit.nl/v5/market/kline?category=linear&symbol=${sym('bybit',s)}&interval=${m[iv]||'60'}&limit=${n}`);
    if (!r.ok) return [];
    const list = (await r.json()).result?.list || [];
    return list.reverse().map((k: string[]) => ({ t: +k[0], c: +k[4] })).filter((c: Candle) => c.c > 0);
  },
  OKX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1H', '4h': '4H', '1d': '1D' };
    const r = await f(`https://www.okx.com/api/v5/market/candles?instId=${sym('okx',s)}&bar=${m[iv]||'1H'}&limit=${n}`);
    if (!r.ok) return [];
    return (await r.json()).data?.reverse().map((k: string[]) => ({ t: +k[0], c: +k[4] })).filter((c: Candle) => c.c > 0) || [];
  },
  Bitget: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1H', '4h': '4H', '1d': '1D' };
    const r = await f(`https://api.bitget.com/api/v2/mix/market/candles?productType=USDT-FUTURES&symbol=${sym('bitget',s)}&granularity=${m[iv]||'1H'}&limit=${n}`);
    if (!r.ok) return [];
    return (await r.json()).data?.reverse().map((k: string[]) => ({ t: +k[0], c: +k[4] })).filter((c: Candle) => c.c > 0) || [];
  },
  MEXC: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': 'Min60', '4h': 'Hour4', '1d': 'Day1' };
    const r = await f(`https://contract.mexc.com/api/v1/contract/kline/${sym('mexc',s)}?interval=${m[iv]||'Min60'}&limit=${n}`);
    if (!r.ok) return [];
    const j = await r.json();
    const t = j.data?.time || [], c = j.data?.close || [];
    return t.map((ts: number, i: number) => ({ t: ts * 1000, c: +c[i] })).filter((x: Candle) => x.c > 0);
  },
  HTX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '60min', '4h': '4hour', '1d': '1day' };
    const r = await f(`https://api.htx.com/market/history/kline?symbol=${sym('htx',s)}&period=${m[iv]||'60min'}&size=${n}`);
    if (!r.ok) return [];
    return (await r.json()).data?.reverse().map((k: any) => ({ t: k.id * 1000, c: k.close })).filter((c: Candle) => c.c > 0) || [];
  },
  Hyperliquid: async (s, iv, n) => {
    const ms: Record<string,number> = { '1h': 3600000, '4h': 14400000, '1d': 86400000 };
    const end = Date.now(), start = end - (ms[iv]||3600000) * n;
    const r = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'candleSnapshot', req: { coin: s.toUpperCase(), interval: iv === '1d' ? '1d' : iv === '4h' ? '4h' : '1h', startTime: start, endTime: end } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    return (await r.json()).map((k: any) => ({ t: k.t, c: +k.c })).filter((c: Candle) => c.c > 0);
  },
  dYdX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1HOUR', '4h': '4HOURS', '1d': '1DAY' };
    const r = await f(`https://indexer.dydx.trade/v4/candles/perpetualMarkets/${s.toUpperCase()}-USD?resolution=${m[iv]||'1HOUR'}&limit=${n}`);
    if (!r.ok) return [];
    return (await r.json()).candles?.reverse().map((k: any) => ({ t: new Date(k.startedAt).getTime(), c: +k.close })).filter((c: Candle) => c.c > 0) || [];
  },
  Kraken: async (s, iv, n) => {
    const u = s.toUpperCase();
    const pair = u === 'BTC' ? 'PI_XBTUSD' : `PI_${u}USD`;
    const m: Record<string,string> = { '1h': '1h', '4h': '4h', '1d': '1d' };
    const r = await f(`https://futures.kraken.com/api/charts/v1/trade/${pair}/${m[iv]||'1h'}?from=${Math.floor((Date.now() - n * (iv === '1d' ? 86400000 : iv === '4h' ? 14400000 : 3600000)) / 1000)}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.candles || []).map((k: any) => ({ t: k.time * 1000, c: +k.close })).filter((c: Candle) => c.c > 0);
  },
  BingX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1h', '4h': '4h', '1d': '1d' };
    const r = await f(`https://open-api.bingx.com/openApi/swap/v3/quote/klines?symbol=${s.toUpperCase()}-USDT&interval=${m[iv]||'1h'}&limit=${n}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data || []).map((k: any) => ({ t: +k.time, c: +k.close })).filter((c: Candle) => c.c > 0);
  },
};

const cache = new Map<string, { data: any; ts: number }>();

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = (sp.get('symbol') || 'BTC').toUpperCase();
  const interval = sp.get('interval') || '1h';
  const limit = Number(sp.get('limit')) || (interval === '1h' ? 168 : interval === '4h' ? 180 : 90);
  const exFilter = sp.get('exchanges')?.split(',').filter(Boolean) || [];

  const key = `${symbol}-${interval}-${limit}-${exFilter.sort().join(',')}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < 300_000) {
    return NextResponse.json(cached.data, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } });
  }

  const exchanges = exFilter.length > 0 ? exFilter.filter(e => fetchers[e]) : Object.keys(fetchers);
  const results = await Promise.allSettled(
    exchanges.map(async ex => ({ exchange: ex, candles: await fetchers[ex](symbol, interval, limit).catch(() => [] as Candle[]) }))
  );

  const data: Record<string, Candle[]> = {};
  let ok = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.candles.length > 0) {
      data[r.value.exchange] = r.value.candles;
      ok++;
    }
  }

  const resp = { symbol, interval, limit, exchanges: data, meta: { requested: exchanges.length, success: ok, ts: Date.now() } };
  cache.set(key, { data: resp, ts: Date.now() });
  return NextResponse.json(resp, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } });
}
