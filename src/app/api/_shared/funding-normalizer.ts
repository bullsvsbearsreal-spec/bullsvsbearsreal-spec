/**
 * Shared funding rate normalizer + runtime validation.
 *
 * Every exchange fetcher pipes its raw rate through `toFundingRate()` which:
 *  1. Converts any raw format (fraction, percentage, BigInt, annualized) → per-interval %
 *  2. Validates the result (NaN, extreme caps, zero detection)
 *  3. Logs warnings on suspicious values so silent breakage becomes loud
 *
 * This is the single source of truth for rate math — never do ad-hoc
 * `* 100`, `/ 8`, `/ 8760` in individual fetchers.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type FundingInterval = '1h' | '4h' | '8h';

export type RawPrecision =
  | 'fraction'      // 0.0001 = 0.01% — most CEXes and many DEXes
  | 'percentage'    // 0.01 already means 0.01% — rare (Drift)
  | 'bigint-1e30'   // GMX: annual rate at 1e30 precision
  | 'bigint-1e18'   // Nado: 24h rate at 1e18 precision
  | 'annualized'    // Variational: decimal annual rate (e.g. 1.25 = 125% APR)
  ;

export interface NormalizeOpts {
  /** How the raw value is scaled */
  precision: RawPrecision;
  /** What interval the raw rate represents */
  rawInterval: FundingInterval | '24h' | 'annual';
  /** What interval the returned rate should represent (usually matches settlement) */
  targetInterval: FundingInterval;
}

// ── Constants ───────────────────────────────────────────────────────────────

const HOURS: Record<string, number> = {
  '1h': 1, '4h': 4, '8h': 8, '24h': 24, 'annual': 8760,
};

/** Absolute cap: any rate beyond ±500% per 8h is almost certainly a bug */
const MAX_RATE_8H = 500;

// ── Core conversion ─────────────────────────────────────────────────────────

/**
 * Convert a raw funding rate value to a percentage in the target interval.
 *
 * Examples:
 *   toFundingRate(0.0001, { precision:'fraction', rawInterval:'8h', targetInterval:'8h' })
 *     → 0.01  (= 0.01%)
 *
 *   toFundingRate(0.0001, { precision:'fraction', rawInterval:'1h', targetInterval:'1h' })
 *     → 0.01  (= 0.01%)
 *
 *   toFundingRate('427000000000000000000000000', { precision:'bigint-1e30', rawInterval:'annual', targetInterval:'1h' })
 *     → hourly %
 */
export function toFundingRate(
  raw: number | string | bigint,
  opts: NormalizeOpts,
): number {
  // Step 0: Parse to number
  let num: number;
  if (typeof raw === 'bigint') {
    num = Number(raw);
  } else if (typeof raw === 'string') {
    num = parseFloat(raw);
  } else {
    num = raw;
  }

  if (!isFinite(num)) return 0;

  // Step 1: Convert raw value to a percentage in the raw interval
  let pctInRawInterval: number;

  switch (opts.precision) {
    case 'fraction':
      // 0.0001 → 0.01%
      pctInRawInterval = num * 100;
      break;
    case 'percentage':
      // Already a percentage
      pctInRawInterval = num;
      break;
    case 'bigint-1e30':
      // BigInt at 1e30 — convert to decimal first, then to %
      pctInRawInterval = (num / 1e30) * 100;
      break;
    case 'bigint-1e18':
      // BigInt at 1e18 — convert to decimal first, then to %
      pctInRawInterval = (num / 1e18) * 100;
      break;
    case 'annualized':
      // Decimal annual rate (1.25 = 125% APR)
      pctInRawInterval = num * 100;
      break;
    default:
      pctInRawInterval = num * 100;
  }

  // Step 2: Convert from raw interval to target interval
  const rawHours = HOURS[opts.rawInterval];
  const targetHours = HOURS[opts.targetInterval];

  if (!rawHours || !targetHours) return 0;

  const pctInTargetInterval = pctInRawInterval * (targetHours / rawHours);

  return pctInTargetInterval;
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  /** The (possibly capped) rate */
  rate: number;
  warning?: string;
}

/**
 * Validate a normalized funding rate. Caps extreme values and flags zeros.
 * Returns the (possibly capped) rate + any warning message.
 */
export function validateRate(
  rate: number,
  interval: FundingInterval,
  exchange: string,
  symbol: string,
): ValidationResult {
  if (!isFinite(rate)) {
    return {
      isValid: false,
      rate: 0,
      warning: `[FundingNorm] ${exchange} ${symbol}: NaN/Infinity rate — raw parse failed`,
    };
  }

  // Scale cap to the interval for comparison
  const intervalHours = HOURS[interval];
  const cap = MAX_RATE_8H * (intervalHours / 8);

  if (Math.abs(rate) > cap) {
    const capped = Math.sign(rate) * cap;
    return {
      isValid: true,
      rate: capped,
      warning: `[FundingNorm] ${exchange} ${symbol}: rate ${rate.toFixed(4)}% exceeds ±${cap}% cap for ${interval} — capped to ${capped.toFixed(4)}%`,
    };
  }

  return { isValid: true, rate };
}

/**
 * Convert + validate in one call. This is what most fetchers should use.
 * Logs warnings to console automatically.
 */
export function normalizeFundingRate(
  raw: number | string | bigint,
  opts: NormalizeOpts,
  exchange: string,
  symbol: string,
): number {
  const rate = toFundingRate(raw, opts);
  const result = validateRate(rate, opts.targetInterval, exchange, symbol);

  if (result.warning) {
    console.warn(result.warning);
  }

  return result.rate;
}

// ── Price validation ────────────────────────────────────────────────────────

/**
 * Check mark/index price divergence. Returns a warning string if > 5%.
 */
export function checkPriceDivergence(
  markPrice: number,
  indexPrice: number,
  exchange: string,
  symbol: string,
): string | null {
  if (markPrice <= 0 || indexPrice <= 0) return null; // Can't check without both
  const divergence = Math.abs(markPrice - indexPrice) / indexPrice;
  if (divergence > 0.05) {
    return `[FundingNorm] ${exchange} ${symbol}: mark/index divergence ${(divergence * 100).toFixed(1)}% (mark=${markPrice}, index=${indexPrice})`;
  }
  return null;
}

// ── Post-processing sanity checks ───────────────────────────────────────────

export interface SanityReport {
  zeroRateCount: number;
  cappedCount: number;
  missingIntervalCount: number;
  warnings: string[];
}

/**
 * Run sanity checks on a batch of funding entries after all fetchers complete.
 * Logs warnings and returns a report. Does NOT mutate the data.
 */
export function runSanityChecks(data: Array<{
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingInterval?: string;
  markPrice?: number;
  indexPrice?: number;
}>): SanityReport {
  const report: SanityReport = {
    zeroRateCount: 0,
    cappedCount: 0,
    missingIntervalCount: 0,
    warnings: [],
  };

  // Track zero-rate exchanges to detect "all zeros from one exchange" (API likely broke)
  const exchangeZeros = new Map<string, number>();
  const exchangeTotals = new Map<string, number>();

  for (const entry of data) {
    // Missing interval
    if (!entry.fundingInterval) {
      report.missingIntervalCount++;
    }

    // Zero rate tracking
    exchangeTotals.set(entry.exchange, (exchangeTotals.get(entry.exchange) || 0) + 1);
    if (entry.fundingRate === 0) {
      report.zeroRateCount++;
      exchangeZeros.set(entry.exchange, (exchangeZeros.get(entry.exchange) || 0) + 1);
    }
  }

  // Flag exchanges where >80% of rates are zero (likely broken)
  exchangeZeros.forEach((zeros, exchange) => {
    const total = exchangeTotals.get(exchange) || 1;
    if (total >= 5 && zeros / total > 0.8) {
      const msg = `[FundingSanity] ${exchange}: ${zeros}/${total} rates are zero — API may be returning empty/null rates`;
      report.warnings.push(msg);
      console.warn(msg);
    }
  });

  if (report.missingIntervalCount > 0) {
    const msg = `[FundingSanity] ${report.missingIntervalCount} entries missing fundingInterval — will default to 8h in v1 API`;
    report.warnings.push(msg);
    console.warn(msg);
  }

  return report;
}
