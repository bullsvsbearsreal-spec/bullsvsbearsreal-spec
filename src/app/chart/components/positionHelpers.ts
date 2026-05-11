/**
 * Pure helpers extracted from <ChartPositionStrip> so the formatting
 * + symbol-matching + liq-distance rules can be locked down with
 * unit tests without dragging React into the test runtime.
 */

/**
 * Format a price for compact terminal display.
 *   - >=1000  → no decimals, thousand-separated (e.g. "62,431")
 *   - >=1     → 2 decimals (e.g. "1.23")
 *   - >=0.01  → 4 decimals (e.g. "0.0123")
 *   - else    → 6 decimals (e.g. "0.000012")
 *
 * Null/undefined/non-finite → '—'.
 */
export function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  if (Math.abs(n) >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

/**
 * Format a position size with SI-suffix bucketing.
 *   - >=1e6 → "1.23M"
 *   - >=1e3 → "1.2K"
 *   - >=1   → 3 decimals
 *   - else  → 6 decimals
 */
export function fmtSize(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

/**
 * Format a USD value with optional sign prefix.
 *   - >=1e9 → "$1.23B"
 *   - >=1e6 → "$1.23M"
 *   - >=1e3 → "$1.2K"
 *   - else  → "$1.23"
 *
 * `opts.sign = true` prefixes a '+' on strictly positive values.
 * Negative values always show their natural '-' sign.
 */
export function fmtUsd(
  n: number | null | undefined,
  opts: { sign?: boolean } = {},
): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = opts.sign && n > 0 ? '+' : '';
  if (Math.abs(n) >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  return `${sign}$${n.toFixed(2)}`;
}

/**
 * Normalize a symbol for cross-format matching. Strips common quote
 * + perp suffixes so 'BTC', 'BTCUSDT', 'BTC-PERP', 'BTCPERP', and
 * 'btcusdt' all collapse to 'BTC'.
 */
export function normalizeSymbol(s: string): string {
  return s.toUpperCase().replace(/USDT$|USD$|-PERP$|PERP$/i, '');
}

export function matchesSymbol(positionSymbol: string, viewSymbol: string): boolean {
  return normalizeSymbol(positionSymbol) === normalizeSymbol(viewSymbol);
}

/** Distance-to-liquidation severity buckets used by the LIQ cell. */
export type LiqSeverity = 'danger' | 'caution' | 'safe';

/**
 * Distance from mark price to liquidation price, as a % of mark,
 * with a severity bucket for color-coding.
 *
 *   - distPct <2  → 'danger'
 *   - distPct <5  → 'caution'
 *   - else        → 'safe'
 *
 * Returns null when inputs are missing or mark is non-positive.
 */
export function liquidationDistance(
  markPrice: number | null | undefined,
  liquidationPrice: number | null | undefined,
): { pct: number; severity: LiqSeverity } | null {
  if (markPrice == null || liquidationPrice == null) return null;
  if (!Number.isFinite(markPrice) || !Number.isFinite(liquidationPrice)) return null;
  if (markPrice <= 0) return null;
  const pct = Math.abs(markPrice - liquidationPrice) / markPrice * 100;
  const severity: LiqSeverity = pct < 2 ? 'danger' : pct < 5 ? 'caution' : 'safe';
  return { pct, severity };
}

/**
 * PnL as a % of (absolute) position value. Returns null if either
 * input is missing or positionValue is zero (no notional to divide by).
 */
export function pnlPercentage(
  unrealizedPnl: number | null | undefined,
  positionValue: number | null | undefined,
): number | null {
  if (unrealizedPnl == null || positionValue == null) return null;
  if (!Number.isFinite(unrealizedPnl) || !Number.isFinite(positionValue)) return null;
  if (positionValue === 0) return null;
  return (unrealizedPnl / Math.abs(positionValue)) * 100;
}
