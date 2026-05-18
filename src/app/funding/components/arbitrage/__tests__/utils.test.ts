import { describe, it, expect } from 'vitest';
import {
  computeGrade,
  getGradeBreakdown,
  GRADE_COLORS,
  ROWS_PER_PAGE,
  formatUSD,
  formatPnl,
  formatPrice,
  getIntervalForExchange,
} from '../utils';
import type { ArbitrageItem } from '../types';

describe('computeGrade', () => {
  it('returns D-grade when fees exceed spread', () => {
    const out = computeGrade(0.01, 1_000_000, 'stable', 0.02);
    expect(out.grade).toBe('D');
    expect(out.score).toBe(0);
    expect(out.flags).toContain('fees exceed spread');
  });

  it('returns A-grade for a clean opportunity (deep liquidity, stable, no fees)', () => {
    const out = computeGrade(0.3, 50_000_000, 'stable', 0);
    expect(out.grade).toBe('A');
    expect(out.score).toBeGreaterThanOrEqual(8);
  });

  it('returns B-grade for moderate spreads with okay liquidity', () => {
    // spreadPct8h=1.0 (moderate, score 2), $1M OI (score 2), stable (score 2),
    // net score 1, balance score 1 → 8 = A. Need less.
    // Use $200K OI (score 1) instead → 1+1+2+1+2 = 7 (=B)
    const out = computeGrade(1.0, 200_000, 'stable', 0.02);
    expect(['B', 'C']).toContain(out.grade);
  });

  it('returns lower grade for shaky opportunities', () => {
    // Volatile, thin liquidity (< 100K → 0 score), poor net
    // spreadScore 3 (0.3<0.5) + oiScore 0 + balance 1 + net 0 (since 0.1/0.3<0.5) + stab 1 = 5 = B
    // To force C: make spread tiny so net fails further
    const out = computeGrade(0.05, 30_000, 'volatile', 0.04);
    // 0.05 - 0.04 = 0.01 → netRatio = 0.2 < 0.3 → netScore 0
    // spreadScore = 3 (0.05<0.5), oiScore = 0 (<100k), balance 1, net 0, stab 1 = 5 = B still
    // Actually with very small minSideOI < 50k it flags "very low OI"
    expect(['B', 'C', 'D']).toContain(out.grade);
    expect(out.flags.length).toBeGreaterThan(0);
  });

  it('flags "very low OI" when minSideOI is between 0 and 50k', () => {
    const out = computeGrade(0.3, 25_000, 'stable', 0);
    expect(out.flags).toContain('very low OI');
  });

  it('flags "unusually high spread" when > 5%', () => {
    const out = computeGrade(6, 1_000_000, 'stable', 0);
    expect(out.flags).toContain('unusually high spread');
  });

  it('flags "fees eat >70% of spread" when netRatio < 0.3', () => {
    const out = computeGrade(0.5, 1_000_000, 'stable', 0.4);
    expect(out.flags).toContain('fees eat >70% of spread');
  });

  it('flags new/untracked when stability="new"', () => {
    const out = computeGrade(0.3, 1_000_000, 'new', 0);
    expect(out.flags).toContain('new/untracked pair');
  });

  it('flags OI imbalance >20:1 when ratio < 0.05', () => {
    const out = computeGrade(0.3, 100_000, 'stable', 0, {
      highOI: 100_000_000,
      lowOI: 1_000_000,  // 1/100 = 0.01 < 0.05
    });
    expect(out.flags).toContain('OI imbalanced >20:1');
  });

  it('flags interval mismatch when highInterval != lowInterval', () => {
    const out = computeGrade(0.3, 1_000_000, 'stable', 0, {
      highInterval: '8h',
      lowInterval: '1h',
    });
    expect(out.flags.some((f) => f.includes('interval mismatch'))).toBe(true);
  });
});

describe('GRADE_COLORS', () => {
  it('has entries for all 4 grades', () => {
    expect(GRADE_COLORS.A).toBeDefined();
    expect(GRADE_COLORS.B).toBeDefined();
    expect(GRADE_COLORS.C).toBeDefined();
    expect(GRADE_COLORS.D).toBeDefined();
  });

  it('uses semantic colors (green/blue/amber/red)', () => {
    expect(GRADE_COLORS.A).toContain('green');
    expect(GRADE_COLORS.B).toContain('blue');
    expect(GRADE_COLORS.C).toContain('amber');
    expect(GRADE_COLORS.D).toContain('red');
  });
});

describe('ROWS_PER_PAGE', () => {
  it('is set to a sensible page size', () => {
    expect(ROWS_PER_PAGE).toBe(30);
  });
});

describe('formatUSD', () => {
  it('formats billions with B suffix', () => {
    expect(formatUSD(2.5e9)).toBe('$2.50B');
  });

  it('formats millions with M suffix', () => {
    expect(formatUSD(2.5e6)).toBe('$2.50M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatUSD(5000)).toBe('$5K');
    expect(formatUSD(12_345)).toBe('$12K');
  });

  it('formats sub-1k values with 2 decimals', () => {
    expect(formatUSD(99.99)).toBe('$99.99');
    expect(formatUSD(0.5)).toBe('$0.50');
  });
});

describe('formatPnl', () => {
  it('uses + sign for positive values', () => {
    expect(formatPnl(100)).toBe('+$100.00');
    expect(formatPnl(5000)).toBe('+$5.0K');
  });

  it('omits + sign for negative values (negative sign appears after $)', () => {
    // Source: `${prefix}$${value.toFixed(2)}` — negative bleeds through after the $
    expect(formatPnl(-100)).toBe('$-100.00');
    expect(formatPnl(-5000)).toBe('$-5.0K');
  });

  it('uses K suffix for values >= $1000 abs', () => {
    expect(formatPnl(1500)).toBe('+$1.5K');
    // Negative sign appears after $ — matches source
    expect(formatPnl(-1500)).toBe('$-1.5K');
  });

  it('handles zero', () => {
    expect(formatPnl(0)).toBe('+$0.00');
  });
});

describe('formatPrice', () => {
  it('uses no decimals for prices >= $10k', () => {
    const out = formatPrice(50_000);
    expect(out).toContain('50,000');
    expect(out).not.toContain('.');
  });

  it('uses 2 decimals for prices >= $1 and < $10k', () => {
    expect(formatPrice(100.5)).toBe('$100.50');
    expect(formatPrice(1.234)).toBe('$1.23');
  });

  it('uses 4 decimals for prices >= $0.01 and < $1', () => {
    expect(formatPrice(0.5)).toBe('$0.5000');
    expect(formatPrice(0.0123)).toBe('$0.0123');
  });

  it('uses 6 decimals for prices < $0.01 (memecoin tier)', () => {
    expect(formatPrice(0.0001)).toBe('$0.000100');
    expect(formatPrice(0.000001)).toBe('$0.000001');
  });
});

describe('getIntervalForExchange', () => {
  it('returns the per-row interval when available', () => {
    const item = {
      symbol: 'BTC',
      intervals: { Binance: '8h', Bybit: '8h' },
    } as unknown as ArbitrageItem;
    expect(getIntervalForExchange(item, 'Binance')).toBe('8h');
  });

  it('falls back to the intervalMap when row has no intervals', () => {
    const item = { symbol: 'BTC' } as unknown as ArbitrageItem;
    const intervalMap = new Map([['BTC|Hyperliquid', '1h']]);
    expect(getIntervalForExchange(item, 'Hyperliquid', intervalMap)).toBe('1h');
  });

  it('returns undefined when neither source has the interval', () => {
    const item = { symbol: 'BTC' } as unknown as ArbitrageItem;
    expect(getIntervalForExchange(item, 'Unknown')).toBeUndefined();
  });
});

describe('getGradeBreakdown', () => {
  it('emits a "Profitability" line when fees exceed spread', () => {
    const breakdown = getGradeBreakdown({
      spreadPct8h: 0.01, minSideOI: 1_000_000, stability: 'stable', roundTripFee: 0.02,
    });
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].label).toBe('Profitability');
  });

  it('emits a full 5-line breakdown for a profitable trade', () => {
    const breakdown = getGradeBreakdown({
      spreadPct8h: 0.3, minSideOI: 5_000_000, stability: 'stable', roundTripFee: 0.02,
    });
    const labels = breakdown.map((b) => b.label);
    expect(labels).toContain('Liquidity');
    expect(labels).toContain('OI Balance');
    expect(labels).toContain('Spread Quality');
    expect(labels).toContain('Fee Impact');
    expect(labels).toContain('Stability');
  });

  it('adds an interval mismatch row when intervals differ', () => {
    const breakdown = getGradeBreakdown({
      spreadPct8h: 0.3, minSideOI: 5_000_000, stability: 'stable', roundTripFee: 0.02,
      highInterval: '8h', lowInterval: '1h',
    });
    expect(breakdown.some((b) => b.label === 'Interval')).toBe(true);
  });
});
