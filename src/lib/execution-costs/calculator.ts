import { Direction, VenueCost, RawBookData } from './types';
import { walkBook, computeCostFromWalk, maxFillableUsd } from './book-walker';
import { EXCHANGE_FEES } from '@/lib/constants/exchanges';
import {
  fetchHyperliquidBook, fetchDydxBook, fetchDriftBook,
  fetchAsterBook, fetchAevoBook, fetchLighterBook,
  fetchExtendedBook, fetchEdgexBook, fetchVariationalQuotes,
  fetchGTradeParams, computeGTradeCost,
  fetchGMXParams, computeGMXCost,
} from './venues';

type FetchFn = typeof fetch;

function clobToVenueCost(
  book: RawBookData | null,
  orderSizeUsd: number,
  direction: Direction,
): VenueCost | null {
  if (!book) return null;

  const levels = direction === 'long' ? book.asks : book.bids;
  const fee = EXCHANGE_FEES[book.exchange]?.taker ?? 0;

  if (levels.length === 0) {
    return {
      exchange: book.exchange, available: true, fee, spread: 0, priceImpact: 0,
      totalCost: fee, executionPrice: book.midPrice, midPrice: book.midPrice,
      maxFillableSize: 0, depthLevels: 0, method: book.method,
    };
  }

  const result = walkBook(levels, orderSizeUsd, book.midPrice);
  const bestLevelPrice = levels[0]?.price;
  const costs = computeCostFromWalk(result, book.midPrice, bestLevelPrice);
  const maxFill = maxFillableUsd(levels);

  const spread = isFinite(costs.spread) ? costs.spread : 0;
  const priceImpact = isFinite(costs.priceImpact) ? costs.priceImpact : 0;

  return {
    exchange: book.exchange,
    available: true,
    fee,
    spread,
    priceImpact,
    totalCost: fee + spread + priceImpact,
    executionPrice: isFinite(result.vwap) ? result.vwap : book.midPrice,
    midPrice: book.midPrice,
    maxFillableSize: isFinite(maxFill) ? maxFill : 0,
    depthLevels: result.levelsConsumed,
    method: book.method,
  };
}

function unavailable(exchange: string, method: VenueCost['method'], error: string): VenueCost {
  return { exchange, available: false, fee: 0, spread: 0, priceImpact: 0, totalCost: 0, executionPrice: 0, midPrice: 0, maxFillableSize: 0, method, error };
}

export async function calculateAllVenueCosts(
  asset: string,
  orderSizeUsd: number,
  direction: Direction,
  fetchFn: FetchFn = fetch,
): Promise<VenueCost[]> {
  const [
    hlBook, dydxBook, driftBook, asterBook, aevoBook,
    lighterBook, extendedBook, edgexBook,
    gtradeParams, gmxParams,
    variationalBook,
  ] = await Promise.all([
    fetchHyperliquidBook(asset, fetchFn),
    fetchDydxBook(asset, fetchFn),
    fetchDriftBook(asset, fetchFn),
    fetchAsterBook(asset, fetchFn),
    fetchAevoBook(asset, fetchFn),
    fetchLighterBook(asset, fetchFn),
    fetchExtendedBook(asset, fetchFn),
    fetchEdgexBook(asset, fetchFn),
    fetchGTradeParams(asset, fetchFn),
    fetchGMXParams(asset, fetchFn),
    fetchVariationalQuotes(asset, fetchFn),
  ]);

  const results: VenueCost[] = [];

  // CLOB venues
  const clobBooks = [hlBook, dydxBook, driftBook, asterBook, aevoBook, lighterBook, extendedBook, edgexBook];
  for (const book of clobBooks) {
    const cost = clobToVenueCost(book, orderSizeUsd, direction);
    if (cost) {
      results.push(cost);
    } else if (book) {
      results.push(unavailable(book.exchange, 'clob', 'No data'));
    }
  }

  // gTrade (AMM formula)
  if (gtradeParams && gtradeParams.midPrice > 0) {
    const fee = EXCHANGE_FEES['gTrade']?.taker ?? 0.05;
    const gtCost = computeGTradeCost(gtradeParams, orderSizeUsd, direction);
    results.push({
      exchange: 'gTrade', available: true, fee, spread: 0,
      priceImpact: gtCost.priceImpact,
      totalCost: fee + gtCost.priceImpact,
      executionPrice: gtCost.executionPrice, midPrice: gtCost.midPrice,
      maxFillableSize: Infinity, method: 'amm_formula',
    });
  } else {
    results.push(unavailable('gTrade', 'amm_formula', 'Pair not found'));
  }

  // GMX (AMM estimation)
  if (gmxParams && gmxParams.midPrice > 0) {
    const fee = EXCHANGE_FEES['GMX']?.taker ?? 0.07;
    const gmxCost = computeGMXCost(gmxParams, orderSizeUsd, direction);
    results.push({
      exchange: 'GMX', available: true, fee, spread: 0,
      priceImpact: gmxCost.priceImpact,
      totalCost: fee + gmxCost.priceImpact,
      executionPrice: gmxCost.executionPrice, midPrice: gmxCost.midPrice,
      maxFillableSize: Infinity, method: 'amm_rpc',
    });
  } else {
    results.push(unavailable('GMX', 'amm_rpc', 'Market not found'));
  }

  // Variational (quote-based)
  const varCost = clobToVenueCost(variationalBook, orderSizeUsd, direction);
  if (varCost) {
    results.push(varCost);
  } else {
    results.push(unavailable('Variational', 'quote', 'No quotes'));
  }

  // Sort by total cost (cheapest first), unavailable at end
  results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.totalCost - b.totalCost;
  });

  return results;
}
