import { OrderbookLevel, BookWalkResult, DepthPoint } from './types';

/**
 * Walk an orderbook to compute VWAP for a given USD order size.
 * `levels` must be sorted best-to-worst (asks ascending, bids descending).
 */
export function walkBook(
  levels: OrderbookLevel[],
  orderSizeUsd: number,
  midPrice: number,
): BookWalkResult {
  let remaining = orderSizeUsd;
  let totalBaseQty = 0;
  let levelsConsumed = 0;

  for (const level of levels) {
    if (remaining <= 0) break;
    const levelValueUsd = level.size * level.price;
    const fillUsd = Math.min(remaining, levelValueUsd);
    totalBaseQty += fillUsd / level.price;
    remaining -= fillUsd;
    levelsConsumed++;
  }

  const filledUsd = orderSizeUsd - remaining;
  const vwap = totalBaseQty > 0 ? filledUsd / totalBaseQty : midPrice;

  return { vwap, filledUsd, levelsConsumed };
}

/**
 * Compute spread and price impact from a book walk result.
 * Spread = cost of crossing from mid to best level (bid-ask gap).
 * Impact = additional cost from consuming depth beyond best level.
 */
export function computeCostFromWalk(
  walkResult: BookWalkResult,
  midPrice: number,
  bestLevelPrice?: number,
): { spread: number; priceImpact: number } {
  if (walkResult.filledUsd <= 0 || midPrice <= 0) {
    return { spread: 0, priceImpact: 0 };
  }
  const totalSlippage = Math.abs(walkResult.vwap - midPrice) / midPrice * 100;

  // Split into spread (bid-ask gap) and impact (depth consumption)
  if (bestLevelPrice && bestLevelPrice > 0) {
    const spread = Math.abs(bestLevelPrice - midPrice) / midPrice * 100;
    const priceImpact = Math.max(0, totalSlippage - spread);
    return { spread, priceImpact };
  }

  return { spread: 0, priceImpact: totalSlippage };
}

/**
 * Compute max fillable size: total USD depth available in the book.
 */
export function maxFillableUsd(levels: OrderbookLevel[]): number {
  let total = 0;
  for (const level of levels) {
    total += level.size * level.price;
  }
  return total;
}

/**
 * Build cumulative depth curve for charting.
 */
export function buildDepthCurve(
  levels: OrderbookLevel[],
  midPrice: number,
  exchange: string,
): DepthPoint[] {
  const points: DepthPoint[] = [];
  let cumulative = 0;

  for (const level of levels) {
    cumulative += level.size * level.price;
    const offset = Math.abs(level.price - midPrice) / midPrice * 100;
    points.push({
      exchange,
      priceOffset: Math.round(offset * 1000) / 1000,
      cumulativeUsd: Math.round(cumulative),
    });
  }

  return points;
}
