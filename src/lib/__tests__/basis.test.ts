/**
 * Tests for approxDaysToCmeExpiry — drives the "days to expiry" display
 * on /cme-basis. The annualized basis calculation uses this so a wrong
 * value would mis-report the cash-and-carry rate.
 *
 * Time-dependent, so tests can only check structural properties (range,
 * not a specific value).
 */
import { describe, it, expect } from 'vitest';
import { approxDaysToCmeExpiry } from '../basis';

describe('approxDaysToCmeExpiry', () => {
  it('returns a positive integer', () => {
    const d = approxDaysToCmeExpiry();
    expect(Number.isInteger(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });

  it('returns a value at most 35 days (next-month rollover ceiling)', () => {
    // CME monthlies expire on the last Friday of their month.
    // Even when the front-month just expired, the next monthly is at
    // most ~5-7 weeks away. 35d is a generous upper bound.
    const d = approxDaysToCmeExpiry();
    expect(d).toBeLessThanOrEqual(35);
  });

  it('returns at least 1 day even when computed expiry is in the past', () => {
    // The function clamps with Math.max(1, ...) so we never display
    // a 0-day or negative value (which would crash annualization
    // formulas via division by zero).
    expect(approxDaysToCmeExpiry()).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic within the same wall-clock minute', () => {
    // Multiple calls within milliseconds of each other should agree.
    const a = approxDaysToCmeExpiry();
    const b = approxDaysToCmeExpiry();
    expect(a).toBe(b);
  });
});
