/**
 * Tests for the per-page coingecko formatters used by /coin/[id] and
 * the home CoinCard. These exist as a separate set from
 * lib/utils/format.ts (which is also tested) — locking down both so a
 * refactor that consolidates them into one helper doesn't silently
 * change either page's display.
 */
import { describe, it, expect } from 'vitest';
import { formatNumber, formatPrice, formatPercent } from '../coingecko';

describe('formatNumber — coingecko (large positive amounts only)', () => {
  it('formats trillions / billions / millions / thousands', () => {
    expect(formatNumber(1.5e12)).toBe('$1.50T');
    expect(formatNumber(2.34e9)).toBe('$2.34B');
    expect(formatNumber(5.5e6)).toBe('$5.50M');
    expect(formatNumber(50_000)).toBe('$50.00K');
  });

  it('falls back to plain $X.XX for sub-1000 amounts', () => {
    expect(formatNumber(500)).toBe('$500.00');
    expect(formatNumber(0.5)).toBe('$0.50');
    expect(formatNumber(0)).toBe('$0.00');
  });

  it('returns "$0" for non-finite input', () => {
    expect(formatNumber(NaN)).toBe('$0');
    expect(formatNumber(Infinity)).toBe('$0');
    expect(formatNumber(-Infinity)).toBe('$0');
  });

  it('boundary at exactly 1K, 1M, 1B, 1T uses the higher suffix', () => {
    expect(formatNumber(1_000)).toBe('$1.00K');
    expect(formatNumber(1_000_000)).toBe('$1.00M');
    expect(formatNumber(1_000_000_000)).toBe('$1.00B');
    expect(formatNumber(1_000_000_000_000)).toBe('$1.00T');
  });

  it('known limitation: negative numbers fall through to raw $-N.XX', () => {
    // Locked-in: market cap / volume is never negative in practice. If
    // a refactor adds proper negative handling (sign-aware suffix), this
    // test should be updated rather than silently regressed.
    expect(formatNumber(-5_000_000_000)).toBe('$-5000000000.00');
  });
});

describe('formatPrice — coingecko', () => {
  it('large prices render with no decimals + locale separators', () => {
    expect(formatPrice(74_321)).toBe('$74,321');
    expect(formatPrice(1234)).toBe('$1,234');
  });

  it('mid-range prices render with up to 2 decimals', () => {
    expect(formatPrice(100)).toBe('$100');
    expect(formatPrice(1.234)).toBe('$1.23');
    expect(formatPrice(1)).toBe('$1');
  });

  it('low-price tiers each get more decimals', () => {
    expect(formatPrice(0.5)).toBe('$0.5000');
    expect(formatPrice(0.0123)).toBe('$0.0123');
    expect(formatPrice(0.00045)).toBe('$0.000450');
    expect(formatPrice(0.0000012345)).toBe('$0.0000012345');
  });

  it('extreme micro-prices use exponential notation', () => {
    const r = formatPrice(1e-12);
    expect(r).toContain('e-');
    expect(r.startsWith('$')).toBe(true);
  });

  it('returns "$0.00" for non-finite input', () => {
    expect(formatPrice(NaN)).toBe('$0.00');
    expect(formatPrice(Infinity)).toBe('$0.00');
  });
});

describe('formatPercent — coingecko', () => {
  it('positive numbers get a "+" prefix', () => {
    expect(formatPercent(5.234)).toBe('+5.23%');
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('negative numbers render with their own minus sign (no extra +)', () => {
    expect(formatPercent(-3.5)).toBe('-3.50%');
  });

  it('always uses 2 decimal places', () => {
    expect(formatPercent(0.1)).toBe('+0.10%');
    expect(formatPercent(0.123456)).toBe('+0.12%');
  });

  it('handles undefined / null / NaN as "0.00%"', () => {
    expect(formatPercent(undefined)).toBe('0.00%');
    expect(formatPercent(null as any)).toBe('0.00%');
    expect(formatPercent(NaN)).toBe('0.00%');
    expect(formatPercent(Infinity)).toBe('0.00%');
  });
});
