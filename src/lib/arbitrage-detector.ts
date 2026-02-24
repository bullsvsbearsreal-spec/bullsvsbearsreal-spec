/**
 * Arbitrage detection module — pure functions, no side effects.
 *
 * Detects price arbitrage (cross-exchange spread) and funding-rate
 * arbitrage opportunities from pre-fetched ticker / funding data.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Round-trip taker fee assumption (maker+taker across two exchanges). */
const ROUND_TRIP_FEE_PCT = 0.10;

/** Minimum 24h quote volume (USD) required on BOTH sides of a price arb. */
const MIN_VOLUME_USD = 500_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceArb {
  symbol: string;
  lowExchange: string;
  lowPrice: number;
  highExchange: string;
  highPrice: number;
  spreadPct: number;
  spreadUsd: number;
  netPct: number; // after round-trip fees
  lowVolume: number;
  highVolume: number;
}

export interface FundingArb {
  symbol: string;
  lowExchange: string;
  lowRate: number; // 8h-normalised
  highExchange: string;
  highRate: number; // 8h-normalised
  spread8h: number;
}

/** Shape expected from the tickers API (only fields we use). */
export interface TickerEntry {
  symbol: string;
  exchange: string;
  lastPrice: number;
  quoteVolume24h: number;
}

/** Shape expected from the funding API (only fields we use). */
export interface FundingEntry {
  symbol: string;
  exchange: string;
  fundingRate: number | null;
  fundingInterval: string; // '1h' | '4h' | '8h'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) {
      arr.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}

/**
 * Normalise a funding rate to an 8-hour basis.
 * 1h rates are multiplied by 8, 4h by 2, 8h (or unknown) left as-is.
 */
function normaliseTo8h(rate: number, interval: string): number {
  if (interval === '1h') return rate * 8;
  if (interval === '4h') return rate * 2;
  return rate; // '8h' or anything else
}

// ---------------------------------------------------------------------------
// Price arbitrage detection
// ---------------------------------------------------------------------------

/**
 * Detect cross-exchange price arbitrage opportunities.
 *
 * @param tickers  Array of ticker entries from the tickers API.
 * @param threshold  Minimum net spread (%) after fees to include. Default 0.5.
 * @returns Sorted array of price-arb opportunities (highest netPct first).
 */
export function detectPriceArbitrage(
  tickers: TickerEntry[],
  threshold = 0.5,
): PriceArb[] {
  // Filter invalid prices up front
  const valid = tickers.filter((t) => t.lastPrice != null && t.lastPrice > 0);

  const grouped = groupBy(valid, (t) => t.symbol);
  const results: PriceArb[] = [];

  grouped.forEach((entries, symbol) => {
    if (entries.length < 2) return;

    let low = entries[0];
    let high = entries[0];

    for (let i = 1; i < entries.length; i++) {
      const e = entries[i];
      if (e.lastPrice < low.lastPrice) low = e;
      if (e.lastPrice > high.lastPrice) high = e;
    }

    // Same exchange — nothing to arb
    if (low.exchange === high.exchange) return;

    // Both sides must meet minimum volume
    if (low.quoteVolume24h < MIN_VOLUME_USD) return;
    if (high.quoteVolume24h < MIN_VOLUME_USD) return;

    const spreadPct = ((high.lastPrice - low.lastPrice) / low.lastPrice) * 100;
    const netPct = spreadPct - ROUND_TRIP_FEE_PCT;

    if (netPct < threshold) return;

    results.push({
      symbol,
      lowExchange: low.exchange,
      lowPrice: low.lastPrice,
      highExchange: high.exchange,
      highPrice: high.lastPrice,
      spreadPct,
      spreadUsd: high.lastPrice - low.lastPrice,
      netPct,
      lowVolume: low.quoteVolume24h,
      highVolume: high.quoteVolume24h,
    });
  });

  results.sort((a, b) => b.netPct - a.netPct);
  return results;
}

// ---------------------------------------------------------------------------
// Funding rate arbitrage detection
// ---------------------------------------------------------------------------

/**
 * Detect cross-exchange funding-rate arbitrage opportunities.
 *
 * @param rates  Array of funding-rate entries from the funding API.
 * @param threshold  Minimum 8h spread (%) to include. Default 0.02.
 * @returns Sorted array of funding-arb opportunities (highest spread8h first).
 */
export function detectFundingArbitrage(
  rates: FundingEntry[],
  threshold = 0.02,
): FundingArb[] {
  // Filter out null rates
  const valid = rates.filter(
    (r): r is FundingEntry & { fundingRate: number } => r.fundingRate != null,
  );

  const grouped = groupBy(valid, (r) => r.symbol);
  const results: FundingArb[] = [];

  grouped.forEach((entries, symbol) => {
    if (entries.length < 2) return;

    // Normalise all rates to 8h basis
    let minIdx = 0;
    let maxIdx = 0;
    const normalised = entries.map((e: FundingEntry & { fundingRate: number }) =>
      normaliseTo8h(e.fundingRate, e.fundingInterval),
    );

    for (let i = 1; i < normalised.length; i++) {
      if (normalised[i] < normalised[minIdx]) minIdx = i;
      if (normalised[i] > normalised[maxIdx]) maxIdx = i;
    }

    // Same exchange — skip
    if (entries[minIdx].exchange === entries[maxIdx].exchange) return;

    const spread8h = normalised[maxIdx] - normalised[minIdx];

    if (spread8h < threshold) return;

    results.push({
      symbol,
      lowExchange: entries[minIdx].exchange,
      lowRate: normalised[minIdx],
      highExchange: entries[maxIdx].exchange,
      highRate: normalised[maxIdx],
      spread8h,
    });
  });

  results.sort((a, b) => b.spread8h - a.spread8h);
  return results;
}
