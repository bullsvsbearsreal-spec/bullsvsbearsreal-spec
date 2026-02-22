import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { fundingFetchers } from './exchanges';
import { classifySymbol, KNOWN_STOCKS, KNOWN_COMMODITIES, KNOWN_FOREX, FOREX_BASES } from './normalize';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ---------------------------------------------------------------------------
// L1: In-memory cache (2-minute TTL — funding rates don't change that often)
// ---------------------------------------------------------------------------
interface CachedFunding {
  body: any;
  timestamp: number;
}

const l1Cache = new Map<string, CachedFunding>();
const L1_TTL = 2 * 60 * 1000; // 2 minutes

type AssetClassFilter = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'all';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const assetClass = (searchParams.get('assetClass') || 'crypto') as AssetClassFilter;

  // L1: Return cached data if fresh
  const cacheKey = `funding_${assetClass}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  let data: any[], health: any[], top500: Set<string>;
  try {
    const [exchangeResult, top500Result] = await Promise.all([
      fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout),
      getTop500Symbols(),
    ]);
    data = exchangeResult.data;
    health = exchangeResult.health;
    top500 = top500Result;
  } catch (err) {
    // If fetch fails, return stale cache if available
    if (cached) {
      return NextResponse.json(cached.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch funding data', data: [], health: [], meta: { timestamp: Date.now() } },
      { status: 502, headers: { 'Cache-Control': 'no-cache' } },
    );
  }

  // Post-processing: classify asset class for entries that don't have one set.
  // Many CEX fetchers (Binance, Bybit, Bitget, etc.) don't set assetClass.
  // Apply the centralized classification to ensure stocks, forex, and commodities
  // show up correctly in their respective tabs.
  data.forEach(entry => {
    if (entry.assetClass && entry.assetClass !== 'crypto') return; // Already classified as non-crypto

    const sym = entry.symbol;

    // Handle MEXC *STOCK suffix (MSTRSTOCK → MSTR as stocks)
    if (sym.endsWith('STOCK')) {
      const base = sym.slice(0, -5);
      if (KNOWN_STOCKS.has(base)) {
        entry.symbol = base;
        entry.assetClass = 'stocks';
        return;
      }
    }

    // Check bare forex base symbols (EUR, GBP, JPY from CEXes like MEXC, Kraken, Bitfinex)
    if (FOREX_BASES.has(sym)) {
      entry.symbol = sym + 'USD';
      entry.assetClass = 'forex';
      return;
    }

    // Generic classification using known sets
    const classified = classifySymbol(sym);
    if (classified.assetClass !== 'crypto') {
      entry.assetClass = classified.assetClass;
      entry.symbol = classified.symbol;
    }
  });

  // Fix mark prices: some exchanges return inaccurate or missing mark prices.
  // gTrade derives a synthetic "tokenPrice" from OI ratios (wrong).
  // HTX and Aevo sometimes return 0. Backfill from other exchanges' real prices.
  const realPriceMap = new Map<string, number>();
  data.forEach(entry => {
    if (entry.markPrice && entry.markPrice > 0) {
      const existing = realPriceMap.get(entry.symbol);
      if (!existing) realPriceMap.set(entry.symbol, entry.markPrice);
    }
  });
  const BAD_PRICE_EXCHANGES = new Set(['gTrade']); // Always override — derived prices are wrong
  data.forEach(entry => {
    const needsFix = BAD_PRICE_EXCHANGES.has(entry.exchange) || !entry.markPrice || entry.markPrice === 0;
    if (!needsFix) return;
    const realPrice = realPriceMap.get(entry.symbol);
    if (realPrice) {
      entry.markPrice = realPrice;
    }
  });
  // Remove entries that still have no valid mark price after backfill
  const dataWithPrices = data.filter(entry => entry.markPrice && entry.markPrice > 0);

  // Compute implied predicted rates from mark-index price spread
  // Formula: clamp((markPrice - indexPrice) / indexPrice × 100, ±0.75%)
  // Exchanges with continuous/hourly funding don't have a meaningful "next 8h" prediction
  const CONTINUOUS_EXCHANGES = new Set(['Hyperliquid', 'dYdX', 'gTrade', 'Coinbase', 'Aevo', 'Drift', 'GMX', 'Extended', 'Lighter']);
  const PREDICTED_CLAMP = 0.75;

  dataWithPrices.forEach(entry => {
    // Skip if already has a real predicted rate from the exchange
    if (entry.predictedRate !== undefined) return;
    // Skip continuous funding model exchanges
    if (CONTINUOUS_EXCHANGES.has(entry.exchange)) return;
    // Need valid mark + index prices
    if (!entry.markPrice || !entry.indexPrice || entry.indexPrice <= 0) return;
    const premium = ((entry.markPrice - entry.indexPrice) / entry.indexPrice) * 100;
    entry.predictedRate = Math.max(-PREDICTED_CLAMP, Math.min(PREDICTED_CLAMP, premium));
  });

  // Build set of crypto symbols listed on 2+ exchanges — legitimate even if not top 500
  const exchangeCountMap = new Map<string, Set<string>>();
  dataWithPrices.forEach(r => {
    if (!r.assetClass || r.assetClass === 'crypto') {
      const sym = r.symbol.toUpperCase();
      if (!exchangeCountMap.has(sym)) exchangeCountMap.set(sym, new Set());
      exchangeCountMap.get(sym)!.add(r.exchange);
    }
  });
  const multiExchangeSymbols = new Set<string>();
  exchangeCountMap.forEach((exchanges, sym) => {
    if (exchanges.size >= 2) multiExchangeSymbols.add(sym);
  });

  const isAllowed = (symbol: string) =>
    isTop500Symbol(symbol, top500) || multiExchangeSymbols.has(symbol.toUpperCase());

  let filtered;
  if (assetClass === 'all') {
    filtered = dataWithPrices.filter(r => {
      if (!r.assetClass || r.assetClass === 'crypto') return isAllowed(r.symbol);
      return true;
    });
  } else if (assetClass === 'crypto') {
    filtered = dataWithPrices.filter(r => {
      const ac = r.assetClass || 'crypto';
      return ac === 'crypto' && isAllowed(r.symbol);
    });
  } else {
    filtered = dataWithPrices.filter(r => r.assetClass === assetClass);
  }

  const responseBody = {
    data: filtered,
    health,
    meta: {
      totalExchanges: fundingFetchers.length,
      activeExchanges: health.filter(h => h.status === 'ok').length,
      totalEntries: filtered.length,
      assetClass,
      timestamp: Date.now(),
      normalization: {
        basis: 'native',
        note: 'Rates in native interval percentage — check fundingInterval field (1h/4h/8h). 8h: Binance, Bybit, OKX, Bitget, MEXC, BingX, Phemex, KuCoin, Deribit, HTX, Bitfinex, WhiteBIT, CoinEx, Aster, gTrade. 4h: Kraken, edgeX. 1h: Hyperliquid, dYdX, Aevo, Coinbase, Drift, GMX, Extended, Lighter. Bitunix/Variational vary per market. OKX/CoinEx include native predictedRate. For others with mark+index prices, predictedRate is implied via clamp((mark-index)/index × 100, ±0.75%). Continuous-funding exchanges excluded from prediction.',
      },
    },
  };

  // Update L1 cache
  l1Cache.set(cacheKey, { body: responseBody, timestamp: Date.now() });

  return NextResponse.json(responseBody, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
