/**
 * Sanity-cap a percentage value parsed from an exchange API. Used by the
 * BingX ticker fetcher and the momentum aggregator to defend against
 * upstream feeds returning garbage like 280,899% for newly-listed pairs
 * (BingX returns openPrice=0 but still computes priceChangePercent as a
 * wild number). Without a cap, one bad row dominates the screener and
 * breakout displays.
 *
 * Returns 0 when:
 *   - value can't be parsed
 *   - openPrice (if provided) is <= 0 (no valid baseline)
 *   - |percent| exceeds maxAbs (default 1000 = 1000%)
 *
 * Real moves of 100-500% over 24h are still kept (memecoins do this).
 * The 1000% cap rejects the impossible-looking outliers without touching
 * the genuine moonshots.
 */
export function sanitizePercent(
  value: unknown,
  opts?: { openPrice?: number; maxAbs?: number },
): number {
  const num = typeof value === 'number'
    ? value
    : parseFloat(String(value)) || 0;
  if (!Number.isFinite(num)) return 0;
  if (opts?.openPrice !== undefined && opts.openPrice <= 0) return 0;
  const max = opts?.maxAbs ?? 1000;
  if (Math.abs(num) > max) return 0;
  return num;
}
