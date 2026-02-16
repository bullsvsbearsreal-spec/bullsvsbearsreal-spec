/**
 * GET /api/rsi
 *
 * RSI Heatmap — calculates RSI-14 for top 50 crypto symbols across
 * three timeframes (1h, 4h, 1d) using Binance kline data.
 *
 * Returns: { data: [{ symbol, rsi1h, rsi4h, rsi1d, price, change24h }], timestamp }
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// L1: In-memory cache (5-minute TTL — RSI changes frequently)
// ---------------------------------------------------------------------------
interface RsiEntry {
  symbol: string;
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
  price: number | null;
  change24h: number | null;
}

interface CachedRsi {
  data: RsiEntry[];
  timestamp: number;
}

let l1Cache: CachedRsi | null = null;
let l1CacheTime = 0;
const L1_TTL = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Top 50 symbols (hardcoded for performance)
// ---------------------------------------------------------------------------
const TOP_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT',
  'MATIC', 'UNI', 'ATOM', 'NEAR', 'APT', 'OP', 'ARB', 'SUI', 'SEI', 'TIA',
  'JUP', 'PEPE', 'WIF', 'BONK', 'FET', 'RNDR', 'INJ', 'STX', 'IMX', 'MKR',
  'AAVE', 'LDO', 'CRV', 'SNX', 'COMP', 'FIL', 'THETA', 'SAND', 'MANA', 'AXS',
  'GALA', 'ENJ', 'ILV', 'GMT', 'APE', 'BLUR', 'PYTH', 'JTO', 'W', 'STRK',
];

// ---------------------------------------------------------------------------
// RSI-14 calculation (standard Wilder's smoothing)
// ---------------------------------------------------------------------------
function calculateRSI(closes: number[]): number | null {
  if (closes.length < 15) return null; // need 14 periods of change = 15 prices

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // First average: simple average of first 14 periods
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < 14; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= 14;
  avgLoss /= 14;

  // Apply Wilder's smoothing for remaining periods
  for (let i = 14; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return parseFloat(rsi.toFixed(2));
}

// ---------------------------------------------------------------------------
// Fetch Binance klines for a single symbol + interval
// ---------------------------------------------------------------------------
async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number,
): Promise<number[]> {
  const pair = `${symbol}USDT`;
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data: unknown[][] = await res.json();
    // kline[4] = close price
    return data.map((k) => parseFloat(k[4] as string)).filter((v) => isFinite(v));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch 24h ticker for price + change
// ---------------------------------------------------------------------------
interface TickerInfo {
  price: number | null;
  change24h: number | null;
}

async function fetch24hTickers(): Promise<Map<string, TickerInfo>> {
  const map = new Map<string, TickerInfo>();
  try {
    const res = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr',
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return map;
    const tickers: { symbol: string; lastPrice: string; priceChangePercent: string }[] = await res.json();
    for (const t of tickers) {
      if (!t.symbol.endsWith('USDT')) continue;
      const base = t.symbol.replace('USDT', '');
      map.set(base, {
        price: parseFloat(t.lastPrice) || null,
        change24h: parseFloat(t.priceChangePercent) || null,
      });
    }
  } catch {
    // Swallow — we still return RSI data without price/change
  }
  return map;
}

// ---------------------------------------------------------------------------
// Fetch RSI data for a single symbol (all 3 timeframes in parallel)
// ---------------------------------------------------------------------------
async function fetchSymbolRSI(symbol: string): Promise<{
  rsi1h: number | null;
  rsi4h: number | null;
  rsi1d: number | null;
}> {
  const [closes1h, closes4h, closes1d] = await Promise.all([
    fetchKlines(symbol, '1h', 30),
    fetchKlines(symbol, '4h', 30),
    fetchKlines(symbol, '1d', 30),
  ]);

  return {
    rsi1h: calculateRSI(closes1h),
    rsi4h: calculateRSI(closes4h),
    rsi1d: calculateRSI(closes1d),
  };
}

// ---------------------------------------------------------------------------
// Process symbols in batches to avoid Binance rate limits
// ---------------------------------------------------------------------------
async function processInBatches<T>(
  items: string[],
  batchSize: number,
  fn: (item: string) => Promise<T>,
): Promise<Map<string, T>> {
  const results = new Map<string, T>();

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const result = await fn(item);
        return { item, result };
      }),
    );
    for (const { item, result } of batchResults) {
      results.set(item, result);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET() {
  // L1: Return cached data if fresh
  if (l1Cache && Date.now() - l1CacheTime < L1_TTL) {
    return NextResponse.json(l1Cache, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  }

  try {
    // Fetch 24h tickers and RSI data concurrently
    // Tickers are fetched once (single call), RSI is batched per-symbol
    const [tickerMap, rsiMap] = await Promise.all([
      fetch24hTickers(),
      processInBatches(TOP_SYMBOLS, 10, fetchSymbolRSI),
    ]);

    const data: RsiEntry[] = [];

    for (const symbol of TOP_SYMBOLS) {
      const rsi = rsiMap.get(symbol);
      const ticker = tickerMap.get(symbol);

      // Skip symbols where all RSI values failed (probably not on Binance)
      if (!rsi || (rsi.rsi1h === null && rsi.rsi4h === null && rsi.rsi1d === null)) {
        continue;
      }

      data.push({
        symbol,
        rsi1h: rsi.rsi1h,
        rsi4h: rsi.rsi4h,
        rsi1d: rsi.rsi1d,
        price: ticker?.price ?? null,
        change24h: ticker?.change24h ?? null,
      });
    }

    const response: CachedRsi = {
      data,
      timestamp: Date.now(),
    };

    // Update L1 cache
    l1Cache = response;
    l1CacheTime = Date.now();

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('RSI API error:', msg);

    // Return stale cache if available
    if (l1Cache) {
      return NextResponse.json(l1Cache, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=30' },
      });
    }

    return NextResponse.json(
      { error: msg, data: [], timestamp: Date.now() },
      { status: 500 },
    );
  }
}
