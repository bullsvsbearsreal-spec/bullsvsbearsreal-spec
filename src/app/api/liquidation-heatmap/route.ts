/**
 * GET /api/liquidation-heatmap?symbol=BTC&timeframe=4h
 *
 * Fetches real liquidation events from Binance + OKX public APIs,
 * accumulates them in a rolling 24h in-memory window, and returns
 * an aggregated heatmap grid plus summary statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LiquidationEvent {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  volume: number; // price * quantity (USD)
  time: number;   // unix ms
}

interface HeatmapCell {
  timeIdx: number;
  priceIdx: number;
  volume: number;
  count: number;
  dominantSide: 'long' | 'short';
}

interface LargestSingle {
  price: number;
  volume: number;
  side: 'long' | 'short';
  exchange: string;
  time: number;
}

interface RecentEvent {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  price: number;
  volume: number;
  time: number;
}

interface HeatmapResponse {
  symbol: string;
  currentPrice: number;
  timeframe: string;
  heatmap: {
    timeBuckets: number[];
    priceBuckets: number[];
    cells: HeatmapCell[];
  };
  summary: {
    totalLiquidations: number;
    totalVolume: number;
    longLiqVolume: number;
    shortLiqVolume: number;
    largestSingle: LargestSingle | null;
    recentEvents: RecentEvent[];
  };
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SUPPORTED_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;
type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

const SYMBOL_PAIR_MAP: Record<SupportedSymbol, { binance: string; okx: string }> = {
  BTC: { binance: 'BTCUSDT', okx: 'BTC-USDT-SWAP' },
  ETH: { binance: 'ETHUSDT', okx: 'ETH-USDT-SWAP' },
  SOL: { binance: 'SOLUSDT', okx: 'SOL-USDT-SWAP' },
};

// Price bucket size as a fraction of current price
const PRICE_BUCKET_FRACTION: Record<SupportedSymbol, number> = {
  BTC: 0.001,  // 0.1% of price (~$65 at $65k)
  ETH: 0.001,  // 0.1% of price (~$3.5 at $3500)
  SOL: 0.002,  // 0.2% of price (~$0.30 at $150)
};

const FIVE_MINUTES = 5 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

const MAX_EVENTS = 10_000;
const FETCH_TIMEOUT = 8_000;
const CACHE_TTL = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// In-memory stores (persist across requests within the same Edge isolate)
// ---------------------------------------------------------------------------

// Rolling 24h event store, keyed by symbol
const eventStore = new Map<string, LiquidationEvent[]>();

// L1 response cache keyed by "symbol:timeframe"
const responseCache = new Map<string, { body: HeatmapResponse; ts: number }>();

// Track which event IDs we've already stored to avoid duplicates
// Key format: "exchange:symbol:time:price:qty"
const seenEvents = new Map<string, Set<string>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventKey(e: LiquidationEvent): string {
  return `${e.exchange}:${e.time}:${e.price}:${e.quantity}`;
}

function pruneOldEvents(symbol: string): void {
  const events = eventStore.get(symbol);
  if (!events) return;

  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  const pruned = events.filter((e) => e.time >= cutoff);

  // If still over max, drop oldest
  if (pruned.length > MAX_EVENTS) {
    pruned.sort((a, b) => b.time - a.time);
    pruned.length = MAX_EVENTS;
  }

  eventStore.set(symbol, pruned);

  // Also prune seen-event keys for this symbol
  const seen = seenEvents.get(symbol);
  if (seen) {
    const activeKeys = new Set(pruned.map(makeEventKey));
    Array.from(seen).forEach((key) => {
      if (!activeKeys.has(key)) seen.delete(key);
    });
  }
}

function addEvents(symbol: string, newEvents: LiquidationEvent[]): number {
  if (!eventStore.has(symbol)) eventStore.set(symbol, []);
  if (!seenEvents.has(symbol)) seenEvents.set(symbol, new Set());

  const events = eventStore.get(symbol)!;
  const seen = seenEvents.get(symbol)!;
  let added = 0;

  for (const evt of newEvents) {
    const key = makeEventKey(evt);
    if (!seen.has(key)) {
      seen.add(key);
      events.push(evt);
      added++;
    }
  }

  pruneOldEvents(symbol);
  return added;
}

// ---------------------------------------------------------------------------
// Fetch current price
// ---------------------------------------------------------------------------
async function fetchCurrentPrice(symbol: SupportedSymbol): Promise<number> {
  const pair = SYMBOL_PAIR_MAP[symbol];
  const sources = [
    {
      url: `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${pair.binance}`,
      parse: (d: any) => parseFloat(d.price),
    },
    {
      url: `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pair.binance}`,
      parse: (d: any) => parseFloat(d?.result?.list?.[0]?.lastPrice),
    },
    {
      url: `https://www.okx.com/api/v5/market/ticker?instId=${pair.okx}`,
      parse: (d: any) => parseFloat(d?.data?.[0]?.last),
    },
  ];

  for (const src of sources) {
    try {
      const res = await fetchWithTimeout(src.url, {}, 5000);
      if (!res.ok) continue;
      const data = await res.json();
      const price = src.parse(data);
      if (price && isFinite(price) && price > 0) return price;
    } catch {
      // try next
    }
  }
  throw new Error(`All price sources failed for ${symbol}`);
}

// ---------------------------------------------------------------------------
// Fetch Binance liquidations
// ---------------------------------------------------------------------------
async function fetchBinanceLiquidations(symbol: SupportedSymbol): Promise<LiquidationEvent[]> {
  const pair = SYMBOL_PAIR_MAP[symbol].binance;
  const events: LiquidationEvent[] = [];

  try {
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${pair}&limit=100`,
      {},
      FETCH_TIMEOUT,
    );

    // Binance returns 451 from some IPs (geo-restriction)
    if (res.status === 451 || res.status === 403) {
      return events;
    }

    if (!res.ok) {
      console.error(`Binance liquidations returned ${res.status}`);
      return events;
    }

    const data: any[] = await res.json();

    for (const order of data) {
      const price = parseFloat(order.averagePrice || order.price);
      const qty = parseFloat(order.origQty);
      if (!price || !qty || !isFinite(price) || !isFinite(qty)) continue;

      // side=SELL means a long was liquidated (forced sell), side=BUY means a short was liquidated
      const side: 'long' | 'short' = order.side === 'SELL' ? 'long' : 'short';

      events.push({
        exchange: 'Binance',
        symbol: symbol,
        side,
        price,
        quantity: qty,
        volume: price * qty,
        time: order.time || Date.now(),
      });
    }
  } catch (err) {
    console.error('Binance liquidation fetch error:', err instanceof Error ? err.message : err);
  }

  return events;
}

// ---------------------------------------------------------------------------
// Fetch OKX liquidations
// ---------------------------------------------------------------------------
async function fetchOKXLiquidations(symbol: SupportedSymbol): Promise<LiquidationEvent[]> {
  const instId = SYMBOL_PAIR_MAP[symbol].okx;
  const events: LiquidationEvent[] = [];

  try {
    const res = await fetchWithTimeout(
      `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&instId=${instId}&state=filled&limit=100`,
      {},
      FETCH_TIMEOUT,
    );

    if (!res.ok) {
      console.error(`OKX liquidations returned ${res.status}`);
      return events;
    }

    const json = await res.json();
    const entries: any[] = json?.data || [];

    for (const entry of entries) {
      const details: any[] = entry.details || [];
      for (const d of details) {
        const price = parseFloat(d.bkPx || d.price || '0');
        const sz = parseFloat(d.sz || '0');
        if (!price || !sz || !isFinite(price) || !isFinite(sz)) continue;

        // OKX: side "buy" = short was liquidated (forced buy-back)
        //       side "sell" = long was liquidated (forced sell)
        const side: 'long' | 'short' = d.side === 'sell' ? 'long' : 'short';

        // OKX sz is in contracts; for USDT-margined swaps, 1 contract = varying face values
        // For BTC-USDT-SWAP: 1 contract = 0.01 BTC; ETH: 0.1 ETH; SOL: 1 SOL
        const contractMultiplier = getOKXContractMultiplier(symbol);
        const actualQty = sz * contractMultiplier;

        events.push({
          exchange: 'OKX',
          symbol: symbol,
          side,
          price,
          quantity: actualQty,
          volume: price * actualQty,
          time: parseInt(d.ts, 10) || Date.now(),
        });
      }
    }
  } catch (err) {
    console.error('OKX liquidation fetch error:', err instanceof Error ? err.message : err);
  }

  return events;
}

function getOKXContractMultiplier(symbol: SupportedSymbol): number {
  switch (symbol) {
    case 'BTC': return 0.01;
    case 'ETH': return 0.1;
    case 'SOL': return 1;
    default: return 1;
  }
}

// ---------------------------------------------------------------------------
// Heatmap aggregation
// ---------------------------------------------------------------------------
function buildHeatmap(
  events: LiquidationEvent[],
  currentPrice: number,
  symbol: SupportedSymbol,
  timeframe: '4h' | '24h',
): HeatmapResponse['heatmap'] {
  const now = Date.now();
  const bucketFraction = PRICE_BUCKET_FRACTION[symbol];
  const bucketSize = currentPrice * bucketFraction;

  // --- Time buckets ---
  // For 4h: 5-minute intervals (48 buckets)
  // For 24h: 5-min for first 4h (48 buckets) + 15-min for remaining 20h (80 buckets) = 128 total
  const timeBuckets: number[] = [];
  const timeBucketIntervals: number[] = [];

  if (timeframe === '4h') {
    const start = now - FOUR_HOURS;
    for (let t = start; t < now; t += FIVE_MINUTES) {
      timeBuckets.push(Math.floor(t));
      timeBucketIntervals.push(FIVE_MINUTES);
    }
  } else {
    // Last 4 hours: 5-minute intervals
    const recentStart = now - FOUR_HOURS;
    for (let t = recentStart; t < now; t += FIVE_MINUTES) {
      timeBuckets.push(Math.floor(t));
      timeBucketIntervals.push(FIVE_MINUTES);
    }
    // 4-24 hours ago: 15-minute intervals (prepend)
    const olderStart = now - TWENTY_FOUR_HOURS;
    const olderBuckets: number[] = [];
    const olderIntervals: number[] = [];
    for (let t = olderStart; t < recentStart; t += FIFTEEN_MINUTES) {
      olderBuckets.push(Math.floor(t));
      olderIntervals.push(FIFTEEN_MINUTES);
    }
    timeBuckets.unshift(...olderBuckets);
    timeBucketIntervals.unshift(...olderIntervals);
  }

  // --- Price buckets ---
  // Center around current price, extend +/- 5% for 4h, +/- 10% for 24h
  const range = timeframe === '4h' ? 0.05 : 0.10;
  const minPrice = currentPrice * (1 - range);
  const maxPrice = currentPrice * (1 + range);
  const priceBuckets: number[] = [];
  for (let p = minPrice; p <= maxPrice; p += bucketSize) {
    priceBuckets.push(Math.round(p * 100) / 100);
  }

  // --- Aggregate into cells ---
  // cellMap keyed by "timeIdx:priceIdx"
  const cellMap = new Map<string, { volume: number; count: number; longVol: number; shortVol: number }>();

  const cutoff = timeframe === '4h' ? now - FOUR_HOURS : now - TWENTY_FOUR_HOURS;

  for (const evt of events) {
    if (evt.time < cutoff) continue;

    // Find time bucket index
    let timeIdx = -1;
    for (let i = timeBuckets.length - 1; i >= 0; i--) {
      if (evt.time >= timeBuckets[i]) {
        // Verify it falls within this bucket's interval
        if (evt.time < timeBuckets[i] + timeBucketIntervals[i]) {
          timeIdx = i;
        } else if (i < timeBuckets.length - 1) {
          // Falls between buckets, assign to next one
          timeIdx = i + 1;
        } else {
          timeIdx = i; // last bucket captures overflow
        }
        break;
      }
    }
    if (timeIdx < 0) continue;

    // Find price bucket index
    const priceIdx = Math.round((evt.price - minPrice) / bucketSize);
    if (priceIdx < 0 || priceIdx >= priceBuckets.length) continue;

    const key = `${timeIdx}:${priceIdx}`;
    const existing = cellMap.get(key);
    if (existing) {
      existing.volume += evt.volume;
      existing.count += 1;
      if (evt.side === 'long') existing.longVol += evt.volume;
      else existing.shortVol += evt.volume;
    } else {
      cellMap.set(key, {
        volume: evt.volume,
        count: 1,
        longVol: evt.side === 'long' ? evt.volume : 0,
        shortVol: evt.side === 'short' ? evt.volume : 0,
      });
    }
  }

  // Convert cellMap to array
  const cells: HeatmapCell[] = [];
  for (const [key, val] of Array.from(cellMap.entries())) {
    const [tStr, pStr] = key.split(':');
    cells.push({
      timeIdx: parseInt(tStr, 10),
      priceIdx: parseInt(pStr, 10),
      volume: Math.round(val.volume),
      count: val.count,
      dominantSide: val.longVol >= val.shortVol ? 'long' : 'short',
    });
  }

  // Sort cells by volume descending for efficient rendering (heaviest first)
  cells.sort((a, b) => b.volume - a.volume);

  return {
    timeBuckets,
    priceBuckets,
    cells,
  };
}

// ---------------------------------------------------------------------------
// Build summary
// ---------------------------------------------------------------------------
function buildSummary(
  events: LiquidationEvent[],
  timeframe: '4h' | '24h',
): HeatmapResponse['summary'] {
  const now = Date.now();
  const cutoff = timeframe === '4h' ? now - FOUR_HOURS : now - TWENTY_FOUR_HOURS;
  const filtered = events.filter((e) => e.time >= cutoff);

  let totalVolume = 0;
  let longVol = 0;
  let shortVol = 0;
  let largest: LiquidationEvent | null = null;

  for (const evt of filtered) {
    totalVolume += evt.volume;
    if (evt.side === 'long') longVol += evt.volume;
    else shortVol += evt.volume;
    if (!largest || evt.volume > largest.volume) largest = evt;
  }

  // Recent events: sort by time desc, limit 50
  const sorted = [...filtered].sort((a, b) => b.time - a.time);
  const recentEvents: RecentEvent[] = sorted.slice(0, 50).map((e) => ({
    exchange: e.exchange,
    symbol: `${e.symbol}USDT`,
    side: e.side,
    price: e.price,
    volume: Math.round(e.volume),
    time: e.time,
  }));

  return {
    totalLiquidations: filtered.length,
    totalVolume: Math.round(totalVolume),
    longLiqVolume: Math.round(longVol),
    shortLiqVolume: Math.round(shortVol),
    largestSingle: largest
      ? {
          price: largest.price,
          volume: Math.round(largest.volume),
          side: largest.side,
          exchange: largest.exchange,
          time: largest.time,
        }
      : null,
    recentEvents,
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Parse symbol
  const rawSymbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const symbol: SupportedSymbol = SUPPORTED_SYMBOLS.includes(rawSymbol as SupportedSymbol)
    ? (rawSymbol as SupportedSymbol)
    : 'BTC';

  // Parse timeframe
  const rawTimeframe = searchParams.get('timeframe') || '4h';
  const timeframe: '4h' | '24h' = rawTimeframe === '24h' ? '24h' : '4h';

  // L1 cache check
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  }

  try {
    // Fetch price + liquidation data in parallel
    const [currentPrice, binanceEvents, okxEvents] = await Promise.all([
      fetchCurrentPrice(symbol),
      fetchBinanceLiquidations(symbol),
      fetchOKXLiquidations(symbol),
    ]);

    // Merge new events into rolling store
    const allNew = [...binanceEvents, ...okxEvents];
    addEvents(symbol, allNew);

    // Get all stored events for this symbol
    const storedEvents = eventStore.get(symbol) || [];

    // Build heatmap
    const heatmap = buildHeatmap(storedEvents, currentPrice, symbol, timeframe);

    // Build summary
    const summary = buildSummary(storedEvents, timeframe);

    const body: HeatmapResponse = {
      symbol,
      currentPrice,
      timeframe,
      heatmap,
      summary,
      timestamp: Date.now(),
    };

    // Update L1 cache
    responseCache.set(cacheKey, { body, ts: Date.now() });

    // Prune cache if it grows too large
    if (responseCache.size > 20) {
      const iter = responseCache.keys();
      for (let i = 0; i < 10; i++) {
        const k = iter.next().value;
        if (k) responseCache.delete(k);
      }
    }

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'X-Events-Stored': String(storedEvents.length),
        'X-Events-Added': String(allNew.length),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Liquidation heatmap API error:', msg);

    // Return stale cache if available
    if (cached) {
      return NextResponse.json(cached.body, {
        headers: {
          'X-Cache': 'STALE',
          'Cache-Control': 'public, s-maxage=10',
        },
      });
    }

    return NextResponse.json(
      {
        error: msg,
        symbol,
        currentPrice: 0,
        timeframe,
        heatmap: { timeBuckets: [], priceBuckets: [], cells: [] },
        summary: {
          totalLiquidations: 0,
          totalVolume: 0,
          longLiqVolume: 0,
          shortLiqVolume: 0,
          largestSingle: null,
          recentEvents: [],
        },
        timestamp: Date.now(),
      },
      { status: 502 },
    );
  }
}
