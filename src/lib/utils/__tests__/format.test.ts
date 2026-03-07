import { describe, it, expect } from 'vitest';
import {
  isValidNumber,
  formatPrice,
  formatNumber,
  formatCompact,
  formatPercent,
  formatFundingRate,
  safeNumber,
  formatUSD,
  formatQty,
  formatLiqValue,
} from '../format';

// ─── isValidNumber ──────────────────────────────────────────────────────────

describe('isValidNumber', () => {
  it('returns true for normal numbers', () => {
    expect(isValidNumber(0)).toBe(true);
    expect(isValidNumber(1)).toBe(true);
    expect(isValidNumber(-1)).toBe(true);
    expect(isValidNumber(3.14)).toBe(true);
    expect(isValidNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it('returns false for NaN, Infinity, non-numbers', () => {
    expect(isValidNumber(NaN)).toBe(false);
    expect(isValidNumber(Infinity)).toBe(false);
    expect(isValidNumber(-Infinity)).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
    expect(isValidNumber('42')).toBe(false);
    expect(isValidNumber(true)).toBe(false);
  });
});

// ─── formatPrice ────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatPrice(null)).toBe('$0.00');
    expect(formatPrice(undefined)).toBe('$0.00');
    expect(formatPrice(NaN)).toBe('$0.00');
  });

  it('formats large prices (≥1000) with no decimals', () => {
    const result = formatPrice(65432);
    expect(result).toMatch(/^\$65,?432$/);
  });

  it('formats medium prices (1-999) with 2 decimals', () => {
    expect(formatPrice(42.567)).toBe('$42.57');
    expect(formatPrice(1)).toBe('$1.00');
  });

  it('formats small prices (0.01-0.99) with 4 decimals', () => {
    expect(formatPrice(0.05)).toBe('$0.0500');
    expect(formatPrice(0.1234)).toBe('$0.1234');
  });

  it('formats tiny prices (0.0001-0.0099) with 6 decimals', () => {
    expect(formatPrice(0.001234)).toBe('$0.001234');
  });

  it('formats very small prices (PEPE/SHIB range) with 10 decimals', () => {
    expect(formatPrice(0.00000123)).toBe('$0.0000012300');
  });

  it('formats extremely small prices with scientific notation', () => {
    const result = formatPrice(0.000000001234);
    expect(result).toMatch(/^\$\d\.\d{4}e[+-]\d+$/);
  });

  it('formats zero (falls through to scientific — known quirk)', () => {
    // 0 is not >= any positive threshold, so it hits toExponential
    expect(formatPrice(0)).toBe('$0.0000e+0');
  });

  it('handles negative prices (falls through to scientific — known quirk)', () => {
    // Negative values are not >= any positive threshold, so they hit toExponential
    expect(formatPrice(-5)).toBe('$-5.0000e+0');
  });
});

// ─── formatNumber ───────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatNumber(null)).toBe('$0');
    expect(formatNumber(undefined)).toBe('$0');
    expect(formatNumber(NaN)).toBe('$0');
  });

  it('formats trillions', () => {
    expect(formatNumber(2.5e12)).toBe('$2.50T');
  });

  it('formats billions', () => {
    expect(formatNumber(1.234e9)).toBe('$1.23B');
  });

  it('formats millions', () => {
    expect(formatNumber(5.678e6)).toBe('$5.68M');
  });

  it('formats thousands', () => {
    expect(formatNumber(42500)).toBe('$42.50K');
  });

  it('formats small numbers with locale', () => {
    const result = formatNumber(999);
    expect(result).toMatch(/^\$999/);
  });
});

// ─── formatCompact ──────────────────────────────────────────────────────────

describe('formatCompact', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatCompact(null)).toBe('0');
    expect(formatCompact(undefined)).toBe('0');
    expect(formatCompact(NaN)).toBe('0');
  });

  it('formats without $ sign', () => {
    expect(formatCompact(1.5e9)).toBe('1.50B');
    expect(formatCompact(2.3e6)).toBe('2.30M');
    expect(formatCompact(7.8e3)).toBe('7.80K');
  });

  it('formats trillions', () => {
    expect(formatCompact(3.45e12)).toBe('3.45T');
  });
});

// ─── formatPercent ──────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatPercent(null)).toBe('0.00%');
    expect(formatPercent(undefined)).toBe('0.00%');
    expect(formatPercent(NaN)).toBe('0.00%');
  });

  it('adds + sign for positive values', () => {
    expect(formatPercent(5.123)).toBe('+5.12%');
  });

  it('keeps - sign for negative values', () => {
    expect(formatPercent(-3.456)).toBe('-3.46%');
  });

  it('treats zero as positive (+ sign)', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('respects custom decimal places', () => {
    expect(formatPercent(5.12345, 4)).toBe('+5.1235%');
    expect(formatPercent(5.1, 0)).toBe('+5%');
  });
});

// ─── formatFundingRate ──────────────────────────────────────────────────────

describe('formatFundingRate', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatFundingRate(null)).toBe('0.0000%');
    expect(formatFundingRate(undefined)).toBe('0.0000%');
    expect(formatFundingRate(NaN)).toBe('0.0000%');
  });

  it('formats typical funding rates with 4 decimals', () => {
    expect(formatFundingRate(0.01)).toBe('+0.0100%');
    expect(formatFundingRate(-0.005)).toBe('-0.0050%');
  });

  it('adds + sign for positive, - for negative', () => {
    expect(formatFundingRate(0.1234)).toBe('+0.1234%');
    expect(formatFundingRate(-0.0567)).toBe('-0.0567%');
  });

  it('treats zero as positive', () => {
    expect(formatFundingRate(0)).toBe('+0.0000%');
  });
});

// ─── safeNumber ─────────────────────────────────────────────────────────────

describe('safeNumber', () => {
  it('returns number if valid', () => {
    expect(safeNumber(42)).toBe(42);
    expect(safeNumber(0)).toBe(0);
    expect(safeNumber(-10)).toBe(-10);
  });

  it('returns 0 for invalid values by default', () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
    expect(safeNumber(NaN)).toBe(0);
  });

  it('returns custom default for invalid values', () => {
    expect(safeNumber(null, -1)).toBe(-1);
    expect(safeNumber(undefined, 99)).toBe(99);
    expect(safeNumber(NaN, 42)).toBe(42);
  });
});

// ─── formatUSD ──────────────────────────────────────────────────────────────

describe('formatUSD', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatUSD(null)).toBe('$0');
    expect(formatUSD(undefined)).toBe('$0');
    expect(formatUSD(NaN)).toBe('$0');
  });

  it('formats billions', () => {
    expect(formatUSD(5.678e9)).toBe('$5.68B');
  });

  it('formats millions', () => {
    expect(formatUSD(12.345e6)).toBe('$12.35M');
  });

  it('formats thousands with 1 decimal by default', () => {
    expect(formatUSD(42500)).toBe('$42.5K');
  });

  it('formats small values with 0 decimals by default', () => {
    expect(formatUSD(999)).toBe('$999');
  });

  it('handles negative values with sign prefix', () => {
    expect(formatUSD(-5e6)).toBe('-$5.00M');
    expect(formatUSD(-1500)).toBe('-$1.5K');
  });

  it('respects custom decimals', () => {
    expect(formatUSD(5.678e9, 0)).toBe('$6B');
    expect(formatUSD(42500, 3)).toBe('$42.500K');
  });
});

// ─── formatQty ──────────────────────────────────────────────────────────────

describe('formatQty', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatQty(null)).toBe('0');
    expect(formatQty(undefined)).toBe('0');
    expect(formatQty(NaN)).toBe('0');
  });

  it('formats millions with 4 decimals + M suffix', () => {
    expect(formatQty(2500000)).toBe('2.5000M');
  });

  it('formats thousands with 4 decimals + K suffix', () => {
    expect(formatQty(1500)).toBe('1.5000K');
  });

  it('formats ≥1 with 4 decimals', () => {
    expect(formatQty(5.5)).toBe('5.5000');
  });

  it('formats <1 with 8 decimals', () => {
    expect(formatQty(0.123)).toBe('0.12300000');
  });
});

// ─── formatLiqValue ─────────────────────────────────────────────────────────

describe('formatLiqValue', () => {
  it('handles null/undefined/NaN', () => {
    expect(formatLiqValue(null)).toBe('$0');
    expect(formatLiqValue(undefined)).toBe('$0');
    expect(formatLiqValue(NaN)).toBe('$0');
  });

  it('formats millions', () => {
    expect(formatLiqValue(2.5e6)).toBe('$2.50M');
  });

  it('formats thousands with 1 decimal', () => {
    expect(formatLiqValue(42500)).toBe('$42.5K');
  });

  it('formats small values with 0 decimals', () => {
    expect(formatLiqValue(500)).toBe('$500');
  });
});
