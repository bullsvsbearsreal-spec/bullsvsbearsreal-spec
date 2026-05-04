import { describe, it, expect } from 'vitest';
import { fp, filterOutliers, computeStats, computeYDomain } from '../spread-math';
import type { Pt } from '../types';

// --- fp() formatting ---

describe('fp', () => {
  it('formats large numbers without decimals', () => {
    expect(fp(84531)).toBe('84,531');
    expect(fp(10000)).toBe('10,000');
  });

  it('formats normal numbers with 2 decimals', () => {
    expect(fp(99.123)).toBe('99.12');
    expect(fp(1.5)).toBe('1.50');
  });

  it('formats small numbers with 4 decimals', () => {
    expect(fp(0.0523)).toBe('0.0523');
    expect(fp(0.01)).toBe('0.0100');
  });

  it('formats very small numbers with 6 decimals', () => {
    expect(fp(0.000123)).toBe('0.000123');
  });

  it('returns dash for non-finite values', () => {
    expect(fp(Infinity)).toBe('\u2014');
    expect(fp(-Infinity)).toBe('\u2014');
    expect(fp(NaN)).toBe('\u2014');
  });

  it('handles zero', () => {
    expect(fp(0)).toBe('0.00');
  });

  it('handles tiny positive numbers below 0.0001', () => {
    expect(fp(0.00001)).toBe('< 0.0001');
  });

  it('handles negative values', () => {
    const result = fp(-0.00523);
    expect(result).toBeDefined();
  });
});

// --- filterOutliers() ---

describe('filterOutliers', () => {
  it('returns entries unchanged when < 2', () => {
    const single = [{ e: 'Binance', p: 100 }];
    expect(filterOutliers(single)).toEqual(single);
    expect(filterOutliers([])).toEqual([]);
  });

  it('removes outlier prices beyond 1% from median', () => {
    // Threshold was tightened 10% → 1% in spread-math.ts to catch stale
    // exchange feeds. Prices within ±1% of the median survive; anything
    // beyond gets dropped.
    const entries = [
      { e: 'Binance', p: 100 },
      { e: 'Bybit', p: 100.5 },   // 0.5% above median — kept
      { e: 'OKX', p: 99.5 },       // 0.5% below median — kept
      { e: 'Rogue', p: 150 },      // 50% above — dropped
    ];
    const result = filterOutliers(entries);
    expect(result).toHaveLength(3);
    expect(result.find(x => x.e === 'Rogue')).toBeUndefined();
  });

  it('keeps all entries when they are close together', () => {
    const entries = [
      { e: 'Binance', p: 100 },
      { e: 'Bybit', p: 101 },
      { e: 'OKX', p: 102 },
    ];
    expect(filterOutliers(entries)).toHaveLength(3);
  });

  it('returns original entries if filtering would leave < 2', () => {
    const entries = [
      { e: 'A', p: 100 },
      { e: 'B', p: 200 },
    ];
    const result = filterOutliers(entries);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('handles zero median gracefully', () => {
    const entries = [
      { e: 'A', p: 0 },
      { e: 'B', p: 0 },
      { e: 'C', p: 100 },
    ];
    const result = filterOutliers(entries);
    expect(result).toEqual(entries);
  });
});

// --- computeStats() ---

describe('computeStats', () => {
  it('returns null for empty data', () => {
    expect(computeStats([], ['A', 'B'])).toBeNull();
  });

  it('returns null for fewer than 2 exchanges', () => {
    const data: Pt[] = [{ time: 1, label: '', A: 100, _spread: 0, _spreadPct: 0 }];
    expect(computeStats(data, ['A'])).toBeNull();
  });

  it('computes spread stats correctly', () => {
    const data: Pt[] = [
      { time: 1, label: '', A: 100, B: 102, _spread: 2, _spreadPct: 2 },
      { time: 2, label: '', A: 101, B: 104, _spread: 3, _spreadPct: 2.97 },
      { time: 3, label: '', A: 99, B: 100, _spread: 1, _spreadPct: 1.01 },
    ];
    const stats = computeStats(data, ['A', 'B']);
    expect(stats).not.toBeNull();
    expect(stats!.max).toBe(3);
    expect(stats!.min).toBe(1);
    expect(stats!.avg).toBeCloseTo(2, 1);
  });
});

// --- computeYDomain() ---

describe('computeYDomain', () => {
  it('returns [0,1] for empty data', () => {
    expect(computeYDomain([], ['A'])).toEqual([0, 1]);
  });

  it('returns [0,1] for empty exchanges', () => {
    const data: Pt[] = [{ time: 1, label: '', A: 100 }];
    expect(computeYDomain(data, [])).toEqual([0, 1]);
  });

  it('computes padded domain from price data', () => {
    const data: Pt[] = [
      { time: 1, label: '', A: 100, B: 102 },
      { time: 2, label: '', A: 101, B: 103 },
      { time: 3, label: '', A: 99, B: 104 },
    ];
    const [lo, hi] = computeYDomain(data, ['A', 'B']);
    expect(lo).toBeLessThan(99);
    expect(hi).toBeGreaterThan(104);
  });
});
