/**
 * Per-exchange funding settlement intervals (in hours).
 *
 * Matters for cost-of-carry calculations: a 1h-interval venue (HL, dYdX,
 * Aevo) compounds 24× per day vs an 8h venue's 3×, so the same headline
 * "rate per interval" implies very different daily costs.
 *
 * Falls back to 8h for unknown exchanges (the common case).
 *
 * Shared between the /positions page (client) and the
 * /api/account/positions route (server) so the UI and the daily-carry
 * projection stay in lock-step.
 */
export const FUNDING_INTERVAL_HOURS: Record<string, number> = {
  // 1-hour venues
  Hyperliquid: 1,
  dYdX: 1,
  Aevo: 1,
  GMX: 1,
  Lighter: 1,
  edgeX: 1,
  Coinbase: 1,
  // 4-hour venues
  Kraken: 4,
  // 8-hour venues (the standard)
  Binance: 8,
  Bybit: 8,
  OKX: 8,
  Bitget: 8,
  MEXC: 8,
  KuCoin: 8,
  BingX: 8,
  Aster: 8,
  gTrade: 8,
  Phemex: 8,
  HTX: 8,
  Bitfinex: 8,
  WhiteBIT: 8,
  CoinEx: 8,
  Deribit: 8,
};

/**
 * Resolve the funding interval for an exchange label, tolerating any
 * disambiguator suffix the wallet client may have appended like
 * "GMX (Avax)" or "Lighter (acct 2)".
 */
export function intervalHoursFor(exchange: string): number {
  const canon = exchange.replace(/\s*\([^()]*\)\s*$/, '').trim();
  return FUNDING_INTERVAL_HOURS[canon] ?? 8;
}

/**
 * Daily cost of carry from funding for a single position, in USD.
 *
 *   carry = positionValue × ratePerInterval × (24 / intervalH) × sideMultiplier
 *
 * Sign convention: positive = user receives funding, negative = user pays.
 *   - Long pays positive funding  → carry is negative
 *   - Long receives negative      → carry is positive
 *   - Short pays negative funding → carry is negative
 *   - Short receives positive     → carry is positive
 *
 * `currentFundingPct` is the rate as exchanges report it: a percent per
 * the venue's native settlement interval. e.g. Binance "0.01"  = 0.01%
 * per 8h. We divide by 100 to convert to a fraction.
 *
 * Returns null when we don't have enough data to project (no rate, no
 * position value, or invalid exchange interval).
 */
export function dailyFundingCarryUsd(args: {
  side: 'long' | 'short';
  positionValue: number | null;
  currentFundingPct: number | null;
  exchange: string;
}): number | null {
  const { side, positionValue, currentFundingPct, exchange } = args;
  if (positionValue == null || !Number.isFinite(positionValue) || positionValue <= 0) return null;
  if (currentFundingPct == null || !Number.isFinite(currentFundingPct)) return null;
  const intervalH = intervalHoursFor(exchange);
  if (intervalH <= 0) return null;

  // Compounding 24/intervalH times per day, but funding doesn't actually
  // compound on the position's notional within a single day in any
  // interesting way — the perp value re-marks every funding tick. We
  // approximate with the simple-interest formula that traders use, which
  // is what we display elsewhere (the APR sub-line).
  const dailyRateFraction = (currentFundingPct / 100) * (24 / intervalH);
  const sideMul = side === 'long' ? -1 : 1;
  return positionValue * dailyRateFraction * sideMul;
}
