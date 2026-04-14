import { describe, it, expect } from 'vitest';
import { fp, filterOutliers, computeStats, computeYDomain } from '../spread-math';

describe('fp — adaptive price formatting', () => {
  it('formats large prices with no decimals', () => {
    expect(fp(50000)).toBe('50,000');
    expect(fp(100123)).toBe('100,123');
  });

  it('formats mid-range prices with 2 decimals', () => {
    expect(fp(1.5)).toBe('1.50');
    expect(fp(999.99)).toBe('999.99');
  });

  it('formats small prices with 4 decimals', () => {
    expect(fp(0.05)).toBe('0.0500');
  });

  it('formats very small prices with 6 decimals', () => {
    expect(fp(0.0005)).toBe('0.000500');
  });

  it('returns dash for non-finite', () => {
    expect(fp(Infinity)).toBe('—');
    expect(fp(NaN)).toBe('—');
    expect(fp(-Infinity)).toBe('—');
  });

  it('returns 0.00 for zero', () => {
    expect(fp(0)).toBe('0.00');
  });

  it('returns < 0.0001 for tiny positive values', () => {
    expect(fp(0.00001)).toBe('< 0.0001');
  });
});

describe('filterOutliers', () => {
  it('returns input when fewer than 2 entries', () => {
    const one = [{ e: 'Binance', p: 100 }];
    expect(filterOutliers(one)).toEqual(one);
    expect(filterOutliers([])).toEqual([]);
  });

  it('filters outlier prices beyond 10% from median', () => {
    const entries = [
      { e: 'A', p: 100 },
      { e: 'B', p: 101 },
      { e: 'C', p: 102 },
      { e: 'D', p: 150 }, // outlier — 50% from median
    ];
    const result = filterOutliers(entries);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.e)).not.toContain('D');
  });

  it('keeps all entries when no outliers', () => {
    const entries = [
      { e: 'A', p: 100 },
      { e: 'B', p: 101 },
      { e: 'C', p: 102 },
    ];
    expect(filterOutliers(entries)).toHaveLength(3);
  });

  it('returns all if filtering would leave < 2', () => {
    const entries = [
      { e: 'A', p: 100 },
      { e: 'B', p: 200 },
    ];
    // Median is 200, A is 50% away — but filtering leaves only B which is < 2
    const result = filterOutliers(entries);
    expect(result).toHaveLength(2);
  });

  it('returns entries when median is 0', () => {
    const entries = [
      { e: 'A', p: 0 },
      { e: 'B', p: 0 },
      { e: 'C', p: 100 },
    ];
    // median is 0, guard returns all
    expect(filterOutliers(entries)).toHaveLength(3);
  });
});

describe('computeStats', () => {
  it('returns null for empty data', () => {
    expect(computeStats([], ['A', 'B'])).toBeNull();
  });

  it('returns null for fewer than 2 exchanges', () => {
    expect(computeStats([{ time: 1, label: '', A: 100, _spread: 0, _spreadPct: 0 }], ['A'])).toBeNull();
  });

  it('computes spread stats correctly', () => {
    const data = [
      { time: 1, label: '', A: 100, B: 102, _spread: 2, _spreadPct: 2 },
      { time: 2, label: '', A: 101, B: 103, _spread: 2, _spreadPct: 1.98 },
    ];
    const stats = computeStats(data, ['A', 'B']);
    expect(stats).not.toBeNull();
    expect(stats!.cur).toBe(2); // 103 - 101
    expect(stats!.avg).toBe(2);
    expect(stats!.max).toBe(2);
    expect(stats!.hi.e).toBe('B');
    expect(stats!.lo.e).toBe('A');
  });
});

describe('computeYDomain', () => {
  it('returns [0, 1] for empty data', () => {
    expect(computeYDomain([], [])).toEqual([0, 1]);
  });

  it('pads domain around price range', () => {
    const data = [
      { time: 1, label: '', A: 100, B: 102 },
      { time: 2, label: '', A: 101, B: 103 },
    ];
    const [lo, hi] = computeYDomain(data, ['A', 'B']);
    expect(lo).toBeLessThan(100);
    expect(hi).toBeGreaterThan(103);
  });
});
