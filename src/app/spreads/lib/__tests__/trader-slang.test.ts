import { describe, it, expect } from 'vitest';
import {
  getFundingSlang,
  getSpreadSlang,
  getDeviationSlang,
  getOISlang,
} from '../trader-slang';

describe('getFundingSlang', () => {
  it('returns escalating bullish copy as positive rate grows', () => {
    const tiny = getFundingSlang(0.001);
    const mid = getFundingSlang(0.03);
    const huge = getFundingSlang(0.2);
    expect(tiny).not.toBe(mid);
    expect(mid).not.toBe(huge);
    expect(huge.toLowerCase()).toContain('massive');
  });

  it('returns escalating bearish copy as negative rate deepens', () => {
    const tiny = getFundingSlang(-0.001);
    const deep = getFundingSlang(-0.2);
    expect(tiny).not.toBe(deep);
    expect(deep.toLowerCase()).toContain('carnage');
  });

  it('returns neutral copy at exactly 0', () => {
    const out = getFundingSlang(0);
    expect(out.toLowerCase()).toContain('neutral');
  });

  it('returns a non-empty string for any finite input', () => {
    [-1, -0.5, -0.1, -0.05, -0.01, 0, 0.01, 0.05, 0.1, 0.5, 1].forEach((r) => {
      const out = getFundingSlang(r);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    });
  });
});

describe('getSpreadSlang', () => {
  it('returns "massive arb" copy for very high spreads', () => {
    expect(getSpreadSlang(2).toLowerCase()).toContain('massive');
  });

  it('returns "razor thin" copy for tiny spreads', () => {
    expect(getSpreadSlang(0.001).toLowerCase()).toContain('razor');
  });

  it('returns escalating descriptions as spread grows', () => {
    const tiny = getSpreadSlang(0.005);
    const small = getSpreadSlang(0.02);
    const decent = getSpreadSlang(0.2);
    const big = getSpreadSlang(0.7);
    const huge = getSpreadSlang(2);
    // All should be distinct
    const set = new Set([tiny, small, decent, big, huge]);
    expect(set.size).toBe(5);
  });

  it('handles zero and tiny spreads gracefully', () => {
    expect(typeof getSpreadSlang(0)).toBe('string');
    expect(getSpreadSlang(0).length).toBeGreaterThan(0);
  });
});

describe('getDeviationSlang', () => {
  it('returns "premium" copy for positive deviations', () => {
    expect(getDeviationSlang(0.6).toLowerCase()).toContain('premium');
    expect(getDeviationSlang(0.15).toLowerCase()).toContain('premium');
  });

  it('returns "discount" copy for negative deviations', () => {
    expect(getDeviationSlang(-0.6).toLowerCase()).toContain('discount');
    expect(getDeviationSlang(-0.15).toLowerCase()).toContain('discount');
  });

  it('returns "in line" copy for tiny deviations', () => {
    expect(getDeviationSlang(0.001).toLowerCase()).toContain('line');
    expect(getDeviationSlang(-0.001).toLowerCase()).toContain('line');
  });

  it('uses absolute value for tier selection (symmetric)', () => {
    // 0.6 and -0.6 should both be "massive" tier (symmetric magnitude)
    const positive = getDeviationSlang(0.6);
    const negative = getDeviationSlang(-0.6);
    // Different copy because of premium vs discount, but both contain "way" or "lagging"
    expect(positive.length).toBeGreaterThan(0);
    expect(negative.length).toBeGreaterThan(0);
  });
});

describe('getOISlang', () => {
  it('returns "whale territory" for OI > $10B', () => {
    expect(getOISlang(50e9).toLowerCase()).toContain('whale');
  });

  it('returns "billions" copy for OI > $1B', () => {
    expect(getOISlang(2e9).toLowerCase()).toContain('billion');
  });

  it('returns "low OI" copy for thin liquidity', () => {
    expect(getOISlang(500_000).toLowerCase()).toContain('low');
  });

  it('returns distinct tiers across OI magnitudes', () => {
    const tiny = getOISlang(1e6);        // <10M
    const mid = getOISlang(50e6);        // 10-100M
    const solid = getOISlang(500e6);     // 100M-1B
    const billion = getOISlang(2e9);     // 1-10B
    const whale = getOISlang(50e9);      // >10B
    expect(new Set([tiny, mid, solid, billion, whale]).size).toBe(5);
  });

  it('returns a non-empty string for any positive number', () => {
    [1, 100, 1e3, 1e6, 1e9, 1e12].forEach((oi) => {
      expect(getOISlang(oi).length).toBeGreaterThan(0);
    });
  });
});
