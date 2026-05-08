/**
 * Regression tests for sanitizePercent (commits 02aaa1dd + 746cb288).
 *
 * Real production bug: BingX API returned `priceChangePercent: "280899.00"`
 * for SWARMS (a newly-listed coin where openPrice was 0). This propagated
 * to the momentum aggregator which picks the venue with the largest |change|
 * — letting one garbage value dominate the display for the entire symbol.
 * /momentum showed SWARMS at #1 with "+280,701%" while every other venue
 * correctly reported ~+5%.
 */
import { describe, it, expect } from 'vitest';
import { sanitizePercent } from '../sanitizePercent';

describe('sanitizePercent — basic parsing', () => {
  it('passes valid numeric values through', () => {
    expect(sanitizePercent(5.21)).toBe(5.21);
    expect(sanitizePercent(-2.78)).toBe(-2.78);
    expect(sanitizePercent(0)).toBe(0);
    expect(sanitizePercent(999.99)).toBe(999.99);
  });

  it('parses string values', () => {
    expect(sanitizePercent('5.21')).toBe(5.21);
    expect(sanitizePercent('-2.78')).toBe(-2.78);
    expect(sanitizePercent('0')).toBe(0);
  });

  it('returns 0 for unparseable input', () => {
    expect(sanitizePercent('abc')).toBe(0);
    expect(sanitizePercent(undefined)).toBe(0);
    expect(sanitizePercent(null)).toBe(0);
    expect(sanitizePercent({})).toBe(0);
    expect(sanitizePercent('')).toBe(0);
  });

  it('returns 0 for non-finite numbers', () => {
    expect(sanitizePercent(Infinity)).toBe(0);
    expect(sanitizePercent(-Infinity)).toBe(0);
    expect(sanitizePercent(NaN)).toBe(0);
  });
});

describe('sanitizePercent — outlier cap', () => {
  it('caps absurd values at the default 1000%', () => {
    expect(sanitizePercent(280_899)).toBe(0);   // BingX SWARMS bug
    expect(sanitizePercent(-99_999)).toBe(0);
    expect(sanitizePercent(1001)).toBe(0);      // just over the threshold
  });

  it('keeps values right at and below the cap', () => {
    expect(sanitizePercent(1000)).toBe(1000);   // exactly at cap = OK
    expect(sanitizePercent(999.999)).toBe(999.999);
    expect(sanitizePercent(-1000)).toBe(-1000);
  });

  it('keeps real memecoin moonshots within reason', () => {
    // Memecoins legitimately do +400% in 24h
    expect(sanitizePercent(420)).toBe(420);
    expect(sanitizePercent(-87)).toBe(-87); // crashes too
  });

  it('respects custom maxAbs', () => {
    expect(sanitizePercent(150, { maxAbs: 100 })).toBe(0);
    expect(sanitizePercent(50, { maxAbs: 100 })).toBe(50);
    expect(sanitizePercent(150, { maxAbs: 200 })).toBe(150);
  });
});

describe('sanitizePercent — openPrice guard (BingX-specific)', () => {
  it('returns 0 when openPrice is 0 (BingX newly-listed pair)', () => {
    // The actual BingX SWARMS case: openPrice="0.00000",
    // priceChangePercent="280899.00" — both reasons to reject.
    expect(sanitizePercent(280_899, { openPrice: 0 })).toBe(0);
    // Even a legitimate-looking pct should be rejected if openPrice is 0
    // (no valid baseline → the % is meaningless).
    expect(sanitizePercent(5.2, { openPrice: 0 })).toBe(0);
  });

  it('returns 0 when openPrice is negative', () => {
    expect(sanitizePercent(5.2, { openPrice: -1 })).toBe(0);
  });

  it('passes pct through when openPrice is positive', () => {
    expect(sanitizePercent(5.2, { openPrice: 100 })).toBe(5.2);
    expect(sanitizePercent(-3.8, { openPrice: 0.001 })).toBe(-3.8);
  });

  it('still caps when openPrice valid but pct is absurd', () => {
    // Defense in depth: even with a valid openPrice, reject extreme pcts.
    expect(sanitizePercent(50_000, { openPrice: 100 })).toBe(0);
  });
});
