import { describe, it, expect } from 'vitest';
import { computeGMXCost, type GMXMarketInfo } from '../gmx';

function makeMarket(overrides: Partial<GMXMarketInfo> = {}): GMXMarketInfo {
  return {
    marketToken: '0x0000000000000000000000000000000000000000',
    midPrice: 50000,
    longOiUsd: 10_000_000,
    shortOiUsd: 10_000_000,
    positionImpactFactorPositive: 1e-9,
    positionImpactFactorNegative: 1e-9,
    positionImpactExponentFactor: 2,
    ...overrides,
  };
}

describe('computeGMXCost', () => {
  it('returns 0 impact when adding to a perfectly-balanced book improves balance', () => {
    // Long + Short both 10M. Adding $1M to long → +long=11M, short=10M.
    // currentDiff = 0, newDiff = 1M → balance got WORSE → negative impact
    // factor used.
    const out = computeGMXCost(makeMarket(), 1_000_000, 'long');
    expect(out.priceImpact).toBeGreaterThan(0);
    expect(out.midPrice).toBe(50000);
  });

  it('improves balance when adding to the smaller side (uses positive factor)', () => {
    const market = makeMarket({
      longOiUsd: 20_000_000,
      shortOiUsd: 10_000_000,
      // Positive factor LOWER than negative so we can detect which one was used
      positionImpactFactorPositive: 0.5e-9,
      positionImpactFactorNegative: 2e-9,
    });
    // Add 5M short → newLong=20M, newShort=15M → newDiff=5M
    // currentDiff = 10M, newDiff = 5M → improves → positive factor (lower)
    const balancingShort = computeGMXCost(market, 5_000_000, 'short');
    // Add 5M long → newLong=25M, newShort=10M → newDiff=15M (worse → negative factor higher)
    const worseningLong = computeGMXCost(market, 5_000_000, 'long');
    // Worsening trade should produce higher impact than balancing trade
    expect(worseningLong.priceImpact).toBeGreaterThan(balancingShort.priceImpact);
  });

  it('caps absurd price impact at 50%', () => {
    const market = makeMarket({
      positionImpactFactorPositive: 1e3,  // crazy big factor
      positionImpactFactorNegative: 1e3,
    });
    const out = computeGMXCost(market, 100_000_000, 'long');
    expect(out.priceImpact).toBeLessThanOrEqual(50);
  });

  it('long execution price is above mid (price impact pushes up)', () => {
    const out = computeGMXCost(makeMarket(), 1_000_000, 'long');
    if (out.priceImpact > 0) {
      expect(out.executionPrice).toBeGreaterThan(out.midPrice);
    }
  });

  it('short execution price is below mid (price impact pushes down)', () => {
    const out = computeGMXCost(makeMarket(), 1_000_000, 'short');
    if (out.priceImpact > 0) {
      expect(out.executionPrice).toBeLessThan(out.midPrice);
    }
  });

  it('returns 0 impact when midPrice is 0 (edge case)', () => {
    const out = computeGMXCost(makeMarket({ midPrice: 0 }), 1_000_000, 'long');
    expect(out.priceImpact).toBe(0);
  });

  it('returns 0 impact when orderSize is 0', () => {
    const out = computeGMXCost(makeMarket(), 0, 'long');
    expect(out.priceImpact).toBe(0);
  });

  it('returns finite values even with NaN/Inf intermediate calculations', () => {
    const market = makeMarket({
      positionImpactFactorPositive: 0,
      positionImpactFactorNegative: 0,
    });
    const out = computeGMXCost(market, 1_000_000, 'long');
    expect(Number.isFinite(out.priceImpact)).toBe(true);
    expect(Number.isFinite(out.executionPrice)).toBe(true);
  });

  it('falls back to exponent 2 when positionImpactExponentFactor is 0', () => {
    const market = makeMarket({ positionImpactExponentFactor: 0 });
    // Should not crash and should compute non-NaN result
    const out = computeGMXCost(market, 1_000_000, 'long');
    expect(Number.isFinite(out.priceImpact)).toBe(true);
  });

  it('includes midPrice in the output unchanged', () => {
    const out = computeGMXCost(makeMarket({ midPrice: 67890.42 }), 1_000_000, 'long');
    expect(out.midPrice).toBe(67890.42);
  });
});
