import { describe, it, expect } from 'vitest';
import {
  formatRate,
  formatRateAdaptive,
  getRateColor,
  getRateColorWithPip,
  getHeatmapColor,
  periodMultiplier,
  PERIOD_HOURS,
  PERIOD_LABELS,
  type FundingPeriod,
} from '../utils';

describe('formatRate', () => {
  it('returns "-" for null / undefined / NaN', () => {
    expect(formatRate(null)).toBe('-');
    expect(formatRate(undefined)).toBe('-');
    expect(formatRate(NaN)).toBe('-');
  });

  it('formats positive rates with + sign and 4 decimals', () => {
    expect(formatRate(0.01)).toBe('+0.0100%');
    expect(formatRate(0.12345)).toBe('+0.1235%');
  });

  it('formats negative rates without explicit + sign', () => {
    expect(formatRate(-0.01)).toBe('-0.0100%');
    expect(formatRate(-0.5)).toBe('-0.5000%');
  });

  it('formats 0 as +0.0000%', () => {
    expect(formatRate(0)).toBe('+0.0000%');
  });
});

describe('formatRateAdaptive', () => {
  it('uses 4 decimals for small magnitudes', () => {
    expect(formatRateAdaptive(0.0123)).toBe('+0.0123%');
  });

  it('uses 3 decimals for medium magnitudes', () => {
    expect(formatRateAdaptive(1.234)).toBe('+1.234%');
  });

  it('uses 2 decimals for large magnitudes (abs >= 10)', () => {
    expect(formatRateAdaptive(100)).toBe('+100.00%');
    expect(formatRateAdaptive(99.99)).toBe('+99.99%');  // abs >= 10 → 2 decimals
    expect(formatRateAdaptive(10)).toBe('+10.00%');
  });

  it('returns "-" for invalid input', () => {
    expect(formatRateAdaptive(null)).toBe('-');
    expect(formatRateAdaptive(undefined)).toBe('-');
  });
});

describe('getRateColor', () => {
  it('returns success class for positive rates', () => {
    expect(getRateColor(0.01)).toBe('text-success');
    expect(getRateColor(100)).toBe('text-success');
  });

  it('returns danger class for negative rates', () => {
    expect(getRateColor(-0.01)).toBe('text-danger');
    expect(getRateColor(-100)).toBe('text-danger');
  });

  it('returns neutral class for zero', () => {
    expect(getRateColor(0)).toBe('text-neutral-500');
  });
});

describe('getRateColorWithPip', () => {
  it('adds pip-up class for positive rates', () => {
    expect(getRateColorWithPip(0.01)).toContain('pip-up');
    expect(getRateColorWithPip(0.01)).toContain('text-success');
  });

  it('adds pip-down class for negative rates', () => {
    expect(getRateColorWithPip(-0.01)).toContain('pip-down');
    expect(getRateColorWithPip(-0.01)).toContain('text-danger');
  });

  it('omits pip class for zero', () => {
    expect(getRateColorWithPip(0)).not.toContain('pip-');
  });
});

describe('getHeatmapColor', () => {
  it('returns very-positive color for rates > 0.1', () => {
    expect(getHeatmapColor(0.2)).toContain('green-500');
    expect(getHeatmapColor(1)).toContain('green-500');
  });

  it('returns very-negative color for rates < -0.1', () => {
    expect(getHeatmapColor(-0.2)).toContain('red-500');
    expect(getHeatmapColor(-1)).toContain('red-500');
  });

  it('returns gradient bands for tiered rates', () => {
    // Different magnitudes produce different shades
    const rates = [0.05, 0.005, 0.001, 0, -0.001, -0.005, -0.05];
    const colors = rates.map(getHeatmapColor);
    // At least some are distinct (positive vs negative gradients differ)
    expect(new Set(colors).size).toBeGreaterThan(1);
  });

  it('returns neutral gray for undefined input', () => {
    expect(getHeatmapColor(undefined)).toContain('gray');
  });
});

describe('PERIOD_HOURS', () => {
  it('maps each period to the correct hour count', () => {
    expect(PERIOD_HOURS['1h']).toBe(1);
    expect(PERIOD_HOURS['4h']).toBe(4);
    expect(PERIOD_HOURS['8h']).toBe(8);
    expect(PERIOD_HOURS['24h']).toBe(24);
    expect(PERIOD_HOURS['1Y']).toBe(8760);  // 365 * 24
  });
});

describe('PERIOD_LABELS', () => {
  it('has uppercase labels', () => {
    (Object.keys(PERIOD_LABELS) as FundingPeriod[]).forEach((p) => {
      const label = PERIOD_LABELS[p];
      expect(label).toBe(label.toUpperCase());
    });
  });

  it('all periods have a corresponding label', () => {
    (['1h', '4h', '8h', '24h', '1Y'] as FundingPeriod[]).forEach((p) => {
      expect(PERIOD_LABELS[p]).toBeDefined();
    });
  });
});

describe('periodMultiplier', () => {
  it('returns 1 when native = target (8h → 8h)', () => {
    expect(periodMultiplier('8h', '8h')).toBe(1);
  });

  it('converts 1h native rate to 8h display (× 8)', () => {
    expect(periodMultiplier('1h', '8h')).toBe(8);
  });

  it('converts 8h native rate to 1h display (÷ 8)', () => {
    expect(periodMultiplier('8h', '1h')).toBe(0.125);
  });

  it('converts 8h native rate to annual (× 1095)', () => {
    // 8760 / 8 = 1095
    expect(periodMultiplier('8h', '1Y')).toBe(1095);
  });

  it('defaults to 8h when nativeInterval is unknown', () => {
    expect(periodMultiplier('unknown', '8h')).toBe(1);
  });

  it('handles undefined nativeInterval (defaults to 8h)', () => {
    expect(periodMultiplier(undefined, '8h')).toBe(1);
  });

  it('4h native to 8h display = ×2', () => {
    expect(periodMultiplier('4h', '8h')).toBe(2);
  });
});
