export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

type Candle = { t: number; o: number; h: number; l: number; c: number };

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
    return (await r.json()).map((k: any[]) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  Bybit: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '60', '4h': '240', '1d': 'D' };
    const r = await f(`https://api.bybit.nl/v5/market/kline?category=linear&symbol=${sym('bybit',s)}&interval=${m[iv]||'60'}&limit=${n}`);
    if (!r.ok) return [];
    const list = (await r.json()).result?.list || [];
    return list.reverse().map((k: string[]) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  OKX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1H', '4h': '4H', '1d': '1D' };
    const r = await f(`https://www.okx.com/api/v5/market/candles?instId=${sym('okx',s)}&bar=${m[iv]||'1H'}&limit=${n}`);
    if (!r.ok) return [];
    return (await r.json()).data?.reverse().map((k: string[]) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).filter((c: Candle) => c.c > 0 && c.o > 0) || [];
  },
  Bitget: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1H', '4h': '4H', '1d': '1D' };
    const r = await f(`https://api.bitget.com/api/v2/mix/market/candles?productType=USDT-FUTURES&symbol=${sym('bitget',s)}&granularity=${m[iv]||'1H'}&limit=${n}`);
    if (!r.ok) return [];
    return (await r.json()).data?.reverse().map((k: string[]) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).filter((c: Candle) => c.c > 0 && c.o > 0) || [];
  },
  MEXC: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': 'Min60', '4h': 'Hour4', '1d': 'Day1' };
    const r = await f(`https://contract.mexc.com/api/v1/contract/kline/${sym('mexc',s)}?interval=${m[iv]||'Min60'}&limit=${n}`);
    if (!r.ok) return [];
    const j = await r.json();
    const ti = j.data?.time || [], op = j.data?.open || [], hi = j.data?.high || [], lo = j.data?.low || [], cl = j.data?.close || [];
    return ti.map((ts: number, i: number) => ({ t: ts * 1000, o: +op[i], h: +hi[i], l: +lo[i], c: +cl[i] })).filter((x: Candle) => x.c > 0 && x.o > 0);
  },
  HTX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '60min', '4h': '4hour', '1d': '1day' };
    const r = await f(`https://api.htx.com/market/history/kline?symbol=${sym('htx',s)}&period=${m[iv]||'60min'}&size=${n}`);
    if (!r.ok) return [];
    return (await r.json()).data?.reverse().map((k: any) => ({ t: k.id * 1000, o: k.open, h: k.high, l: k.low, c: k.close })).filter((c: Candle) => c.c > 0 && c.o > 0) || [];
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
    return (await r.json()).map((k: any) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  dYdX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1HOUR', '4h': '4HOURS', '1d': '1DAY' };
    const r = await f(`https://indexer.dydx.trade/v4/candles/perpetualMarkets/${s.toUpperCase()}-USD?resolution=${m[iv]||'1HOUR'}&limit=${n}`);
    if (!r.ok) return [];
    return (await r.json()).candles?.reverse().map((k: any) => ({ t: new Date(k.startedAt).getTime(), o: +k.open, h: +k.high, l: +k.low, c: +k.close })).filter((c: Candle) => c.c > 0 && c.o > 0) || [];
  },
  Kraken: async (s, iv, n) => {
    const u = s.toUpperCase();
    // Kraken futures only reliably supports major coins
    const krakenMap: Record<string,string> = { BTC: 'PI_XBTUSD', ETH: 'PI_ETHUSD', SOL: 'PI_SOLUSD', XRP: 'PI_XRPUSD', ADA: 'PI_ADAUSD', DOT: 'PI_DOTUSD', LINK: 'PI_LINKUSD', AVAX: 'PI_AVAXUSD' };
    const pair = krakenMap[u];
    if (!pair) return [];
    const m: Record<string,string> = { '1h': '1h', '4h': '4h', '1d': '1d' };
    const r = await f(`https://futures.kraken.com/api/charts/v1/trade/${pair}/${m[iv]||'1h'}?from=${Math.floor((Date.now() - n * (iv === '1d' ? 86400000 : iv === '4h' ? 14400000 : 3600000)) / 1000)}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.candles || []).map((k: any) => ({ t: k.time * 1000, o: +k.open, h: +k.high, l: +k.low, c: +k.close })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  BingX: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1h', '4h': '4h', '1d': '1d' };
    const r = await f(`https://open-api.bingx.com/openApi/swap/v3/quote/klines?symbol=${s.toUpperCase()}-USDT&interval=${m[iv]||'1h'}&limit=${n}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data || []).map((k: any) => ({ t: +k.time, o: +k.open, h: +k.high, l: +k.low, c: +k.close })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  Phemex: async (s, iv, n) => {
    const u = s.toUpperCase();
    const m: Record<string,number> = { '1h': 3600, '4h': 14400, '1d': 86400 };
    const r = await f(`https://api.phemex.com/exchange/public/md/v2/kline?symbol=${u}USDT&resolution=${m[iv]||3600}&limit=${n}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data?.rows || []).map((k: any) => ({ t: k[0] * 1000, o: k[1]/1e4, h: k[2]/1e4, l: k[3]/1e4, c: k[4]/1e4 })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  KuCoin: async (s, iv, n) => {
    const u = s.toUpperCase();
    const pair = u === 'BTC' ? 'XBTUSDTM' : u + 'USDTM';
    const m: Record<string,number> = { '1h': 60, '4h': 240, '1d': 1440 };
    const from = Math.floor((Date.now() - n * (iv === '1d' ? 86400000 : iv === '4h' ? 14400000 : 3600000)) / 1000);
    const r = await f(`https://api-futures.kucoin.com/api/v1/kline/query?symbol=${pair}&granularity=${m[iv]||60}&from=${from}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data || []).map((k: number[]) => ({ t: k[0] * 1000, o: k[1], h: k[2], l: k[3], c: k[4] })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  // Bitfinex disabled: perp pair format tBTCF0:USTF0 returns wrong prices ($11.5K for BTC)
  // Bitfinex: async () => [],
  CoinEx: async (s, iv, n) => {
    const m: Record<string,string> = { '1h': '1hour', '4h': '4hour', '1d': '1day' };
    const r = await f(`https://api.coinex.com/v2/futures/kline?market=${s.toUpperCase()}USDT&type=${m[iv]||'1hour'}&limit=${n}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data || []).map((k: any) => ({ t: k.created_at * 1000, o: +k.open, h: +k.high, l: +k.low, c: +k.close })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  Deribit: async (s, iv, n) => {
    const u = s.toUpperCase();
    if (u !== 'BTC' && u !== 'ETH' && u !== 'SOL') return []; // Deribit only has BTC/ETH/SOL perps
    const m: Record<string,string> = { '1h': '60', '4h': '240', '1d': '1D' };
    const end = Date.now();
    const start = end - n * (iv === '1d' ? 86400000 : iv === '4h' ? 14400000 : 3600000);
    const r = await f(`https://www.deribit.com/api/v2/public/get_tradingview_chart_data?instrument_name=${u}-PERPETUAL&resolution=${m[iv]||'60'}&start_timestamp=${start}&end_timestamp=${end}`);
    if (!r.ok) return [];
    const j = await r.json();
    const d = j.result;
    if (!d || !d.ticks) return [];
    return d.ticks.map((t: number, i: number) => ({ t, o: d.open[i], h: d.high[i], l: d.low[i], c: d.close[i] })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  Coinbase: async (s, iv, n) => {
    const u = s.toUpperCase();
    const m: Record<string,number> = { '1h': 3600, '4h': 14400, '1d': 86400 };
    const end = Math.floor(Date.now() / 1000);
    const start = end - n * (m[iv] || 3600);
    const r = await f(`https://api.exchange.coinbase.com/products/${u}-USD/candles?granularity=${m[iv]||3600}&start=${start}&end=${end}`);
    if (!r.ok) return [];
    const j = await r.json();
    // Coinbase: [time, low, high, open, close, volume]
    return (j || []).reverse().map((k: number[]) => ({ t: k[0] * 1000, o: k[3], h: k[2], l: k[1], c: k[4] })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  WhiteBIT: async (s, iv, n) => {
    const u = s.toUpperCase();
    const m: Record<string,string> = { '1h': '1h', '4h': '4h', '1d': '1d' };
    const start = Math.floor((Date.now() - n * (iv === '1d' ? 86400000 : iv === '4h' ? 14400000 : 3600000)) / 1000);
    const r = await f(`https://whitebit.com/api/v4/public/kline?market=${u}_PERP&interval=${m[iv]||'1h'}&start=${start}&limit=${n}`);
    if (!r.ok) return [];
    const j = await r.json();
    // WhiteBIT: [time, open, close, high, low, volume]
    return (j || []).map((k: any[]) => ({ t: k[0] * 1000, o: +k[1], h: +k[3], l: +k[4], c: +k[2] })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  Aevo: async (s, iv, n) => {
    const u = s.toUpperCase();
    const m: Record<string,string> = { '1h': '3600', '4h': '14400', '1d': '86400' };
    const end = Math.floor(Date.now() / 1e9);
    const start = end - n * (+m[iv] || 3600);
    const r = await f(`https://api.aevo.xyz/klines?instrument_name=${u}-PERP&resolution=${m[iv]||'3600'}&start_time=${start}&end_time=${end}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j || []).map((k: any) => ({ t: +k.time * 1000, o: +k.open, h: +k.high, l: +k.low, c: +k.close })).filter((c: Candle) => c.c > 0 && c.o > 0);
  },
  Drift: async (s, iv, n) => {
    // Drift doesn't have a public klines API - use mark price from stats
    return [];
  },
  GMX: async (s, iv, n) => {
    // GMX is AMM-based, no traditional klines
    return [];
  },
  gTrade: async (s, iv, n) => {
    // gTrade uses oracle prices, no klines API
    return [];
  },
  Aster: async (s, iv, n) => {
    // Aster: no public klines endpoint known
    return [];
  },
  Lighter: async (s, iv, n) => {
    // Lighter: no public klines endpoint known
    return [];
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

  const rawData: Record<string, Candle[]> = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.candles.length > 0) {
      rawData[r.value.exchange] = r.value.candles;
    }
  }

  // Outlier filtering: exclude exchanges whose last close is >3% from median
  const lastPrices = Object.entries(rawData).map(([ex, candles]) => ({
    ex, price: candles[candles.length - 1]?.c || 0,
  })).filter(x => x.price > 0).sort((a, b) => a.price - b.price);

  const data: Record<string, Candle[]> = {};
  let ok = 0;
  if (lastPrices.length >= 3) {
    const medIdx = Math.floor(lastPrices.length / 2);
    const median = lastPrices[medIdx].price;
    for (const { ex, price } of lastPrices) {
      const dev = Math.abs(price - median) / median;
      if (dev < 0.03) { // within 3% of median
        data[ex] = rawData[ex];
        ok++;
      }
      // else: silently excluded as outlier
    }
  } else {
    // Too few exchanges to filter, include all
    for (const [ex, candles] of Object.entries(rawData)) {
      data[ex] = candles;
      ok++;
    }
  }

  const resp = { symbol, interval, limit, exchanges: data, meta: { requested: exchanges.length, success: ok, ts: Date.now() } };
  cache.set(key, { data: resp, ts: Date.now() });
  return NextResponse.json(resp, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } });
}
