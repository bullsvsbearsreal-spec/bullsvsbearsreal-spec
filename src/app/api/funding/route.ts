import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { fundingFetchers } from './exchanges';

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

  const [{ data, health }, top500] = await Promise.all([
    fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout),
    getTop500Symbols(),
  ]);

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
  const CONTINUOUS_EXCHANGES = new Set(['Hyperliquid', 'dYdX', 'gTrade', 'Coinbase']);
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

  // Anomaly detection: flag rates > 1,825% annualized
  // Threshold per interval: 5% per 8h, 0.625% per 1h, 2.5% per 4h
  const ANOMALY_THRESHOLD_8H = 5;
  const anomalies: { symbol: string; exchange: string; rate: number; action: string }[] = [];
  filtered = filtered.map(r => {
    const threshold = r.fundingInterval === '1h' ? ANOMALY_THRESHOLD_8H / 8
      : r.fundingInterval === '4h' ? ANOMALY_THRESHOLD_8H / 2
      : ANOMALY_THRESHOLD_8H;
    if (Math.abs(r.fundingRate) > threshold) {
      anomalies.push({
        symbol: r.symbol,
        exchange: r.exchange,
        rate: r.fundingRate,
        action: 'capped',
      });
      // Cap to threshold rather than exclude — preserves directional signal
      return { ...r, fundingRate: Math.sign(r.fundingRate) * threshold };
    }
    return r;
  });

  const responseBody = {
    data: filtered,
    health,
    meta: {
      totalExchanges: fundingFetchers.length,
      activeExchanges: health.filter(h => h.status === 'ok').length,
      totalEntries: filtered.length,
      assetClass,
      timestamp: Date.now(),
      anomalies: anomalies.length > 0 ? anomalies : undefined,
      normalization: {
        basis: 'native',
        note: 'Rates in native interval percentage. Most exchanges are 8h. Hyperliquid is 1h (fundingInterval field). dYdX, Aevo, Coinbase are hourly but normalized to 8h. Kraken is 4h normalized to 8h. gTrade is per-second normalized to 8h. OKX and CoinEx include native predictedRate. For other exchanges with mark+index prices, predictedRate is implied via clamp((mark-index)/index × 100, ±0.75%). Continuous-funding exchanges excluded from prediction.',
      },
    },
  };

  // Update L1 cache
  l1Cache.set(cacheKey, { body: responseBody, timestamp: Date.now() });

  return NextResponse.json(responseBody, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
