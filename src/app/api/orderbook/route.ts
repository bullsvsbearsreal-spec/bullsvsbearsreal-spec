/**
 * GET /api/orderbook?symbol=BTC&limit=25
 *
 * Aggregated order book depth with multi-source fallback (Binance → Bybit → OKX).
 * Returns bids, asks, and recent trades for depth visualization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';

// Cache: 5-second TTL (order book changes rapidly)
interface CachedOB {
  body: any;
  timestamp: number;
}
const l1Cache = new Map<string, CachedOB>();
const L1_TTL = 5 * 1000;

/* ─── Source fetchers ─────────────────────────────────────────────── */

interface RawOrderbook {
  bids: { price: number; quantity: number }[];
  asks: { price: number; quantity: number }[];
  trades: { price: number; quantity: number; quoteQty: number; isBuyerMaker: boolean; time: number }[];
  source: string;
}

async function fetchBinance(pair: string, limit: number): Promise<RawOrderbook> {
  const [depthRes, tradesRes] = await Promise.all([
    fetchWithTimeout(`https://fapi.binance.com/fapi/v1/depth?symbol=${pair}&limit=${limit}`, {}, 6000),
    fetchWithTimeout(`https://fapi.binance.com/fapi/v1/trades?symbol=${pair}&limit=50`, {}, 6000),
  ]);
  if (!depthRes.ok) throw new Error(`Binance ${depthRes.status}`);
  const depth = await depthRes.json();
  const trades = tradesRes.ok ? await tradesRes.json() : [];

  return {
    bids: (depth.bids || []).map(([p, q]: [string, string]) => ({ price: +p, quantity: +q })),
    asks: (depth.asks || []).map(([p, q]: [string, string]) => ({ price: +p, quantity: +q })),
    trades: (trades as Array<{ price: string; qty: string; quoteQty: string; isBuyerMaker: boolean; time: number }>).slice(-30).map((t) => ({
      price: +t.price,
      quantity: +t.qty,
      quoteQty: +t.quoteQty,
      isBuyerMaker: t.isBuyerMaker,
      time: t.time,
    })),
    source: 'Binance',
  };
}

async function fetchBybit(pair: string, limit: number): Promise<RawOrderbook> {
  const [depthRes, tradesRes] = await Promise.all([
    fetchWithTimeout(`https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${pair}&limit=${limit}`, {}, 6000),
    fetchWithTimeout(`https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=${pair}&limit=50`, {}, 6000),
  ]);
  if (!depthRes.ok) throw new Error(`Bybit ${depthRes.status}`);
  const depthJson = await depthRes.json();
  if (depthJson.retCode !== 0) throw new Error(`Bybit retCode ${depthJson.retCode}`);
  const depthData = depthJson.result || {};
  const tradesJson = tradesRes.ok ? await tradesRes.json() : { result: { list: [] } };
  const tradeList = tradesJson?.result?.list || [];

  return {
    bids: (depthData.b || []).map(([p, q]: [string, string]) => ({ price: +p, quantity: +q })),
    asks: (depthData.a || []).map(([p, q]: [string, string]) => ({ price: +p, quantity: +q })),
    trades: tradeList.slice(-30).map((t: any) => ({
      price: +t.price,
      quantity: +t.size,
      quoteQty: +t.price * +t.size,
      isBuyerMaker: t.side === 'Sell', // Bybit: side=Sell means taker sold (buyer is maker)
      time: +t.time,
    })),
    source: 'Bybit',
  };
}

async function fetchOKX(symbol: string, limit: number): Promise<RawOrderbook> {
  const instId = `${symbol}-USDT-SWAP`;
  const [depthRes, tradesRes] = await Promise.all([
    fetchWithTimeout(`https://www.okx.com/api/v5/market/books?instId=${instId}&sz=${limit}`, {}, 6000),
    fetchWithTimeout(`https://www.okx.com/api/v5/market/trades?instId=${instId}&limit=50`, {}, 6000),
  ]);
  if (!depthRes.ok) throw new Error(`OKX ${depthRes.status}`);
  const depthJson = await depthRes.json();
  const bookData = depthJson?.data?.[0] || {};
  const tradesJson = tradesRes.ok ? await tradesRes.json() : { data: [] };
  const tradeList = tradesJson?.data || [];

  return {
    // OKX format: [price, qty, deprecatedField, numOrders]
    bids: (bookData.bids || []).map((b: string[]) => ({ price: +b[0], quantity: +b[1] })),
    asks: (bookData.asks || []).map((a: string[]) => ({ price: +a[0], quantity: +a[1] })),
    trades: tradeList.slice(-30).map((t: any) => ({
      price: +t.px,
      quantity: +t.sz,
      quoteQty: +t.px * +t.sz,
      isBuyerMaker: t.side === 'sell',
      time: +t.ts,
    })),
    source: 'OKX',
  };
}

/* ─── Main handler ────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50);
  const pair = `${symbol}USDT`;

  // L1 cache
  const cacheKey = `ob_${pair}_${limit}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < L1_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  // Try sources in order: Binance → Bybit → OKX
  let raw: RawOrderbook | null = null;
  const errors: string[] = [];

  for (const fetcher of [
    () => fetchBinance(pair, limit),
    () => fetchBybit(pair, limit),
    () => fetchOKX(symbol, limit),
  ]) {
    try {
      raw = await fetcher();
      if (raw.bids.length > 0 || raw.asks.length > 0) break;
      errors.push(`${raw.source}: empty orderbook`);
      raw = null;
    } catch (err: any) {
      errors.push(err.message || 'Unknown error');
    }
  }

  if (!raw) {
    return NextResponse.json(
      { error: 'All orderbook sources failed', details: errors },
      { status: 502 },
    );
  }

  // Add total (price*qty) to each level
  const bids = raw.bids.map((b) => ({ ...b, total: b.price * b.quantity }));
  const asks = raw.asks.map((a) => ({ ...a, total: a.price * a.quantity }));

  // Cumulative depth
  let cumBid = 0;
  const cumulativeBids = bids.map((b) => {
    cumBid += b.total;
    return { ...b, cumulative: cumBid };
  });

  let cumAsk = 0;
  const cumulativeAsks = asks.map((a) => {
    cumAsk += a.total;
    return { ...a, cumulative: cumAsk };
  });

  // Buy/sell volume ratio from recent trades
  const buyVol = raw.trades.filter((t) => !t.isBuyerMaker).reduce((s, t) => s + t.quoteQty, 0);
  const sellVol = raw.trades.filter((t) => t.isBuyerMaker).reduce((s, t) => s + t.quoteQty, 0);
  const totalTradeVol = buyVol + sellVol;

  const body = {
    symbol,
    pair,
    bids: cumulativeBids,
    asks: cumulativeAsks,
    trades: [...raw.trades].reverse(), // newest first
    spread: asks.length > 0 && bids.length > 0 ? asks[0].price - bids[0].price : 0,
    midPrice: asks.length > 0 && bids.length > 0 ? (asks[0].price + bids[0].price) / 2 : 0,
    bidDepth: cumBid,
    askDepth: cumAsk,
    buyVolume: buyVol,
    sellVolume: sellVol,
    buySellRatio: totalTradeVol > 0 ? buyVol / totalTradeVol : 0.5,
    timestamp: Date.now(),
    source: raw.source,
  };

  l1Cache.set(cacheKey, { body, timestamp: Date.now() });

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=5' },
  });
}
