/**
 * Regression tests for simulateDcaCore (commit 8e911980).
 *
 * The original bug: dailyReturns used the POST-buy portfolio value, so
 * each $100 deposit looked like a "+huge%" daily return. Mean return
 * inflated → annualised return inflated → Sharpe inflated. Strategy
 * Backtest Lab showed Sharpe 4.08 on +1.80% return (physically impossible
 * — best-ever fund managers hit ~3).
 *
 * Fix: compute the time-weighted return from the PRE-buy value (units
 * held overnight × today's price), THEN do the buy. Sharpe / vol
 * calculations now reflect price-only changes.
 */
import { describe, it, expect } from 'vitest';
import { simulateDcaCore } from '../backtest';

// Helper: build a deterministic price series for testing.
function flatPrices(price: number, days: number): Array<{ date: string; price: number }> {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    price,
  }));
}

describe('simulateDcaCore — buy schedule', () => {
  it('buys on day 0 always (lastBuyAtIndex starts at -interval)', () => {
    const r = simulateDcaCore(flatPrices(100, 1), 10, 7);
    expect(r.trades).toBe(1);
    expect(r.deposited).toBe(10);
    expect(r.units).toBe(0.1); // 10 / 100
  });

  it('buys every N days when interval is N', () => {
    const r = simulateDcaCore(flatPrices(100, 14), 10, 7);
    // Day 0 + Day 7 = 2 buys
    expect(r.trades).toBe(2);
    expect(r.deposited).toBe(20);
  });

  it('buys daily when interval is 1', () => {
    const r = simulateDcaCore(flatPrices(100, 5), 10, 1);
    expect(r.trades).toBe(5);
    expect(r.deposited).toBe(50);
  });

  it('records a series entry every day regardless of buy', () => {
    const r = simulateDcaCore(flatPrices(100, 14), 10, 7);
    expect(r.series.length).toBe(14);
  });
});

describe('simulateDcaCore — TWR daily returns (the Sharpe-fix regression)', () => {
  it('returns 0% on a flat-price series, REGARDLESS of buy frequency', () => {
    // CRITICAL: this is what the original bug got wrong. With flat prices,
    // there is NO investment return — but post-buy values jumped on every
    // deposit day, producing fake non-zero daily returns.
    const r = simulateDcaCore(flatPrices(100, 14), 10, 1); // buy EVERY day
    // Should have 13 daily returns (n-1 for n days)
    expect(r.dailyReturns.length).toBe(13);
    // EVERY return should be 0 because price is flat and we use TWR
    for (const ret of r.dailyReturns) {
      expect(ret).toBeCloseTo(0, 10);
    }
  });

  it('reflects only price changes, not deposits, on a price-up series', () => {
    // 100, 110, 110, 110 → +10% on day 1, then flat
    const prices = [
      { date: '2026-01-01', price: 100 },
      { date: '2026-01-02', price: 110 },
      { date: '2026-01-03', price: 110 },
      { date: '2026-01-04', price: 110 },
    ];
    const r = simulateDcaCore(prices, 50, 1); // buy every day
    // 3 daily returns: from day0→day1, day1→day2, day2→day3
    expect(r.dailyReturns.length).toBe(3);
    // Day 1: price went 100→110 = +10% (units stayed same overnight)
    expect(r.dailyReturns[0]).toBeCloseTo(0.10, 4);
    // Days 2 & 3: price flat → 0% returns
    expect(r.dailyReturns[1]).toBeCloseTo(0, 10);
    expect(r.dailyReturns[2]).toBeCloseTo(0, 10);
  });

  it('produces a reasonable Sharpe-equivalent on a moderately volatile series', () => {
    // Daily +1% / -1% alternating — high vol, zero net return
    const prices = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      price: 100 * Math.pow(1.01, i % 2 === 0 ? 0 : 1) * Math.pow(0.99, Math.floor(i / 2)),
    }));
    const r = simulateDcaCore(prices, 100, 7);
    // Mean return should be near zero (oscillating).
    const mean = r.dailyReturns.reduce((s, x) => s + x, 0) / r.dailyReturns.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    // None of the daily returns should be wildly inflated by deposits
    // (the original bug showed +90%+ on buy days).
    for (const ret of r.dailyReturns) {
      expect(Math.abs(ret)).toBeLessThan(0.1); // <10% / day
    }
  });
});

describe('simulateDcaCore — series correctness', () => {
  it('records correct deposited amount on each day', () => {
    const r = simulateDcaCore(flatPrices(100, 14), 10, 7);
    expect(r.series[0].depositedUsd).toBe(10);
    expect(r.series[6].depositedUsd).toBe(10); // no buy yet
    expect(r.series[7].depositedUsd).toBe(20); // 2nd buy
    expect(r.series[13].depositedUsd).toBe(20); // still 20 (next buy day 14)
  });

  it('records correct portfolio value on each day', () => {
    // Buy 0.1 units on day 0 at $100, price doubles by day 1
    const r = simulateDcaCore(
      [
        { date: '2026-01-01', price: 100 },
        { date: '2026-01-02', price: 200 },
      ],
      10,
      7,
    );
    expect(r.series[0].valueUsd).toBe(10); // bought on day 0 at fair value
    expect(r.series[1].valueUsd).toBe(20); // 0.1 units × $200
  });

  it('roiPct reflects total deposits vs current value', () => {
    const r = simulateDcaCore(
      [
        { date: '2026-01-01', price: 100 },
        { date: '2026-01-02', price: 200 },
      ],
      10,
      7,
    );
    expect(r.series[0].roiPct).toBe(0); // just bought
    expect(r.series[1].roiPct).toBe(100); // $20 value vs $10 deposited = +100%
  });
});
