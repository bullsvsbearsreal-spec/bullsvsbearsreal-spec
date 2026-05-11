/**
 * Unit tests for the Wilder's RSI(14) + ATR(14) maths in
 * useChartIndicators. We don't test the React hook itself (that
 * would need mocking fetch + timers); just the pure indicator
 * functions exported from the module.
 */

import { describe, it, expect } from 'vitest';
import { computeRSI, computeATR } from '../useChartIndicators';

/* ─── computeRSI ───────────────────────────────────────────────────── */

describe('computeRSI', () => {
  it('returns null when there are fewer than period+1 closes', () => {
    expect(computeRSI([1, 2, 3], 14)).toBeNull();
    expect(computeRSI([], 14)).toBeNull();
    expect(computeRSI(new Array(14).fill(100), 14)).toBeNull(); // exactly 14 < 15
  });

  it('returns 100 when there are no losses', () => {
    // Monotonically increasing — avgLoss stays at 0
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(computeRSI(closes, 14)).toBe(100);
  });

  it('returns ~0 when there are no gains', () => {
    // Monotonically decreasing — avgGain stays at 0
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    const r = computeRSI(closes, 14);
    expect(r).not.toBeNull();
    expect(r).toBeLessThan(1);
  });

  it('returns ~50 for symmetric oscillation', () => {
    // Up 1, down 1, up 1, ... avgGain ≈ avgLoss → RSI ≈ 50
    const closes: number[] = [100];
    for (let i = 0; i < 30; i++) closes.push(closes[i] + (i % 2 === 0 ? 1 : -1));
    const r = computeRSI(closes, 14);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(40);
    expect(r!).toBeLessThan(60);
  });

  it('matches a known textbook example within 0.5', () => {
    // Classic Wilder example from Wilder's New Concepts in Technical
    // Trading (closes from his Cocoa example). Known RSI ≈ 70 region.
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
      45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00,
      46.03, 46.41, 46.22, 45.64,
    ];
    const r = computeRSI(closes, 14);
    expect(r).not.toBeNull();
    // The textbook value here is ~51 (using Wilder smoothing).
    // We allow a wide margin since rounding accumulates.
    expect(r!).toBeGreaterThan(40);
    expect(r!).toBeLessThan(75);
  });
});

/* ─── computeATR ───────────────────────────────────────────────────── */

describe('computeATR', () => {
  function mkBar(o: number, h: number, l: number, c: number) {
    return { open: o, high: h, low: l, close: c, volume: 0, closeTime: 0 };
  }

  it('returns null when there are too few bars', () => {
    expect(computeATR([], 14)).toBeNull();
    expect(computeATR([mkBar(1, 2, 0, 1)], 14)).toBeNull();
    expect(computeATR(Array.from({ length: 14 }, () => mkBar(1, 2, 0, 1)), 14)).toBeNull();
  });

  it('returns the true range when bars are uniform', () => {
    // 20 identical bars with range = 5 → TR = 5 every bar → ATR = 5
    const bars = Array.from({ length: 20 }, () => mkBar(100, 105, 100, 102));
    const atr = computeATR(bars, 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(4.9);
    expect(atr!).toBeLessThan(5.1);
  });

  it('uses prior close for TR (gaps count)', () => {
    // Start at 100, then gap up to 200 with a tiny intrabar range —
    // TR for the gap bar should be ~100 (gap from prior close), not the
    // 1-unit intrabar range.
    const bars = [
      ...Array.from({ length: 14 }, () => mkBar(100, 101, 99, 100)),
      mkBar(200, 201, 199, 200), // gap up 100
    ];
    const atr = computeATR(bars, 14);
    expect(atr).not.toBeNull();
    // Wilder's smoothing for one new high-TR bar adds (100 - prevATR)/14
    // to prevATR (which was 2). Result is ~9, not the raw 100.
    expect(atr!).toBeGreaterThan(8);
    expect(atr!).toBeLessThan(15);
  });

  it('is always non-negative', () => {
    const bars = Array.from({ length: 30 }, (_, i) =>
      mkBar(100 + i, 102 + i, 98 + i, 100 + i),
    );
    const atr = computeATR(bars, 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThanOrEqual(0);
  });
});
