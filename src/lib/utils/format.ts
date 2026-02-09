// Safe number formatting utilities

export type SafeNumber = number | null | undefined;

/**
 * Check if a value is a valid, finite number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Safely format a price with proper decimal places
 * Handles very small prices like PEPE, SHIB, BONK, etc.
 */
export function formatPrice(num: SafeNumber): string {
  if (num === undefined || num === null || isNaN(num)) return '$0.00';
  if (num >= 1000) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  if (num >= 0.00000001) return `$${num.toFixed(10)}`;
  // For extremely small numbers - use scientific notation
  return `$${num.toExponential(4)}`;
}

/**
 * Format large numbers with K, M, B, T suffixes
 */
export function formatNumber(num: SafeNumber): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toLocaleString()}`;
}

/**
 * Format compact numbers without $ sign
 */
export function formatCompact(num: SafeNumber): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

/**
 * Format percentage with sign
 */
export function formatPercent(num: SafeNumber, decimals: number = 2): string {
  if (num === undefined || num === null || isNaN(num)) return '0.00%';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Format funding rate (typically small percentages)
 */
export function formatFundingRate(num: SafeNumber): string {
  if (num === undefined || num === null || isNaN(num)) return '0.0000%';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(4)}%`;
}

/**
 * Safe number getter with default
 */
export function safeNumber(num: SafeNumber, defaultValue: number = 0): number {
  if (num === undefined || num === null || isNaN(num)) return defaultValue;
  return num;
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Format timestamp to local time
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
