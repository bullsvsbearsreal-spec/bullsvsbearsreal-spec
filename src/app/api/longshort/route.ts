import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
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

// --- Binance fetchers ---

async function fetchBinanceGlobalLS(symbol: string, period: string, limit: number) {
  const res = await fetchWithTimeout(
    `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=${limit}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data.map((d: any) => ({
    longRatio: parseFloat(d.longAccount) * 100,
    shortRatio: parseFloat(d.shortAccount) * 100,
    longShortRatio: parseFloat(d.longShortRatio),
    timestamp: d.timestamp,
  }));
}

async function fetchBinanceTopTraderLS(symbol: string, period: string, limit: number) {
  const res = await fetchWithTimeout(
    `https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=${limit}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data.map((d: any) => ({
    longRatio: parseFloat(d.longAccount) * 100,
    shortRatio: parseFloat(d.shortAccount) * 100,
    longShortRatio: parseFloat(d.longShortRatio),
    timestamp: d.timestamp,
  }));
}

async function fetchBinanceTakerRatio(symbol: string, period: string, limit: number) {
  const res = await fetchWithTimeout(
    `https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=${limit}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data.map((d: any) => ({
    buySellRatio: parseFloat(d.buySellRatio),
    buyVol: parseFloat(d.buyVol),
    sellVol: parseFloat(d.sellVol),
    timestamp: d.timestamp,
  }));
}

// --- OKX fetchers ---

async function fetchOKXLongShortRatio(symbol: string, period: string) {
  const instId = `${symbol}-USDT-SWAP`;
  const okxPeriod = mapPeriodToOKX(period);
  const res = await fetchWithTimeout(
    `https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?instId=${instId}&period=${okxPeriod}`
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
    // For OKX, extract bare symbol from BTCUSDT format
    const bareSymbol = exchange === 'okx'
      ? symbol.replace(/USDT$/i, '').replace(/-USDT-SWAP$/i, '')
      : symbol;

    let points: any[] | null = null;

    if (exchange === 'binance') {
      if (source === 'global') points = await fetchBinanceGlobalLS(symbol, period, limit);
      else if (source === 'topTraders') points = await fetchBinanceTopTraderLS(symbol, period, limit);
      else if (source === 'taker') points = await fetchBinanceTakerRatio(symbol, period, limit);
    } else if (exchange === 'okx') {
      if (source === 'global') points = await fetchOKXLongShortRatio(bareSymbol, period);
      else if (source === 'taker') points = await fetchOKXTakerVolume(bareSymbol, period);
    }

    if (!points || points.length === 0) {
      // Fallback for backward compat
      if (source === 'global') {
        return NextResponse.json({ longRatio: 50, shortRatio: 50, symbol });
      }
      return NextResponse.json({ symbol, exchange, source, period, points: [] });
    }

    // Build response
    let body: any;

    // Backward compat: default params + limit=1 → flat response
    if (source === 'global' && exchange === 'binance' && limit === 1) {
      const latest = points[0];
      body = {
        longRatio: latest.longRatio,
        shortRatio: latest.shortRatio,
        symbol,
        timestamp: latest.timestamp,
      };
    } else {
      body = { symbol, exchange, source, period, points };
    }

    // Cache store (evict if too large)
    cache.set(cacheKey, { body, ts: Date.now() });
    if (cache.size > 200) {
      const iter = cache.keys();
      for (let i = 0; i < 50; i++) {
        const k = iter.next().value;
        if (k) cache.delete(k);
      }
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
      return NextResponse.json({ longRatio: 50, shortRatio: 50, symbol });
    }
    return NextResponse.json(
      { error: 'Failed to fetch data', symbol, exchange, source },
      { status: 502 }
    );
  }
}
