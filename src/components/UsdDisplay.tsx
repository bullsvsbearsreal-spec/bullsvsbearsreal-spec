'use client';

/**
 * Renders a USD amount in compact form (e.g. $10.4M) with a `title` tooltip
 * showing the full precision ($10,386,402). Drop-in wherever you currently
 * render `fmtUSD(x)` inside JSX and want hover-for-exact behavior.
 *
 * Keeps the visual exactly the same — the only addition is the tooltip on hover.
 */

interface UsdDisplayProps {
  amount: number | null | undefined;
  /** Whether to render the sign when positive (e.g. +$10.4M). Default: false */
  showPositiveSign?: boolean;
  /** Override the compact behavior (render full inline) */
  full?: boolean;
  className?: string;
}

function compactUsd(n: number, showSign: boolean): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : showSign ? '+' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fullUsd(n: number, showSign: boolean): string {
  if (!Number.isFinite(n)) return 'Not available';
  if (n === 0) return '$0';
  const sign = n < 0 ? '-' : showSign ? '+' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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
