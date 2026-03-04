import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const VALID_PERIODS = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];
const VALID_SOURCES = ['global', 'topTraders', 'taker'];
const VALID_EXCHANGES = ['binance', 'okx'];

// L1 in-memory cache (60s TTL)
const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 60_000;

function mapPeriodToOKX(period: string): string {
  if (period === '5m') return '5m';
  if (['15m', '30m', '1h', '2h'].includes(period)) return '1H';
  return '1D'; // 4h, 6h, 12h, 1d
}

// Binance fapi domains — .com is geo-blocked from Dubai/Vercel dxb1, try .me fallback
const BINANCE_FAPI_BASES = [
  'https://fapi.binance.com',
  'https://fapi.binance.me',
];

// Helper: try Binance endpoint across both domains, return first valid JSON array
async function binanceFetch(path: string): Promise<any[] | null> {
  for (const base of BINANCE_FAPI_BASES) {
    try {
      const res = await fetchWithTimeout(`${base}${path}`);
      if (!res.ok) continue;
      const data = await res.json();
      // Binance geo-block returns 200 OK with {code:0, msg:"..."} — not an array
      if (!Array.isArray(data) || data.length === 0) continue;
      return data;
    } catch { continue; }
  }
  return null;
}

// --- Binance fetchers ---

async function fetchBinanceGlobalLS(symbol: string, period: string, limit: number) {
  const data = await binanceFetch(
    `/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=${limit}`
  );
  if (!data) return null;
  return data.map((d: any) => ({
    longRatio: parseFloat(d.longAccount) * 100,
    shortRatio: parseFloat(d.shortAccount) * 100,
    longShortRatio: parseFloat(d.longShortRatio),
    timestamp: d.timestamp,
  }));
}

async function fetchBinanceTopTraderLS(symbol: string, period: string, limit: number) {
  const data = await binanceFetch(
    `/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=${limit}`
  );
  if (!data) return null;
  return data.map((d: any) => ({
    longRatio: parseFloat(d.longAccount) * 100,
    shortRatio: parseFloat(d.shortAccount) * 100,
    longShortRatio: parseFloat(d.longShortRatio),
    timestamp: d.timestamp,
  }));
}

async function fetchBinanceTakerRatio(symbol: string, period: string, limit: number) {
  const data = await binanceFetch(
    `/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=${limit}`
  );
  if (!data) return null;
  return data.map((d: any) => ({
    buySellRatio: parseFloat(d.buySellRatio),
    buyVol: parseFloat(d.buyVol),
    sellVol: parseFloat(d.sellVol),
    timestamp: d.timestamp,
  }));
}

// --- OKX fetchers ---

async function fetchOKXLongShortRatio(symbol: string, period: string) {
  const okxPeriod = mapPeriodToOKX(period);
  // OKX rubik API uses `ccy` (currency) parameter, not `instId`
  const res = await fetchWithTimeout(
    `https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${symbol}&period=${okxPeriod}`
  );
  if (!res.ok) return null;
  const json = await res.json();
  const rows: any[] = json?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Each row is [timestamp, longShortRatio]
  return rows.map((r: any) => {
    const ratio = parseFloat(r[1]);
    const longRatio = (ratio / (1 + ratio)) * 100;
    const shortRatio = (1 / (1 + ratio)) * 100;
    return {
      longRatio,
      shortRatio,
      longShortRatio: ratio,
      timestamp: parseInt(r[0], 10),
    };
  });
}

async function fetchOKXTakerVolume(symbol: string, period: string) {
  const okxPeriod = mapPeriodToOKX(period);
  const res = await fetchWithTimeout(
    `https://www.okx.com/api/v5/rubik/stat/taker-volume?ccy=${symbol}&instType=CONTRACTS&period=${okxPeriod}`
  );
  if (!res.ok) return null;
  const json = await res.json();
  const rows: any[] = json?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Each row is [timestamp, sellVol, buyVol]
  return rows.map((r: any) => {
    const sellVol = parseFloat(r[1]);
    const buyVol = parseFloat(r[2]);
    return {
      buySellRatio: sellVol > 0 ? buyVol / sellVol : 1,
      buyVol,
      sellVol,
      timestamp: parseInt(r[0], 10),
    };
  });
}

// --- Main handler ---

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const period = VALID_PERIODS.includes(searchParams.get('period') || '')
    ? searchParams.get('period')!
    : '5m';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '1', 10), 1), 500);
  const source = VALID_SOURCES.includes(searchParams.get('source') || '')
    ? searchParams.get('source')!
    : 'global';
  const exchange = VALID_EXCHANGES.includes(searchParams.get('exchange')?.toLowerCase() || '')
    ? searchParams.get('exchange')!.toLowerCase()
    : 'binance';

  // Validate combos
  if (exchange === 'okx' && source === 'topTraders') {
    return NextResponse.json(
      { error: 'OKX does not support topTraders source. Use: global, taker' },
      { status: 400 }
    );
  }

  // Cache check
  const cacheKey = `${exchange}_${source}_${symbol}_${period}_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  try {
    // Extract bare symbol for OKX (BTC from BTCUSDT)
    const bareSymbol = symbol.replace(/USDT$/i, '').replace(/-USDT-SWAP$/i, '');

    let points: any[] | null = null;
    let resolvedExchange = exchange;

    if (exchange === 'binance') {
      if (source === 'global') points = await fetchBinanceGlobalLS(symbol, period, limit);
      else if (source === 'topTraders') points = await fetchBinanceTopTraderLS(symbol, period, limit);
      else if (source === 'taker') points = await fetchBinanceTakerRatio(symbol, period, limit);

      // Cascade: if Binance failed (geo-blocked), try OKX as fallback
      if (!points || points.length === 0) {
        console.log(`[longshort] Binance failed for ${symbol}, trying OKX fallback`);
        if (source === 'global' || source === 'topTraders') {
          points = await fetchOKXLongShortRatio(bareSymbol, period);
        } else if (source === 'taker') {
          points = await fetchOKXTakerVolume(bareSymbol, period);
        }
        if (points && points.length > 0) resolvedExchange = 'okx';
      }
    } else if (exchange === 'okx') {
      if (source === 'global') points = await fetchOKXLongShortRatio(bareSymbol, period);
      else if (source === 'taker') points = await fetchOKXTakerVolume(bareSymbol, period);

      // Cascade: if OKX failed, try Binance as fallback
      if (!points || points.length === 0) {
        console.log(`[longshort] OKX failed for ${symbol}, trying Binance fallback`);
        if (source === 'global') {
          points = await fetchBinanceGlobalLS(symbol, period, limit);
        } else if (source === 'taker') {
          points = await fetchBinanceTakerRatio(symbol, period, limit);
        }
        if (points && points.length > 0) resolvedExchange = 'binance';
      }
    }

    if (!points || points.length === 0) {
      // Both exchanges failed — return fallback with flag
      if (source === 'global') {
        return NextResponse.json({ longRatio: 50, shortRatio: 50, symbol, fallback: true });
      }
      return NextResponse.json({ symbol, exchange, source, period, points: [], fallback: true });
    }

    // Build response
    let body: any;

    // Backward compat: source=global + limit=1 → flat response
    if (source === 'global' && limit === 1) {
      const latest = points[0];
      body = {
        longRatio: latest.longRatio,
        shortRatio: latest.shortRatio,
        symbol,
        exchange: resolvedExchange,
        timestamp: latest.timestamp,
      };
    } else {
      body = { symbol, exchange: resolvedExchange, source, period, points };
    }

    // Cache store (evict if too large)
    cache.set(cacheKey, { body, ts: Date.now() });
    if (cache.size > 200) {
      const keys = Array.from(cache.keys()).slice(0, 50);
      for (const k of keys) cache.delete(k);
    }

    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Long/Short ratio error:', error);

    // Serve stale cache on error
    if (cached) {
      return NextResponse.json(cached.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=10' },
      });
    }

    if (source === 'global') {
      return NextResponse.json({ longRatio: 50, shortRatio: 50, symbol, fallback: true });
    }
    return NextResponse.json(
      { error: 'Failed to fetch data', symbol, exchange, source },
      { status: 502 }
    );
  }
}
