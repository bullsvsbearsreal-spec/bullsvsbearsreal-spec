/**
 * GET /api/orderbook/multi?symbol=BTC&exchanges=Binance,Bybit,Hyperliquid
 *
 * Multi-exchange orderbook depth with slippage analysis.
 * Returns per-exchange depth at various USD order sizes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { walkBook, maxFillableUsd, computeCostFromWalk } from '@/lib/execution-costs/book-walker';
import type { RawBookData } from '@/lib/execution-costs/types';
import {
  fetchBinanceBook,
  fetchBybitBook,
  fetchOKXBook,
  fetchBitgetBook,
  fetchHyperliquidBook,
  fetchDydxBook,
  fetchDriftBook,
  fetchAsterBook,
  fetchAevoBook,
  fetchLighterBook,
} from '@/lib/execution-costs/venues';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Map exchange name (case-insensitive) → fetcher function
const EXCHANGE_FETCHERS: Record<string, (asset: string, fetchFn: typeof fetch) => Promise<RawBookData | null>> = {
  binance: fetchBinanceBook,
  bybit: fetchBybitBook,
  okx: fetchOKXBook,
  bitget: fetchBitgetBook,
  hyperliquid: fetchHyperliquidBook,
  dydx: fetchDydxBook,
  drift: fetchDriftBook,
  aster: fetchAsterBook,
  'aster dex': fetchAsterBook,
  aevo: fetchAevoBook,
  lighter: fetchLighterBook,
};

// L1 cache (5-second TTL for orderbooks)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5000;

// Default USD sizes for slippage analysis
const DEPTH_SIZES = [10_000, 50_000, 100_000, 500_000];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const exchangesParam = searchParams.get('exchanges') || 'Binance,Bybit';
  const requestedExchanges = exchangesParam.split(',').map(e => e.trim()).filter(Boolean);

  const cacheKey = `multi_ob_${symbol}_${requestedExchanges.sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
  }

  // Fetch all orderbooks in parallel
  const results = await Promise.all(
    requestedExchanges.map(async (exchange) => {
      const fetcher = EXCHANGE_FETCHERS[exchange.toLowerCase()];
      if (!fetcher) return { exchange, error: 'unsupported', book: null as RawBookData | null };
      try {
        const book = await fetcher(symbol, fetch);
        return { exchange, error: null, book };
      } catch (err: any) {
        return { exchange, error: err.message || 'fetch_failed', book: null as RawBookData | null };
      }
    }),
  );

  // Compute depth analysis per exchange
  const venues = results.map(({ exchange, error, book }) => {
    if (!book || error) {
      return {
        exchange,
        available: false,
        error: error || 'no_data',
        midPrice: 0,
        bidDepthUsd: 0,
        askDepthUsd: 0,
        slippage: {} as Record<number, { bid: number; ask: number }>,
      };
    }

    const bidDepthUsd = maxFillableUsd(book.bids);
    const askDepthUsd = maxFillableUsd(book.asks);

    // Compute slippage at each size
    const slippage: Record<number, { bid: number; ask: number }> = {};
    for (const size of DEPTH_SIZES) {
      const bidWalk = walkBook(book.bids, size, book.midPrice);
      const askWalk = walkBook(book.asks, size, book.midPrice);
      const bidCost = computeCostFromWalk(bidWalk, book.midPrice, book.bids[0]?.price);
      const askCost = computeCostFromWalk(askWalk, book.midPrice, book.asks[0]?.price);

      slippage[size] = {
        bid: Math.round((bidCost.spread + bidCost.priceImpact) * 10000) / 10000,
        ask: Math.round((askCost.spread + askCost.priceImpact) * 10000) / 10000,
      };
    }

    return {
      exchange: book.exchange,
      available: true,
      midPrice: book.midPrice,
      bidDepthUsd: Math.round(bidDepthUsd),
      askDepthUsd: Math.round(askDepthUsd),
      slippage,
    };
  });

  const body = {
    symbol,
    timestamp: Date.now(),
    depthSizes: DEPTH_SIZES,
    venues,
  };

  cache.set(cacheKey, { data: body, ts: Date.now() });

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=5' },
  });
}
