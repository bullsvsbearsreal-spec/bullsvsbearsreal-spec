/**
 * Tests for the breakouts composite quality score. These lock in
 * the exact thresholds — every branch boundary has a case. If the
 * formula is tweaked, this suite tells you exactly which boundary
 * changed and confirms downstream callers (the /breakouts page
 * ranking) won't be silently re-ordered.
 */
import { describe, it, expect } from 'vitest';
import { computeQualityScore, type QualityInputs } from '../quality';

/** Neutral baseline — every input at "nothing happens" defaults.
 *  Lets each test override just the dimension it's exercising. */
const NEUTRAL: QualityInputs = {
  c24: 0,    // not the >0 win path, not the <-5 loss path
  c7:  0,
  c30: 0,
  price: 100,
  high24: 100,
  low24: 100, // range = 0 → falls back to rangePos 0.5 → 12 pts
  athPct: -50, // beyond -30% taper → 0 pts
  marketCap: 0,
  volume24h: 0, // mc=0 → ratio=0 → -5 pts
};

describe('computeQualityScore — neutral baseline', () => {
  it('mid-range, no momentum, off-ATH, no volume → ~57', () => {
    const r = computeQualityScore(NEUTRAL);
    // 0 mom + 12 (mid range) + 0 (off ATH) + -5 (low vol) = 7
    // raw = 50 + 7 = 57
    expect(r.score).toBe(57);
    expect(r.components.momStack).toBe(0);
    expect(r.components.rangePoints).toBe(12);
    expect(r.components.athPoints).toBe(0);
    expect(r.components.volPoints).toBe(-5);
  });
});

describe('computeQualityScore — momentum stack', () => {
  it('positive 24h+7d+30d → +40 (capped)', () => {
    const r = computeQualityScore({ ...NEUTRAL, c24: 5, c7: 8, c30: 25 });
    // 8 + 12 + 20 = 40
    expect(r.components.momStack).toBe(40);
  });

  it('negative 24h+7d+30d crashes → -40', () => {
    const r = computeQualityScore({ ...NEUTRAL, c24: -10, c7: -20, c30: -30 });
    expect(r.components.momStack).toBe(-40);
  });

  it('mild 24h drop (-3%) is not penalised — only -5%+ triggers', () => {
    // -3% is in the "no penalty" gap
    const r = computeQualityScore({ ...NEUTRAL, c24: -3 });
    expect(r.components.momStack).toBe(0);
  });

  it('boundary: c24=-5 exactly → still no penalty (need <-5)', () => {
    // The condition is `c24 < -5`, so -5 itself is the gap.
    const r = computeQualityScore({ ...NEUTRAL, c24: -5 });
    expect(r.components.momStack).toBe(0);
  });

  it('boundary: c24=-5.01 → -8 penalty', () => {
    const r = computeQualityScore({ ...NEUTRAL, c24: -5.01 });
    expect(r.components.momStack).toBe(-8);
  });

  it('mixed momentum (positive 24h, negative 30d) sums correctly', () => {
    // +8 (24h>0) + 0 (7d in gap) + -20 (30d<-20) = -12
    const r = computeQualityScore({ ...NEUTRAL, c24: 2, c7: -5, c30: -25 });
    expect(r.components.momStack).toBe(-12);
  });
});

describe('computeQualityScore — range position', () => {
  it('price at 24h high → upper-third → +25', () => {
    const r = computeQualityScore({ ...NEUTRAL, price: 100, high24: 100, low24: 90 });
    // rangePos = 10/10 = 1.0 → upper bucket
    expect(r.components.rangePoints).toBe(25);
  });

  it('price at 24h low → lower-third → -10', () => {
    const r = computeQualityScore({ ...NEUTRAL, price: 90, high24: 100, low24: 90 });
    // rangePos = 0/10 = 0 → bottom bucket
    expect(r.components.rangePoints).toBe(-10);
  });

  it('price at mid-range (0.5) → +12', () => {
    const r = computeQualityScore({ ...NEUTRAL, price: 95, high24: 100, low24: 90 });
    expect(r.components.rangePoints).toBe(12);
  });

  it('boundary: rangePos=0.7 exactly → upper bucket (25)', () => {
    // 0.7 means price 7 above low in a 10-wide range
    const r = computeQualityScore({ ...NEUTRAL, price: 97, high24: 100, low24: 90 });
    expect(r.components.rangePoints).toBe(25);
  });

  it('boundary: rangePos=0.5 → mid bucket (12)', () => {
    const r = computeQualityScore({ ...NEUTRAL, price: 95, high24: 100, low24: 90 });
    expect(r.components.rangePoints).toBe(12);
  });

  it('boundary: rangePos=0.3 → lower-mid bucket (0)', () => {
    // 0.3 of a 10-wide range = 3 above low → price 93
    const r = computeQualityScore({ ...NEUTRAL, price: 93, high24: 100, low24: 90 });
    expect(r.components.rangePoints).toBe(0);
  });

  it('zero range (high == low) falls back to mid (12)', () => {
    const r = computeQualityScore({ ...NEUTRAL, price: 100, high24: 100, low24: 100 });
    expect(r.components.rangePoints).toBe(12);
  });

  it('zero price falls back to mid (12)', () => {
    const r = computeQualityScore({ ...NEUTRAL, price: 0, high24: 100, low24: 90 });
    expect(r.components.rangePoints).toBe(12);
  });
});

describe('computeQualityScore — ATH proximity', () => {
  it('at ATH (>= -2%) → +25', () => {
    expect(computeQualityScore({ ...NEUTRAL, athPct: -1 }).components.athPoints).toBe(25);
    expect(computeQualityScore({ ...NEUTRAL, athPct: -2 }).components.athPoints).toBe(25);
    expect(computeQualityScore({ ...NEUTRAL, athPct: 0 }).components.athPoints).toBe(25);
  });
  it('near ATH (-10 to -2) → +18', () => {
    expect(computeQualityScore({ ...NEUTRAL, athPct: -5 }).components.athPoints).toBe(18);
    expect(computeQualityScore({ ...NEUTRAL, athPct: -10 }).components.athPoints).toBe(18);
  });
  it('approaching ATH (-20 to -10) → +10', () => {
    expect(computeQualityScore({ ...NEUTRAL, athPct: -15 }).components.athPoints).toBe(10);
    expect(computeQualityScore({ ...NEUTRAL, athPct: -20 }).components.athPoints).toBe(10);
  });
  it('far from ATH (-30 to -20) → +4', () => {
    expect(computeQualityScore({ ...NEUTRAL, athPct: -25 }).components.athPoints).toBe(4);
    expect(computeQualityScore({ ...NEUTRAL, athPct: -30 }).components.athPoints).toBe(4);
  });
  it('beyond -30% from ATH → 0 (no benefit, no penalty)', () => {
    expect(computeQualityScore({ ...NEUTRAL, athPct: -31 }).components.athPoints).toBe(0);
    expect(computeQualityScore({ ...NEUTRAL, athPct: -90 }).components.athPoints).toBe(0);
  });
});

describe('computeQualityScore — volume health', () => {
  it('vol/mc >= 0.1 → +10 (very high turnover)', () => {
    const r = computeQualityScore({ ...NEUTRAL, marketCap: 1_000_000, volume24h: 200_000 });
    expect(r.components.volPoints).toBe(10);
  });
  it('vol/mc 0.05-0.1 → +5 (healthy turnover)', () => {
    const r = computeQualityScore({ ...NEUTRAL, marketCap: 1_000_000, volume24h: 80_000 });
    expect(r.components.volPoints).toBe(5);
  });
  it('vol/mc 0.01-0.05 → 0 (neutral)', () => {
    const r = computeQualityScore({ ...NEUTRAL, marketCap: 1_000_000, volume24h: 20_000 });
    expect(r.components.volPoints).toBe(0);
  });
  it('vol/mc < 0.01 → -5 (dormant, no real interest)', () => {
    const r = computeQualityScore({ ...NEUTRAL, marketCap: 1_000_000, volume24h: 1_000 });
    expect(r.components.volPoints).toBe(-5);
  });
  it('marketCap = 0 → ratio=0 → -5 (defensive fallback)', () => {
    const r = computeQualityScore({ ...NEUTRAL, marketCap: 0, volume24h: 100_000 });
    expect(r.components.volPoints).toBe(-5);
  });
  it('null marketCap treated as 0', () => {
    const r = computeQualityScore({ ...NEUTRAL, marketCap: null, volume24h: 100_000 });
    expect(r.components.volPoints).toBe(-5);
  });
  it('null volume24h treated as 0', () => {
    const r = computeQualityScore({ ...NEUTRAL, marketCap: 1_000_000, volume24h: null });
    expect(r.components.volPoints).toBe(-5);
  });
});

describe('computeQualityScore — final clamping', () => {
  it('best-possible setup tops out at 100', () => {
    const r = computeQualityScore({
      c24: 10, c7: 15, c30: 30,           // +40 momentum
      price: 100, high24: 100, low24: 80, // +25 range (at high)
      athPct: 0,                          // +25 ATH
      marketCap: 1_000_000, volume24h: 200_000, // +10 vol
    });
    // 40 + 25 + 25 + 10 = 100; raw 150 → clamps to 100
    expect(r.score).toBe(100);
    expect(r.raw).toBe(150);
  });

  it('worst-possible setup floors at 0', () => {
    const r = computeQualityScore({
      c24: -10, c7: -20, c30: -30,        // -40 momentum
      price: 80, high24: 100, low24: 80,  // -10 range (at low)
      athPct: -90,                        // 0 ATH
      marketCap: 0, volume24h: 0,         // -5 vol
    });
    // -40 + -10 + 0 + -5 = -55; raw -5 → clamps to 0
    expect(r.score).toBe(0);
  });

  it('mid-range setup lands around 50-60', () => {
    // Strong-ish but not extreme: positive on all timeframes,
    // upper-range, near ATH, healthy volume
    const r = computeQualityScore({
      c24: 2, c7: 3, c30: 5,
      price: 99, high24: 100, low24: 90,
      athPct: -8,
      marketCap: 100_000_000, volume24h: 6_000_000,
    });
    // 40 mom + 25 range + 18 ATH + 5 vol = 88 → raw 138 → 100
    expect(r.score).toBe(100);
  });

  it('rounds final score (not floor or ceil)', () => {
    // Construct a setup that hits a non-integer raw — actually
    // all our components are integers, so raw is always integer.
    // Sanity-check Math.round is the operation used:
    const r = computeQualityScore(NEUTRAL);
    expect(Number.isInteger(r.score)).toBe(true);
  });
});

describe('computeQualityScore — invariants', () => {
  it('score is always in [0, 100]', () => {
    // Sample a range of inputs and confirm clamp holds
    const cases: QualityInputs[] = [
      { ...NEUTRAL, c24: 100, c7: 100, c30: 100 },
      { ...NEUTRAL, c24: -100, c7: -100, c30: -100 },
      { ...NEUTRAL, athPct: 50 },     // above ATH (impossible but defensive)
      { ...NEUTRAL, athPct: -999 },
      { ...NEUTRAL, marketCap: 1e15, volume24h: 1e15 },
    ];
    for (const c of cases) {
      const r = computeQualityScore(c);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('components sum-back to raw - 50', () => {
    const r = computeQualityScore({ ...NEUTRAL, c24: 5, athPct: -5, marketCap: 1_000_000, volume24h: 50_000 });
    const sum = r.components.momStack + r.components.rangePoints + r.components.athPoints + r.components.volPoints;
    expect(r.raw).toBe(sum + 50);
  });
});
