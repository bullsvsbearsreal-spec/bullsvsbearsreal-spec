import { describe, it, expect } from 'vitest';
import { computeGTradeCost, type GTradeParams } from '../gtrade';

function makeParams(overrides: Partial<GTradeParams> = {}): GTradeParams {
  return {
    pairIndex: 0,
    midPrice: 50000,
    depthAbove: 5_000_000,
    depthBelow: 5_000_000,
    longOi: 1_000_000,
    shortOi: 1_000_000,
    baseFeeP: 0.06,
    ...overrides,
  };
}

describe('computeGTradeCost', () => {
  it('returns expected shape: { priceImpact, executionPrice, midPrice }', () => {
    const out = computeGTradeCost(makeParams(), 100_000, 'long');
    expect(typeof out.priceImpact).toBe('number');
    expect(typeof out.executionPrice).toBe('number');
    expect(out.midPrice).toBe(50000);
  });

  it('uses depth-based formula when depthAbove > 0 (for longs)', () => {
    // depthAbove=5M, longOi=1M, size=200k → impact = (1M + 200k/2) / 5M = 0.22
    const out = computeGTradeCost(
      makeParams({ depthAbove: 5_000_000, longOi: 1_000_000 }),
      200_000,
      'long',
    );
    expect(out.priceImpact).toBeCloseTo(0.22, 5);
  });

  it('uses depthBelow for shorts (not depthAbove)', () => {
    const out = computeGTradeCost(
      makeParams({ depthAbove: 1_000_000, depthBelow: 5_000_000, shortOi: 1_000_000 }),
      200_000,
      'short',
    );
    // Should use depthBelow (5M), not depthAbove (1M) — confirming side-correctness
    expect(out.priceImpact).toBeCloseTo(0.22, 5);
  });

  it('falls back to OI skew formula when depth is 0', () => {
    const out = computeGTradeCost(
      makeParams({ depthAbove: 0, depthBelow: 0, longOi: 1_000_000, shortOi: 1_000_000 }),
      100_000,
      'long',
    );
    // Fallback: (100k / 2M) * 0.5 = 0.025
    expect(out.priceImpact).toBeCloseTo(0.025, 5);
  });

  it('returns 0 impact when both depth and OI are unavailable', () => {
    const out = computeGTradeCost(
      makeParams({ depthAbove: 0, depthBelow: 0, longOi: 0, shortOi: 0 }),
      100_000,
      'long',
    );
    expect(out.priceImpact).toBe(0);
  });

  it('long execution price > mid (impact adds)', () => {
    const out = computeGTradeCost(makeParams(), 100_000, 'long');
    if (out.priceImpact > 0) {
      expect(out.executionPrice).toBeGreaterThan(out.midPrice);
    }
  });

  it('short execution price < mid (impact subtracts)', () => {
    const out = computeGTradeCost(makeParams(), 100_000, 'short');
    if (out.priceImpact > 0) {
      expect(out.executionPrice).toBeLessThan(out.midPrice);
    }
  });

  it('passes midPrice through unchanged', () => {
    const out = computeGTradeCost(makeParams({ midPrice: 1234.56 }), 100_000, 'long');
    expect(out.midPrice).toBe(1234.56);
  });

  it('scales linearly with current OI (more OI → more impact at same depth)', () => {
    const lowOi = computeGTradeCost(makeParams({ longOi: 100_000 }), 100_000, 'long');
    const highOi = computeGTradeCost(makeParams({ longOi: 4_000_000 }), 100_000, 'long');
    expect(highOi.priceImpact).toBeGreaterThan(lowOi.priceImpact);
  });

  it('scales with order size at the same depth', () => {
    const small = computeGTradeCost(makeParams(), 10_000, 'long');
    const big = computeGTradeCost(makeParams(), 1_000_000, 'long');
    expect(big.priceImpact).toBeGreaterThan(small.priceImpact);
  });
});
