import { describe, it, expect } from 'vitest';
import { intervalHoursFor, dailyFundingCarryUsd } from '../funding-intervals';

describe('intervalHoursFor', () => {
  it('returns 1 for 1h venues', () => {
    expect(intervalHoursFor('Hyperliquid')).toBe(1);
    expect(intervalHoursFor('GMX')).toBe(1);
    expect(intervalHoursFor('Lighter')).toBe(1);
  });

  it('returns 8 for standard CEXes', () => {
    expect(intervalHoursFor('Binance')).toBe(8);
    expect(intervalHoursFor('Bybit')).toBe(8);
    expect(intervalHoursFor('OKX')).toBe(8);
  });

  it('returns 4 for Kraken', () => {
    expect(intervalHoursFor('Kraken')).toBe(4);
  });

  it('falls back to 8 for unknown exchanges', () => {
    expect(intervalHoursFor('NewVenue')).toBe(8);
    expect(intervalHoursFor('')).toBe(8);
  });

  it('strips disambiguator suffixes', () => {
    expect(intervalHoursFor('GMX (Avax)')).toBe(1);
    expect(intervalHoursFor('Lighter (acct 2)')).toBe(1);
    expect(intervalHoursFor('Binance (sub)')).toBe(8);
  });
});

describe('dailyFundingCarryUsd', () => {
  it('long paying positive funding has negative carry (cost)', () => {
    // 100k position, 0.01% per 8h, long → -100k * 0.0001 * 3 = -$30/day
    const carry = dailyFundingCarryUsd({
      side: 'long',
      positionValue: 100_000,
      currentFundingPct: 0.01,
      exchange: 'Binance',
    });
    expect(carry).toBeCloseTo(-30, 1);
  });

  it('long receiving negative funding has positive carry', () => {
    // 100k long, -0.01% per 8h → carry = +$30/day (longs receive)
    const carry = dailyFundingCarryUsd({
      side: 'long',
      positionValue: 100_000,
      currentFundingPct: -0.01,
      exchange: 'Binance',
    });
    expect(carry).toBeCloseTo(30, 1);
  });

  it('short paying negative funding has negative carry', () => {
    // 100k short, -0.01% per 8h → shorts pay → -$30/day
    const carry = dailyFundingCarryUsd({
      side: 'short',
      positionValue: 100_000,
      currentFundingPct: -0.01,
      exchange: 'Binance',
    });
    expect(carry).toBeCloseTo(-30, 1);
  });

  it('short receiving positive funding has positive carry', () => {
    // 100k short, +0.01% per 8h → shorts receive → +$30/day
    const carry = dailyFundingCarryUsd({
      side: 'short',
      positionValue: 100_000,
      currentFundingPct: 0.01,
      exchange: 'Binance',
    });
    expect(carry).toBeCloseTo(30, 1);
  });

  it('1h venue compounds 24x per day vs 8h venue 3x', () => {
    // Same nominal rate, but 1h venue's daily cost is 8x larger
    const hl = dailyFundingCarryUsd({
      side: 'long',
      positionValue: 100_000,
      currentFundingPct: 0.001,
      exchange: 'Hyperliquid',
    });
    const binance = dailyFundingCarryUsd({
      side: 'long',
      positionValue: 100_000,
      currentFundingPct: 0.001,
      exchange: 'Binance',
    });
    expect(Math.abs(hl!)).toBeCloseTo(Math.abs(binance!) * (8 / 1), 2);
  });

  it('returns null when position value is missing', () => {
    expect(dailyFundingCarryUsd({
      side: 'long',
      positionValue: null,
      currentFundingPct: 0.01,
      exchange: 'Binance',
    })).toBeNull();
  });

  it('returns null when funding rate is missing', () => {
    expect(dailyFundingCarryUsd({
      side: 'long',
      positionValue: 100_000,
      currentFundingPct: null,
      exchange: 'Binance',
    })).toBeNull();
  });

  it('returns null for zero or negative position value', () => {
    expect(dailyFundingCarryUsd({
      side: 'long',
      positionValue: 0,
      currentFundingPct: 0.01,
      exchange: 'Binance',
    })).toBeNull();
  });

  it('zero rate gives zero carry', () => {
    const carry = dailyFundingCarryUsd({
      side: 'long',
      positionValue: 100_000,
      currentFundingPct: 0,
      exchange: 'Binance',
    });
    // ±0 — JS gives -0 when multiplying positive × negative-zero, but
    // for our purposes any zero is fine.
    expect(Math.abs(carry ?? NaN)).toBe(0);
  });

  it('respects disambiguated GMX exchange labels', () => {
    const carry = dailyFundingCarryUsd({
      side: 'long',
      positionValue: 100_000,
      currentFundingPct: 0.001,
      exchange: 'GMX (Avax)',
    });
    // 1h venue: 100k * 0.00001 * 24 * -1 = -24
    expect(carry).toBeCloseTo(-24, 1);
  });
});
