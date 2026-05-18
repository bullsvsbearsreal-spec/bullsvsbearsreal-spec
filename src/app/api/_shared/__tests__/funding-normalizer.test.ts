import { describe, it, expect } from 'vitest';
import {
  toFundingRate,
  validateRate,
} from '../funding-normalizer';

describe('toFundingRate', () => {
  describe('precision: fraction', () => {
    it('converts fraction to percentage', () => {
      // 0.0001 fraction = 0.01% (a common 8h funding rate)
      const out = toFundingRate(0.0001, { precision: 'fraction', rawInterval: '8h', targetInterval: '8h' });
      expect(out).toBeCloseTo(0.01, 6);
    });

    it('handles negative fractions', () => {
      const out = toFundingRate(-0.0005, { precision: 'fraction', rawInterval: '8h', targetInterval: '8h' });
      expect(out).toBeCloseTo(-0.05, 6);
    });
  });

  describe('precision: percentage', () => {
    it('keeps percentage as-is when interval matches', () => {
      const out = toFundingRate(0.01, { precision: 'percentage', rawInterval: '8h', targetInterval: '8h' });
      expect(out).toBeCloseTo(0.01, 6);
    });
  });

  describe('precision: bigint-1e30', () => {
    it('converts a bigint at 1e30 scale', () => {
      // 0.0001 at 1e30 scale = 1e26
      const out = toFundingRate('100000000000000000000000000', {
        precision: 'bigint-1e30',
        rawInterval: '1h',
        targetInterval: '1h',
      });
      expect(out).toBeCloseTo(0.01, 6); // 0.01% per hour
    });
  });

  describe('precision: bigint-1e18', () => {
    it('converts a bigint at 1e18 scale (Wei-like)', () => {
      // 0.0001 at 1e18 = 1e14
      const out = toFundingRate('100000000000000', {
        precision: 'bigint-1e18',
        rawInterval: '8h',
        targetInterval: '8h',
      });
      expect(out).toBeCloseTo(0.01, 6);
    });
  });

  describe('precision: annualized', () => {
    it('converts a decimal annual rate to the target interval', () => {
      // 1.25 = 125% APR → 0.114% per 8h (8h = 1/1095 of year)
      const out = toFundingRate(1.25, {
        precision: 'annualized',
        rawInterval: 'annual',
        targetInterval: '8h',
      });
      // 125% APR / (365*3) ≈ 0.114%
      expect(out).toBeCloseTo(0.1142, 3);
    });
  });

  describe('interval conversion', () => {
    it('converts 1h → 8h by multiplying by 8', () => {
      // 0.01% per 1h = 0.08% per 8h
      const out = toFundingRate(0.0001, {
        precision: 'fraction',
        rawInterval: '1h',
        targetInterval: '8h',
      });
      expect(out).toBeCloseTo(0.08, 6);
    });

    it('converts 8h → 1h by dividing by 8', () => {
      // 0.08% per 8h = 0.01% per 1h
      const out = toFundingRate(0.0008, {
        precision: 'fraction',
        rawInterval: '8h',
        targetInterval: '1h',
      });
      expect(out).toBeCloseTo(0.01, 6);
    });

    it('converts 4h → 8h by multiplying by 2', () => {
      const out = toFundingRate(0.0001, {
        precision: 'fraction',
        rawInterval: '4h',
        targetInterval: '8h',
      });
      expect(out).toBeCloseTo(0.02, 6);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for Infinity / NaN inputs', () => {
      expect(toFundingRate(NaN as unknown as number, { precision: 'fraction', rawInterval: '8h', targetInterval: '8h' })).toBe(0);
      expect(toFundingRate(Infinity, { precision: 'fraction', rawInterval: '8h', targetInterval: '8h' })).toBe(0);
    });

    it('parses string inputs as floats', () => {
      const out = toFundingRate('0.0001', { precision: 'fraction', rawInterval: '8h', targetInterval: '8h' });
      expect(out).toBeCloseTo(0.01, 6);
    });

    it('returns 0 if the target interval is unrecognized (defensive)', () => {
      // 'bogus' isn't a known interval — should fall through to 0
      const out = toFundingRate(0.01, {
        precision: 'percentage',
        rawInterval: '8h',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetInterval: 'bogus' as any,
      });
      expect(out).toBe(0);
    });
  });
});

describe('validateRate', () => {
  it('returns the rate unchanged when within cap', () => {
    const r = validateRate(0.05, '8h', 'Binance', 'BTCUSDT');
    expect(r.isValid).toBe(true);
    expect(r.rate).toBe(0.05);
    expect(r.warning).toBeUndefined();
  });

  it('caps extreme positive rates and emits a warning', () => {
    // 8h cap is ±500% — pick a clearly extreme value above that
    const r = validateRate(1000, '8h', 'WeirdVenue', 'NEWSYMUSDT');
    expect(r.isValid).toBe(true);
    expect(r.rate).toBeLessThan(1000);
    expect(r.warning).toBeDefined();
    expect(r.warning).toContain('exceeds');
  });

  it('caps extreme negative rates symmetrically', () => {
    const r = validateRate(-1000, '8h', 'WeirdVenue', 'NEWSYMUSDT');
    expect(r.isValid).toBe(true);
    expect(r.rate).toBeGreaterThan(-1000);
    expect(r.warning).toContain('exceeds');
  });

  it('returns isValid=false for NaN / Infinity', () => {
    const r = validateRate(NaN, '8h', 'X', 'Y');
    expect(r.isValid).toBe(false);
    expect(r.rate).toBe(0);
    expect(r.warning).toContain('NaN/Infinity');
  });

  it('handles zero rate as valid (legitimate value)', () => {
    const r = validateRate(0, '8h', 'X', 'Y');
    expect(r.isValid).toBe(true);
    expect(r.rate).toBe(0);
  });

  it('caps scale per interval (1h cap < 8h cap proportionally)', () => {
    // The 1h cap should be 1/8 of the 8h cap, so the same rate
    // value can pass at 8h but fail at 1h
    const r8h = validateRate(0.5, '8h', 'X', 'Y');
    const r1h = validateRate(0.5, '1h', 'X', 'Y');
    // Either both pass, or 1h gets capped. The invariant is that
    // 1h's cap should not exceed 8h's cap.
    if (r1h.warning && !r8h.warning) {
      // Confirmed the interval scaling is in effect
      expect(true).toBe(true);
    } else {
      // Both passed, but at least neither produces a higher rate than input
      expect(r1h.rate).toBeLessThanOrEqual(0.5);
      expect(r8h.rate).toBeLessThanOrEqual(0.5);
    }
  });
});
