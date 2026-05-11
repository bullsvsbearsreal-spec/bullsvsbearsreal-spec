/**
 * Pure ticker-selection helpers extracted from useTickerStats in
 * chart/page.tsx. The /api/tickers endpoint returns one row per
 * symbol per venue; for the stats bar we need to pick the ONE
 * row with the most complete data for a given symbol.
 *
 * Historical bug this guards against:
 *   "Previous logic just picked max-price, which for BTC kept
 *    landing on BITSTAMP (no high/low/change/vol fields) and
 *    rendered '$0.0000e+0' in the stat bar."
 *
 * Strategy: score each candidate by how many fields it populates;
 * use price as the tiebreaker. Both branches are deterministic.
 */

export interface RawTicker {
  symbol: string;
  lastPrice?: number; price?: number;
  priceChangePercent24h?: number; change24h?: number; changePercent24h?: number;
  highPrice24h?: number; high24h?: number;
  lowPrice24h?: number;  low24h?: number;
  volume24h?: number; quoteVolume24h?: number;
}

export interface TickerStat {
  price?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
}

/**
 * Field-completeness score. Higher = more populated. Heavier weight
 * on the 24h fields because those are exactly what BITSTAMP-shaped
 * sparse rows lack — the bug case we're guarding against.
 *   - price > 0: +1
 *   - 24h change != 0: +2
 *   - 24h high > 0: +2
 *   - 24h low > 0: +2
 *   - 24h vol > 0: +2
 * Max = 9.
 */
export function scoreTickerCompleteness(t: RawTicker): number {
  let s = 0;
  if ((t.lastPrice ?? t.price ?? 0) > 0) s += 1;
  if ((t.priceChangePercent24h ?? t.change24h ?? t.changePercent24h ?? 0) !== 0) s += 2;
  if ((t.highPrice24h ?? t.high24h ?? 0) > 0) s += 2;
  if ((t.lowPrice24h ?? t.low24h ?? 0) > 0) s += 2;
  if ((t.volume24h ?? t.quoteVolume24h ?? 0) > 0) s += 2;
  return s;
}

/**
 * Pick the most-complete entry from a list of cross-venue tickers
 * for the same symbol. Tiebreak: highest price (some venues quote
 * stale prices that score the same but sit far from market).
 *
 * Returns null when the list is empty.
 */
export function pickBestTicker(matches: RawTicker[]): RawTicker | null {
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => {
    const sa = scoreTickerCompleteness(a), sb = scoreTickerCompleteness(b);
    if (sa !== sb) return sa > sb ? a : b;
    return ((a.lastPrice ?? a.price ?? 0) > (b.lastPrice ?? b.price ?? 0) ? a : b);
  });
}

/**
 * Project a winning RawTicker into the TickerStat shape consumed
 * by ChartStatsBar / ChartAiStrip. Coerces falsy zeros to undefined
 * so consumers can treat "no data" distinctly from "literal zero".
 */
export function projectTickerStat(best: RawTicker): TickerStat {
  const orUndef = (v: number | null | undefined): number | undefined =>
    (v != null && v !== 0) ? v : undefined;
  return {
    price: best.lastPrice ?? best.price,
    change24h: orUndef(best.priceChangePercent24h ?? best.change24h ?? best.changePercent24h),
    high24h: orUndef(best.highPrice24h ?? best.high24h),
    low24h: orUndef(best.lowPrice24h ?? best.low24h),
    volume24h: orUndef(best.volume24h ?? best.quoteVolume24h),
  };
}
