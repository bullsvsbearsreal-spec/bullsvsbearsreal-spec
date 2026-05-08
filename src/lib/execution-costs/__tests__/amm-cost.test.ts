/**
 * Tests for the AMM-style price impact calculators (gTrade, GMX) used by
 * /trade-optimizer. These don't have orderbooks — impact is derived from
 * OI skew + depth params. A regression here would mis-rank these venues
 * against CLOB venues, telling users the wrong "cheapest fill".
 *
 * Critical invariants:
 *   - Long uses positive sign on executionPrice; short uses negative.
 *   - Impact is non-negative (it's a cost, not a discount).
 *   - GMX caps impact at 50% to guard against formula edge cases that
 *     produce absurd values when factors are misconfigured.
 */
import { describe, it, expect } from 'vitest';
import { computeGTradeCost, type GTradeParams } from '../venues/gtrade';
import { computeGMXCost, type GMXMarketInfo } from '../venues/gmx';

const G_BASE: GTradeParams = {
  pairIndex: 0,
  midPrice: 100,
  depthAbove: 1_000_000,
  depthBelow: 1_000_000,
  longOi: 500_000,
  shortOi: 500_000,
  baseFeeP: 0.05,
};

const M_BASE: GMXMarketInfo = {
  marketToken: '0xfoo',
  midPrice: 100,
  longOiUsd: 1_000_000,
  shortOiUsd: 1_000_000,
  positionImpactFactorPositive: 1e-12, // typical small factor
  positionImpactFactorNegative: 2e-12,
  positionImpactExponentFactor: 2,
};

describe('computeGTradeCost', () => {
  it('long execution price is above mid; short below', () => {
    const long = computeGTradeCost(G_BASE, 10_000, 'long');
    const short = computeGTradeCost(G_BASE, 10_000, 'short');
    expect(long.executionPrice).toBeGreaterThan(100);
    expect(short.executionPrice).toBeLessThan(100);
  });

  it('priceImpact is positive (it is a cost)', () => {
    expect(computeGTradeCost(G_BASE, 10_000, 'long').priceImpact).toBeGreaterThan(0);
    expect(computeGTradeCost(G_BASE, 10_000, 'short').priceImpact).toBeGreaterThan(0);
  });

  it('larger order → larger impact (monotone)', () => {
    const small = computeGTradeCost(G_BASE, 10_000, 'long').priceImpact;
    const big = computeGTradeCost(G_BASE, 500_000, 'long').priceImpact;
    expect(big).toBeGreaterThan(small);
  });

  it('returns midPrice unchanged in the response', () => {
    expect(computeGTradeCost(G_BASE, 10_000, 'long').midPrice).toBe(100);
  });

  it('falls back to OI-skew estimate when depth is 0', () => {
    const params: GTradeParams = { ...G_BASE, depthAbove: 0, depthBelow: 0 };
    const r = computeGTradeCost(params, 100_000, 'long');
    // Should still produce some non-negative impact via fallback.
    expect(r.priceImpact).toBeGreaterThan(0);
    expect(Number.isFinite(r.priceImpact)).toBe(true);
  });

  it('zero impact when both depth and OI are zero', () => {
    const params: GTradeParams = {
      ...G_BASE, depthAbove: 0, depthBelow: 0, longOi: 0, shortOi: 0,
    };
    const r = computeGTradeCost(params, 10_000, 'long');
    expect(r.priceImpact).toBe(0);
  });
});

describe('computeGMXCost — direction signs', () => {
  it('long execution price is above mid; short below', () => {
    const long = computeGMXCost(M_BASE, 10_000, 'long');
    const short = computeGMXCost(M_BASE, 10_000, 'short');
    expect(long.executionPrice).toBeGreaterThanOrEqual(100);
    expect(short.executionPrice).toBeLessThanOrEqual(100);
  });

  it('priceImpact is non-negative', () => {
    // GMX uses signed deltas internally but the surfaced impact is abs.
    expect(computeGMXCost(M_BASE, 10_000, 'long').priceImpact).toBeGreaterThanOrEqual(0);
    expect(computeGMXCost(M_BASE, 10_000, 'short').priceImpact).toBeGreaterThanOrEqual(0);
  });

  it('caps priceImpact at 50% to guard against absurd factor values', () => {
    // Pathological config: huge factor could in theory produce >50% impact.
    const market: GMXMarketInfo = { ...M_BASE, positionImpactFactorNegative: 1e6 };
    const r = computeGMXCost(market, 1_000_000_000, 'long');
    expect(r.priceImpact).toBeLessThanOrEqual(50);
  });

  it('returns 0 impact when factors are 0 (no skew penalty configured)', () => {
    const market: GMXMarketInfo = {
      ...M_BASE,
      positionImpactFactorPositive: 0,
      positionImpactFactorNegative: 0,
    };
    const r = computeGMXCost(market, 10_000, 'long');
    expect(r.priceImpact).toBe(0);
  });

  it('returns 0 impact when midPrice or order size is 0 (defensive)', () => {
    expect(computeGMXCost(M_BASE, 0, 'long').priceImpact).toBe(0);
    expect(computeGMXCost({ ...M_BASE, midPrice: 0 }, 10_000, 'long').priceImpact).toBe(0);
  });

  it('rebalancing trade (long when shorts dominate) uses positive factor', () => {
    // longOi << shortOi → long order improves balance.
    const market: GMXMarketInfo = {
      ...M_BASE,
      longOiUsd: 100_000,
      shortOiUsd: 1_000_000,
      positionImpactFactorPositive: 1e-13,
      positionImpactFactorNegative: 1e-12, // 10x larger
    };
    const r = computeGMXCost(market, 100_000, 'long');
    // Should use the (smaller) positive factor → smaller impact than
    // a corresponding short trade would have.
    const shortR = computeGMXCost(market, 100_000, 'short');
    expect(r.priceImpact).toBeLessThan(shortR.priceImpact);
  });
});
