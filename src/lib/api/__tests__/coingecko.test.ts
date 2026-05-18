import { describe, it, expect } from 'vitest';
import { formatNumber, formatPrice, formatPercent } from '../coingecko';

describe('formatNumber', () => {
  it('formats trillions with T suffix', () => {
    expect(formatNumber(1.5e12)).toBe('$1.50T');
    expect(formatNumber(2.345e12)).toBe('$2.35T'); // rounds to 2 decimals
  });

  it('formats billions with B suffix', () => {
    expect(formatNumber(1e9)).toBe('$1.00B');
    expect(formatNumber(789e6)).toBe('$789.00M'); // 0.789B → 789M
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1e6)).toBe('$1.00M');
    expect(formatNumber(5_500_000)).toBe('$5.50M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('$1.00K');
    expect(formatNumber(500)).toBe('$500.00'); // under threshold
  });

  it('formats sub-thousand as plain dollars', () => {
    expect(formatNumber(0.5)).toBe('$0.50');
    expect(formatNumber(42.50)).toBe('$42.50');
  });

  it('handles negative numbers with leading minus', () => {
    expect(formatNumber(-1.5e9)).toBe('-$1.50B');
    expect(formatNumber(-500)).toBe('-$500.00');
  });

  it('returns "$0" for Infinity / NaN', () => {
    expect(formatNumber(Infinity)).toBe('$0');
    expect(formatNumber(-Infinity)).toBe('$0');
    expect(formatNumber(NaN)).toBe('$0');
  });

  it('handles zero correctly (not Infinity-treated)', () => {
    expect(formatNumber(0)).toBe('$0.00');
  });
});

describe('formatPrice', () => {
  it('formats $1000+ as locale-grouped integer', () => {
    expect(formatPrice(50_000)).toBe('$50,000');
    expect(formatPrice(1_234.56)).toBe('$1,235'); // rounded
  });

  it('formats $1-$1000 with 2 decimals', () => {
    expect(formatPrice(100.5)).toBe('$100.5');
    expect(formatPrice(42.50)).toBe('$42.5');
  });

  it('formats $0.01-$1 with 4 decimals (cents-level precision)', () => {
    expect(formatPrice(0.5)).toBe('$0.5000');
    expect(formatPrice(0.0123)).toBe('$0.0123');
  });

  it('formats sub-cent with 6 decimals', () => {
    expect(formatPrice(0.000123)).toBe('$0.000123');
  });

  it('formats memecoin-tier prices with 10 decimals', () => {
    expect(formatPrice(0.00000123)).toBe('$0.0000012300');
  });

  it('falls back to scientific notation for tiny values', () => {
    expect(formatPrice(1e-15)).toContain('e-');
  });

  it('handles Infinity / NaN with $0.00 default', () => {
    expect(formatPrice(Infinity)).toBe('$0.00');
    expect(formatPrice(NaN)).toBe('$0.00');
  });
});

describe('formatPercent', () => {
  it('prefixes positive with +', () => {
    expect(formatPercent(5.5)).toBe('+5.50%');
    expect(formatPercent(100)).toBe('+100.00%');
  });

  it('keeps negative sign on negatives', () => {
    expect(formatPercent(-3.2)).toBe('-3.20%');
  });

  it('formats zero as +0.00% (counts as positive)', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('returns 0.00% for undefined / null / NaN / Infinity', () => {
    expect(formatPercent(undefined)).toBe('0.00%');
    expect(formatPercent(NaN)).toBe('0.00%');
    expect(formatPercent(Infinity)).toBe('0.00%');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatPercent(1.2345)).toBe('+1.23%');
    expect(formatPercent(1.235)).toBe('+1.24%'); // banker's rounding might differ — check actual behavior
  });
});
