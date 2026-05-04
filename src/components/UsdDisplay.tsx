'use client';

/**
 * Renders a USD amount in compact form (e.g. $10.4M) with a `title` tooltip
 * showing the full precision ($10,386,402). Drop-in wherever you currently
 * render `fmtUSD(x)` inside JSX and want hover-for-exact behavior.
 *
 * Sub-dollar values are rendered with adaptive precision — never rounded
 * to $0 (e.g. PEPE @ $0.0000084 stays readable). Compact form is reserved
 * for values >= $1k.
 */

interface UsdDisplayProps {
  amount: number | null | undefined;
  /** Whether to render the sign when positive (e.g. +$10.4M). Default: false */
  showPositiveSign?: boolean;
  /** Override the compact behavior (render full inline) */
  full?: boolean;
  className?: string;
}

/**
 * Adaptive small-number formatter for fractional USD amounts.
 *
 * - abs >= 1     : up to 2 decimals
 * - abs >= 0.01  : 4 decimals (sub-dollar, > 1¢)
 * - abs >= 0.0001: 6 decimals
 * - abs > 0      : 8 decimals (deep micro-cap range like PEPE / SHIB)
 */
function smallUsd(absAmount: number): string {
  if (absAmount >= 1) return absAmount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (absAmount >= 0.01) return absAmount.toFixed(4);
  if (absAmount >= 0.0001) return absAmount.toFixed(6);
  return absAmount.toFixed(8);
}

function compactUsd(n: number, showSign: boolean): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : showSign ? '+' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  // Sub-1k: don't round down to $0/$1 — keep readable precision.
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${smallUsd(abs)}`;
}

function fullUsd(n: number, showSign: boolean): string {
  if (!Number.isFinite(n)) return 'Not available';
  if (n === 0) return '$0';
  const sign = n < 0 ? '-' : showSign ? '+' : '';
  const abs = Math.abs(n);
  // Use locale-grouping for >= $1, adaptive precision for fractional.
  if (abs >= 1) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `${sign}$${smallUsd(abs)}`;
}

export default function UsdDisplay({
  amount,
  showPositiveSign = false,
  full = false,
  className = '',
}: UsdDisplayProps) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return <span className={className}>—</span>;
  }
  const compact = compactUsd(amount, showPositiveSign);
  const exact = fullUsd(amount, showPositiveSign);
  return (
    <span
      className={className}
      title={compact !== exact ? exact : undefined}
    >
      {full ? exact : compact}
    </span>
  );
}
