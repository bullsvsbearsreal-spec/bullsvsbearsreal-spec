import { describe, it, expect, vi } from 'vitest';
import {
  normalizeFundingRate,
  checkPriceDivergence,
  runSanityChecks,
} from '../funding-normalizer';

describe('normalizeFundingRate', () => {
  it('combines toFundingRate + validateRate + console.warn on extreme', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 0.001 fraction at 1h raw → 1h target = 0.1%. Within cap (62.5 for 1h).
    const out = normalizeFundingRate(0.001, {
      precision: 'fraction',
      rawInterval: '1h',
      targetInterval: '1h',
    }, 'Binance', 'BTCUSDT');
    expect(out).toBeCloseTo(0.1, 4);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs a warning when rate exceeds the per-interval cap', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 10 (already in percentage) per 8h, interval 8h, cap = 500. Within cap.
    // To exceed: use 1000 percentage value
    const out = normalizeFundingRate(1000, {
      precision: 'percentage',
      rawInterval: '8h',
      targetInterval: '8h',
    }, 'Binance', 'BTCUSDT');
    // Rate gets capped to 500 (signed)
    expect(out).toBe(500);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('Binance');
    expect(warnSpy.mock.calls[0][0]).toContain('BTCUSDT');
    warnSpy.mockRestore();
  });

  it('returns 0 + warning on NaN raw input', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = normalizeFundingRate(NaN as unknown as number, {
      precision: 'fraction', rawInterval: '8h', targetInterval: '8h',
    }, 'X', 'Y');
    expect(out).toBe(0);
    warnSpy.mockRestore();
  });
});

describe('checkPriceDivergence', () => {
  it('returns null when divergence is within tolerance', () => {
    expect(checkPriceDivergence(50000, 50000, 'Binance', 'BTC')).toBeNull();
    expect(checkPriceDivergence(50100, 50000, 'Binance', 'BTC')).toBeNull();  // 0.2%
    expect(checkPriceDivergence(52000, 50000, 'Binance', 'BTC')).toBeNull();  // 4%
  });

  it('returns a warning string when divergence > 5%', () => {
    const out = checkPriceDivergence(55000, 50000, 'Binance', 'BTC');
    expect(out).toBeTruthy();
    expect(out).toContain('Binance');
    expect(out).toContain('BTC');
    expect(out).toMatch(/10\.0%/);
  });

  it('returns null when either price is non-positive (insufficient data)', () => {
    expect(checkPriceDivergence(0, 50000, 'X', 'Y')).toBeNull();
    expect(checkPriceDivergence(50000, 0, 'X', 'Y')).toBeNull();
    expect(checkPriceDivergence(-1, 50000, 'X', 'Y')).toBeNull();
    expect(checkPriceDivergence(50000, -1, 'X', 'Y')).toBeNull();
  });

  it('uses absolute value (mark > index AND mark < index both fire)', () => {
    expect(checkPriceDivergence(46000, 50000, 'X', 'Y')).toBeTruthy();  // -8%
    expect(checkPriceDivergence(54000, 50000, 'X', 'Y')).toBeTruthy();  // +8%
    // Sub-threshold on both sides:
    expect(checkPriceDivergence(49000, 50000, 'X', 'Y')).toBeNull();    // -2%
    expect(checkPriceDivergence(51000, 50000, 'X', 'Y')).toBeNull();    // +2%
  });
});

describe('runSanityChecks', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zero counts for empty input', () => {
    const report = runSanityChecks([]);
    expect(report.zeroRateCount).toBe(0);
    expect(report.cappedCount).toBe(0);
    expect(report.missingIntervalCount).toBe(0);
    expect(report.warnings).toEqual([]);
  });

  it('counts entries with fundingRate === 0', () => {
    const report = runSanityChecks([
      { symbol: 'BTC', exchange: 'Binance', fundingRate: 0, fundingInterval: '8h' },
      { symbol: 'ETH', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
      { symbol: 'SOL', exchange: 'Binance', fundingRate: 0, fundingInterval: '8h' },
    ]);
    expect(report.zeroRateCount).toBe(2);
  });

  it('counts entries missing fundingInterval', () => {
    const report = runSanityChecks([
      { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01 },  // no interval
      { symbol: 'ETH', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
    ]);
    expect(report.missingIntervalCount).toBe(1);
  });

  it('flags exchanges where >80% of rates are zero (likely broken API)', () => {
    // 5 entries from one exchange, 5 with zero rates
    const data = Array.from({ length: 5 }, (_, i) => ({
      symbol: `S${i}`, exchange: 'BrokenEx', fundingRate: 0, fundingInterval: '8h',
    }));
    const report = runSanityChecks(data);
    expect(report.warnings.some((w) => w.includes('BrokenEx'))).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does NOT flag exchanges with <5 entries even if all zero', () => {
    const data = Array.from({ length: 3 }, (_, i) => ({
      symbol: `S${i}`, exchange: 'Tiny', fundingRate: 0, fundingInterval: '8h',
    }));
    const report = runSanityChecks(data);
    expect(report.warnings.some((w) => w.includes('Tiny'))).toBe(false);
  });

  it('emits a single warning when any entry is missing interval', () => {
    const data = Array.from({ length: 3 }, (_, i) => ({
      symbol: `S${i}`, exchange: 'X', fundingRate: 0.01,
    }));
    const report = runSanityChecks(data);
    expect(report.warnings.some((w) => w.includes('missing fundingInterval'))).toBe(true);
  });
});
