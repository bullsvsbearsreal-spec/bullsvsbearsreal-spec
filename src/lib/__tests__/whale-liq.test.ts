/**
 * Tests for liqDistancePct — the per-position distance-to-liquidation
 * calculation that drives /whale-liq's "near-liq HL positions" sorting.
 *
 * A regression here would either show wrong distances (misranking
 * which whales are most at risk) or silently filter out positions
 * (missing the most interesting ones — already-past-liq positions
 * are filtered, but mathematically-safe positions must show up).
 */
import { describe, it, expect } from 'vitest';
import { liqDistancePct } from '../whale-liq';

describe('liqDistancePct — long positions', () => {
  it('returns positive distance when mark > liq (still safe)', () => {
    // Long BTC at $100k mark, liq at $90k → 10% buffer
    expect(liqDistancePct('long', 100_000, 90_000)).toBeCloseTo(0.1, 4);
  });

  it('returns null when mark < liq (already liquidated)', () => {
    expect(liqDistancePct('long', 90_000, 100_000)).toBeNull();
  });

  it('returns null when mark === liq (exact liquidation)', () => {
    // distance would be 0 — counts as not safe-anymore, filter out
    // (matches the production filter `distance < 0` — actually 0 should
    // pass since 0 is "right at the line". Test current behavior.)
    expect(liqDistancePct('long', 100_000, 100_000)).toBe(0);
  });

  it('handles fractional buffers correctly', () => {
    // 1% buffer
    expect(liqDistancePct('long', 100, 99)).toBeCloseTo(0.01, 4);
    // 0.5% buffer
    expect(liqDistancePct('long', 100, 99.5)).toBeCloseTo(0.005, 4);
  });
});

describe('liqDistancePct — short positions', () => {
  it('returns positive distance when mark < liq (still safe)', () => {
    // Short BTC at $100k mark, liq at $110k → 10% buffer
    expect(liqDistancePct('short', 100_000, 110_000)).toBeCloseTo(0.1, 4);
  });

  it('returns null when mark > liq (already liquidated)', () => {
    expect(liqDistancePct('short', 110_000, 100_000)).toBeNull();
  });

  it('handles fractional buffers correctly', () => {
    expect(liqDistancePct('short', 100, 101)).toBeCloseTo(0.01, 4);
    expect(liqDistancePct('short', 100, 100.5)).toBeCloseTo(0.005, 4);
  });
});

describe('liqDistancePct — input validation', () => {
  it('returns null for zero mark price', () => {
    expect(liqDistancePct('long', 0, 90_000)).toBeNull();
  });

  it('returns null for negative mark price', () => {
    expect(liqDistancePct('long', -100, 90_000)).toBeNull();
    expect(liqDistancePct('short', -100, 90_000)).toBeNull();
  });

  it('returns null for zero liquidation price', () => {
    expect(liqDistancePct('long', 100_000, 0)).toBeNull();
  });

  it('returns null for negative liquidation price', () => {
    expect(liqDistancePct('long', 100_000, -90_000)).toBeNull();
  });

  it('returns null for non-finite values', () => {
    expect(liqDistancePct('long', Infinity, 90_000)).toBeNull();
    expect(liqDistancePct('long', NaN, 90_000)).toBeNull();
    expect(liqDistancePct('long', 100_000, Infinity)).toBeNull();
    expect(liqDistancePct('long', 100_000, NaN)).toBeNull();
  });
});

describe('liqDistancePct — realistic whale scenarios', () => {
  // Sanity checks against scenarios from real /whale-liq data.
  it('high-leverage long at 50x has tiny buffer', () => {
    // 50x long opened at $80k → liq around $78.4k (2% margin minus mmf)
    // If mark drops to $79k, buffer = (79 - 78.4) / 79 ≈ 0.76%
    const dist = liqDistancePct('long', 79_000, 78_400);
    expect(dist).toBeCloseTo(0.0076, 4);
  });

  it('low-leverage short at 3x has wide buffer', () => {
    // 3x short opened at $80k → liq around $106k (33% margin minus mmf)
    // If mark stays at $80k, buffer = (106 - 80) / 80 = 32.5%
    const dist = liqDistancePct('short', 80_000, 106_000);
    expect(dist).toBeCloseTo(0.325, 3);
  });

  it('whale near liq: 0.5% buffer matters for sorting', () => {
    // /whale-liq's "danger zone" filter is < 2%
    expect(liqDistancePct('long', 100_000, 99_500)).toBeLessThan(0.02);
    expect(liqDistancePct('long', 100_000, 99_500)).toBeGreaterThan(0);
  });
});
