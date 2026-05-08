/**
 * Tests for summariseFills — the per-wallet stats engine for /smart-money.
 *
 * /smart-money ranks Hyperliquid wallets by 90-day realised PnL; this fn
 * does the actual reduction. A regression here would either:
 *   - mis-rank top wallets (e.g. counting opens as closes inflates "win rate")
 *   - drop wallets that should appear (lookback cutoff bug)
 *   - silently re-order top symbols (wrong "what they trade" badge)
 */
import { describe, it, expect } from 'vitest';
import { summariseFills } from '../smart-money';
import type { NormalizedTrade } from '../wallet-clients/types';

const NOW = new Date('2026-05-08T00:00:00Z').getTime();
const ONE_DAY = 86_400_000;

function fill(overrides: Partial<NormalizedTrade> & { ts: Date }): NormalizedTrade {
  return {
    symbol: 'BTC',
    side: 'buy',
    size: 1,
    price: 100_000,
    valueUsd: 100_000,
    venueTradeId: `t-${overrides.ts.getTime()}`,
    ...overrides,
  };
}

describe('summariseFills — lookback cutoff', () => {
  it('excludes fills older than lookbackMs', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 5 * ONE_DAY), realizedPnlUsd: 100, valueUsd: 1_000 }),
      fill({ ts: new Date(NOW - 95 * ONE_DAY), realizedPnlUsd: 9_999_999, valueUsd: 1_000 }), // outside
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.realised).toBe(100);
    expect(r.closing).toBe(1);
  });

  it('30d window is stricter than 90d', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 10 * ONE_DAY), realizedPnlUsd: 100, valueUsd: 1_000 }),
      fill({ ts: new Date(NOW - 60 * ONE_DAY), realizedPnlUsd: 200, valueUsd: 1_000 }),
    ];
    expect(summariseFills(fills, 90 * ONE_DAY, NOW).realised).toBe(300);
    expect(summariseFills(fills, 30 * ONE_DAY, NOW).realised).toBe(100);
  });

  it('returns zero/empty stats when nothing in window', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 200 * ONE_DAY), realizedPnlUsd: 100, valueUsd: 1_000 }),
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.realised).toBe(0);
    expect(r.closing).toBe(0);
    expect(r.wins).toBe(0);
    expect(r.lastTs).toBe(null);
    expect(r.topSymbols).toEqual([]);
  });
});

describe('summariseFills — realised + closing + wins', () => {
  it('only counts fills with non-null realizedPnlUsd as closes', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: 50, valueUsd: 1_000 }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: null, valueUsd: 1_000 }), // open
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: undefined, valueUsd: 1_000 }), // open
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.closing).toBe(1);
    expect(r.realised).toBe(50);
  });

  it('wins are strictly > 0 (zero PnL is breakeven, not a win)', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: 100, valueUsd: 1_000 }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: 0, valueUsd: 1_000 }),    // breakeven
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: -50, valueUsd: 1_000 }),
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.closing).toBe(3);
    expect(r.wins).toBe(1);
  });

  it('handles a wallet with all losing trades', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: -100, valueUsd: 1_000 }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: -200, valueUsd: 1_000 }),
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.realised).toBe(-300);
    expect(r.wins).toBe(0);
    expect(r.biggestWin).toBe(0); // sentinel — no winning fill
    expect(r.biggestLoss).toBe(-200);
  });
});

describe('summariseFills — biggest win / loss', () => {
  it('tracks the max single-fill win and the most-negative loss', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 1 * ONE_DAY), realizedPnlUsd: 250, valueUsd: 1_000 }),
      fill({ ts: new Date(NOW - 2 * ONE_DAY), realizedPnlUsd: 10_000, valueUsd: 1_000 }), // biggest
      fill({ ts: new Date(NOW - 3 * ONE_DAY), realizedPnlUsd: -5_500, valueUsd: 1_000 }), // worst
      fill({ ts: new Date(NOW - 4 * ONE_DAY), realizedPnlUsd: -100, valueUsd: 1_000 }),
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.biggestWin).toBe(10_000);
    expect(r.biggestLoss).toBe(-5_500);
  });
});

describe('summariseFills — top symbols by activity volume', () => {
  it('ranks symbols by aggregate valueUsd (incl. opens)', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: 'BTC', valueUsd: 5_000, realizedPnlUsd: null }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: 'BTC', valueUsd: 5_000, realizedPnlUsd: 100 }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: 'ETH', valueUsd: 50_000, realizedPnlUsd: null }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: 'SOL', valueUsd: 1_000, realizedPnlUsd: 50 }),
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    // ETH (50k) > BTC (10k) > SOL (1k)
    expect(r.topSymbols).toEqual(['ETH', 'BTC', 'SOL']);
  });

  it('caps the top-symbols list at 5 entries', () => {
    const fills: NormalizedTrade[] = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'PEPE', 'WIF'].map((sym, i) =>
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: sym, valueUsd: (10 - i) * 1000, realizedPnlUsd: null }),
    );
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.topSymbols.length).toBe(5);
    expect(r.topSymbols[0]).toBe('BTC');
  });

  it('aggregates duplicate-symbol fills into one bucket', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: 'BTC', valueUsd: 100 }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: 'BTC', valueUsd: 200 }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), symbol: 'BTC', valueUsd: 300 }),
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.topSymbols).toEqual(['BTC']);
  });
});

describe('summariseFills — lastTs', () => {
  it('returns the max ts in the window (incl. opens)', () => {
    const fills: NormalizedTrade[] = [
      fill({ ts: new Date(NOW - 5 * ONE_DAY), valueUsd: 1_000 }),
      fill({ ts: new Date(NOW - 1 * ONE_DAY), valueUsd: 1_000 }), // most recent
      fill({ ts: new Date(NOW - 3 * ONE_DAY), valueUsd: 1_000 }),
    ];
    const r = summariseFills(fills, 90 * ONE_DAY, NOW);
    expect(r.lastTs).toBe(NOW - 1 * ONE_DAY);
  });

  it('null when no fills are in the window', () => {
    const r = summariseFills([], 90 * ONE_DAY, NOW);
    expect(r.lastTs).toBe(null);
  });
});
