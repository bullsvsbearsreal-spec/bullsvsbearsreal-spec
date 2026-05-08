import { Direction, VenueCost, RawBookData } from './types';
import { walkBook, computeCostFromWalk, maxFillableUsd } from './book-walker';
import { EXCHANGE_FEES } from '@/lib/constants/exchanges';
import {
  fetchHyperliquidBook, fetchDydxBook,
  fetchAsterBook, fetchAevoBook, fetchLighterBook,
  fetchExtendedBook, fetchEdgexBook, fetchVariationalQuotes,
  fetchGTradeParams, computeGTradeCost,
  fetchGMXParams, computeGMXCost,
  fetchBinanceBook, fetchBybitBook, fetchOKXBook, fetchBitgetBook,
} from './venues';

type FetchFn = typeof fetch;

/**
 * Convert a raw orderbook into a VenueCost row for /trade-optimizer.
 *
 * Critical invariants (locked in by tests):
 * - Empty book on the relevant side → available:false (so the venue
 *   doesn't get sorted to "cheapest" with 0bps cost — that's a Lighter
 *   indexer bug we already hit once).
 * - fillRatio < 0.5 → available:false with "Insufficient depth"
 *   (extrapolated cost from a non-fillable order is meaningless and
 *   would otherwise rank a tiny venue at the top).
 * - Long uses asks; short uses bids. Sign-flip would invert the table.
 * - Non-finite costs (Infinity, NaN) get clamped to 0 — defensive
 *   against degenerate upstream data.
 */
export function clobToVenueCost(
  book: RawBookData | null,
  orderSizeUsd: number,
  direction: Direction,
): VenueCost | null {
  if (!book) return null;

  const levels = direction === 'long' ? book.asks : book.bids;
  const fee = EXCHANGE_FEES[book.exchange]?.taker ?? 0;

  if (levels.length === 0) {
    // Empty book on the relevant side — we cannot fill the order at all.
    // Returning available:true with 0bps would misleadingly rank this venue
    // as cheapest (it happens to be Lighter often when their indexer
    // returns empty data). Mark unavailable so it falls to the bottom.
    return {
      exchange: book.exchange, available: false, fee: 0, spread: 0, priceImpact: 0,
      totalCost: 0, executionPrice: 0, midPrice: book.midPrice,
      maxFillableSize: 0, depthLevels: 0, method: book.method, error: 'Empty book',
    };
  }

  const result = walkBook(levels, orderSizeUsd, book.midPrice);
  const bestLevelPrice = levels[0]?.price;
  const costs = computeCostFromWalk(result, book.midPrice, bestLevelPrice);
  const maxFill = maxFillableUsd(levels);

  const spread = isFinite(costs.spread) ? costs.spread : 0;
  const priceImpact = isFinite(costs.priceImpact) ? costs.priceImpact : 0;

  // Partial-fill guard: if the book couldn't absorb at least 50% of the
  // requested size, the resulting cost numbers are extrapolations from
  // an order that wouldn't actually fill. Mark unavailable so we don't
  // recommend a venue that can't take the trade.
  const fillRatio = orderSizeUsd > 0 ? result.filledUsd / orderSizeUsd : 1;
  if (fillRatio < 0.5) {
    return {
      exchange: book.exchange, available: false, fee: 0, spread: 0, priceImpact: 0,
      totalCost: 0, executionPrice: 0, midPrice: book.midPrice,
      maxFillableSize: isFinite(maxFill) ? maxFill : 0,
      depthLevels: result.levelsConsumed, method: book.method,
      error: `Insufficient depth ($${(maxFill / 1000).toFixed(0)}k available)`,
    };
  }

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
    hlBook, dydxBook, asterBook, aevoBook,
    lighterBook, extendedBook, edgexBook,
    gtradeParams, gmxParams,
    variationalBook,
    binanceBook, bybitBook, okxBook, bitgetBook,
  ] = await Promise.all([
    fetchHyperliquidBook(asset, fetchFn),
    fetchDydxBook(asset, fetchFn),
    fetchAsterBook(asset, fetchFn),
    fetchAevoBook(asset, fetchFn),
    fetchLighterBook(asset, fetchFn),
    fetchExtendedBook(asset, fetchFn),
    fetchEdgexBook(asset, fetchFn),
    fetchGTradeParams(asset, fetchFn),
    fetchGMXParams(asset, fetchFn),
    fetchVariationalQuotes(asset, fetchFn),
    fetchBinanceBook(asset, fetchFn),
    fetchBybitBook(asset, fetchFn),
    fetchOKXBook(asset, fetchFn),
    fetchBitgetBook(asset, fetchFn),
  ]);

  const results: VenueCost[] = [];

  // CLOB venues — Drift removed (indexer frozen since Apr 2026)
  // Now includes the 4 main CEX perp venues so /trade-optimizer can quote
  // the full DEX + CEX universe side-by-side instead of just DEX-only.
  const clobBooks = [
    hlBook, dydxBook, asterBook, aevoBook, lighterBook, extendedBook, edgexBook,
    binanceBook, bybitBook, okxBook, bitgetBook,
  ];
  for (const book of clobBooks) {
    const cost = clobToVenueCost(book, orderSizeUsd, direction);
    if (cost) {
      results.push(cost);
    } else if (book) {
      results.push(unavailable(book.exchange, 'clob', 'No data'));
    }
  }

  // gTrade (AMM formula) — use dynamic fee from chain when available
  if (gtradeParams && gtradeParams.midPrice > 0) {
    const fee = gtradeParams.baseFeeP > 0 ? gtradeParams.baseFeeP : (EXCHANGE_FEES['gTrade']?.taker ?? 0.05);
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

  // Price sanity check: use AMM oracle prices (gTrade/GMX) as reference since they
  // pull from on-chain oracles and are always current, unlike CLOB orderbooks which
  // can return stale data from geo-blocked regions
  const oracleVenues = results.filter(r => r.available && r.midPrice > 0 && (r.method === 'amm_formula' || r.method === 'amm_rpc'));
  const refPrice = oracleVenues.length > 0
    ? oracleVenues.reduce((s, r) => s + r.midPrice, 0) / oracleVenues.length
    : 0;
  if (refPrice > 0) {
    for (const r of results) {
      if (r.available && r.midPrice > 0 && Math.abs(r.midPrice - refPrice) / refPrice > 0.05) {
        r.available = false;
        r.error = `Stale price ($${r.midPrice.toFixed(0)} vs oracle $${refPrice.toFixed(0)})`;
      }
    }
  }

  // Sort by total cost (cheapest first), unavailable at end
  results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.totalCost - b.totalCost;
  });

  return results;
}
