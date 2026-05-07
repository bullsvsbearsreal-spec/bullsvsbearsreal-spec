import { describe, it, expect } from 'vitest';
import { computeCostBasis } from '../cost-basis';
import type { UserTradeRow } from '../db';

// Helper: build a trade row with sensible defaults so each test only
// has to specify the fields it cares about.
function trade(overrides: Partial<UserTradeRow>): UserTradeRow {
  return {
    id: '1',
    userId: 'u1',
    sourceType: 'cex',
    sourceId: 1,
    exchange: 'Binance',
    symbol: 'BTC',
    side: 'buy',
    direction: null,
    venueTradeId: 'v1',
    size: 1,
    price: 50_000,
    valueUsd: 50_000,
    feeUsd: 0,
    realizedPnlUsd: null,
    ts: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('computeCostBasis — empty + edge cases', () => {
  it('returns zero summary on empty trade list', () => {
    const r = computeCostBasis([]);
    expect(r.realizedPnlUsd).toBe(0);
    expect(r.feesUsd).toBe(0);
    expect(r.netUsd).toBe(0);
    expect(r.openPositions).toEqual([]);
    expect(r.topWinners).toEqual([]);
    expect(r.topLosers).toEqual([]);
    expect(r.byYear).toEqual([]);
  });

  it('a single open trade leaves one open lot, no realised PnL', () => {
    const trades = [trade({ direction: 'open', side: 'buy', size: 1, price: 50_000 })];
    const r = computeCostBasis(trades);
    expect(r.realizedPnlUsd).toBe(0);
    expect(r.openPositions).toHaveLength(1);
    expect(r.openPositions[0]).toMatchObject({
      symbol: 'BTC',
      side: 'long',
      totalSize: 1,
      avgCostBasis: 50_000,
    });
  });
});

describe('computeCostBasis — long open + close FIFO', () => {
  it('one open + one close at higher price → positive realised', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 1, price: 50_000, ts: new Date('2026-01-01') }),
      trade({ id: '2', direction: 'close', side: 'sell', size: 1, price: 60_000, realizedPnlUsd: 10_000, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    // FIFO: closing 1 BTC @ 60k against the 50k lot → +10k realised
    expect(r.realizedPnlUsd).toBe(10_000);
    expect(r.openPositions).toHaveLength(0);
  });

  it('FIFO across multiple lots picks oldest first', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 1, price: 40_000, ts: new Date('2026-01-01') }),
      trade({ id: '2', direction: 'open', side: 'buy', size: 1, price: 60_000, ts: new Date('2026-01-15') }),
      trade({ id: '3', direction: 'close', side: 'sell', size: 1, price: 50_000, realizedPnlUsd: 10_000, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    // FIFO closes the 40k lot at 50k → +10k. The 60k lot still open.
    expect(r.realizedPnlUsd).toBe(10_000);
    expect(r.openPositions).toHaveLength(1);
    expect(r.openPositions[0].avgCostBasis).toBe(60_000);
  });

  it('partial close pops only the consumed amount from the lot', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 2, price: 50_000, ts: new Date('2026-01-01') }),
      trade({ id: '2', direction: 'close', side: 'sell', size: 0.5, price: 60_000, realizedPnlUsd: 5_000, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.realizedPnlUsd).toBe(5_000);
    expect(r.openPositions[0].totalSize).toBe(1.5);
    expect(r.openPositions[0].avgCostBasis).toBe(50_000);
  });
});

describe('computeCostBasis — short side', () => {
  it('short open + close at lower price → positive realised', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'sell', size: 1, price: 50_000, ts: new Date('2026-01-01') }),
      trade({ id: '2', direction: 'close', side: 'buy', size: 1, price: 40_000, realizedPnlUsd: 10_000, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    // Short PnL = (cost − close) × size = (50k − 40k) × 1 = +10k
    expect(r.realizedPnlUsd).toBe(10_000);
  });
});

describe('computeCostBasis — fee accounting (the bug we just fixed)', () => {
  it('fee on a single-lot close is counted ONCE', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 1, price: 50_000, feeUsd: 5, ts: new Date('2026-01-01') }),
      trade({ id: '2', direction: 'close', side: 'sell', size: 1, price: 60_000, realizedPnlUsd: 10_000, feeUsd: 6, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.feesUsd).toBe(11);
    expect(r.netUsd).toBe(10_000 - 11);
  });

  it('fee on a fill that spans multiple lots is NOT double-counted', () => {
    // Close 1.5 BTC across two 1-BTC lots. Fee should still be exactly $9.
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 1, price: 40_000, ts: new Date('2026-01-01') }),
      trade({ id: '2', direction: 'open', side: 'buy', size: 1, price: 60_000, ts: new Date('2026-01-15') }),
      trade({ id: '3', direction: 'close', side: 'sell', size: 1.5, price: 70_000, realizedPnlUsd: 35_000, feeUsd: 9, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    // The closing fill's fee should appear exactly once in feesUsd, not
    // multiplied by the number of lot pops.
    expect(r.feesUsd).toBe(9);
    // Realised: 1 × (70−40) + 0.5 × (70−60) = 30 + 5 = 35
    expect(r.realizedPnlUsd).toBeCloseTo(35_000, 0);
  });
});

describe('computeCostBasis — position flip', () => {
  it('a sell larger than open longs closes them then opens a short remainder', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 1, price: 50_000, ts: new Date('2026-01-01') }),
      // Direction='close' but size > existing lot → flip
      trade({ id: '2', direction: 'close', side: 'sell', size: 2, price: 60_000, realizedPnlUsd: 10_000, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.realizedPnlUsd).toBe(10_000); // closed the 1 BTC at +10k
    expect(r.openPositions).toHaveLength(1);
    expect(r.openPositions[0]).toMatchObject({
      symbol: 'BTC',
      side: 'short',          // remainder opens a short
      totalSize: 1,
      avgCostBasis: 60_000,
    });
  });
});

describe('computeCostBasis — by-year buckets + YTD', () => {
  it('groups realised PnL by calendar year', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 1, price: 40_000, ts: new Date('2025-06-01') }),
      trade({ id: '2', direction: 'close', side: 'sell', size: 1, price: 50_000, realizedPnlUsd: 10_000, ts: new Date('2025-12-01') }),
      trade({ id: '3', direction: 'open', side: 'buy', size: 1, price: 60_000, ts: new Date('2026-01-15') }),
      trade({ id: '4', direction: 'close', side: 'sell', size: 1, price: 70_000, realizedPnlUsd: 10_000, ts: new Date('2026-03-01') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.realizedPnlUsd).toBe(20_000);
    const byYearMap = Object.fromEntries(r.byYear.map(y => [y.year, y.realized]));
    expect(byYearMap[2025]).toBe(10_000);
    expect(byYearMap[2026]).toBe(10_000);
  });
});

describe('computeCostBasis — top winners + losers', () => {
  it('separates positive and negative realised pairs', () => {
    const trades = [
      // BTC: winner
      trade({ id: '1', symbol: 'BTC', direction: 'open', side: 'buy', size: 1, price: 40_000, ts: new Date('2026-01-01') }),
      trade({ id: '2', symbol: 'BTC', direction: 'close', side: 'sell', size: 1, price: 50_000, realizedPnlUsd: 10_000, ts: new Date('2026-02-01') }),
      // ETH: loser
      trade({ id: '3', symbol: 'ETH', direction: 'open', side: 'buy', size: 10, price: 4_000, ts: new Date('2026-01-01') }),
      trade({ id: '4', symbol: 'ETH', direction: 'close', side: 'sell', size: 10, price: 3_500, realizedPnlUsd: -5_000, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.topWinners.find(p => p.symbol === 'BTC')?.pnl).toBe(10_000);
    expect(r.topLosers.find(p => p.symbol === 'ETH')?.pnl).toBe(-5_000);
  });
});

describe('computeCostBasis — direction inference fallback', () => {
  it('treats a trade with non-zero realizedPnlUsd as a close even when direction is null', () => {
    const trades = [
      trade({ id: '1', direction: null, side: 'buy', size: 1, price: 50_000, ts: new Date('2026-01-01') }),
      // direction null + non-zero realizedPnlUsd → fallback "close" path
      trade({ id: '2', direction: null, side: 'sell', size: 1, price: 60_000, realizedPnlUsd: 10_000, ts: new Date('2026-02-01') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.realizedPnlUsd).toBe(10_000);
    expect(r.openPositions).toHaveLength(0);
  });

  it('treats a trade with null realizedPnlUsd as an open even when direction is null', () => {
    const trades = [
      trade({ id: '1', direction: null, side: 'buy', size: 1, price: 50_000, realizedPnlUsd: null, ts: new Date('2026-01-01') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.realizedPnlUsd).toBe(0);
    expect(r.openPositions).toHaveLength(1);
  });
});

describe('computeCostBasis — open lot aggregation', () => {
  it('aggregates same-side same-pair lots into one openPositions entry with weighted avg', () => {
    const trades = [
      trade({ id: '1', direction: 'open', side: 'buy', size: 1, price: 40_000, ts: new Date('2026-01-01') }),
      trade({ id: '2', direction: 'open', side: 'buy', size: 2, price: 50_000, ts: new Date('2026-01-15') }),
    ];
    const r = computeCostBasis(trades);
    expect(r.openPositions).toHaveLength(1);
    expect(r.openPositions[0].totalSize).toBe(3);
    // Weighted avg: (1 × 40 + 2 × 50) / 3 = 140/3 ≈ 46666.67
    expect(r.openPositions[0].avgCostBasis).toBeCloseTo(46_666.67, 1);
    expect(r.openPositions[0].lotCount).toBe(2);
  });

  it('isolates positions per (symbol, exchange)', () => {
    const trades = [
      trade({ id: '1', symbol: 'BTC', exchange: 'Binance', direction: 'open', side: 'buy', size: 1, price: 50_000 }),
      trade({ id: '2', symbol: 'BTC', exchange: 'Bybit', direction: 'open', side: 'buy', size: 1, price: 51_000 }),
      trade({ id: '3', symbol: 'ETH', exchange: 'Binance', direction: 'open', side: 'buy', size: 5, price: 4_000 }),
    ];
    const r = computeCostBasis(trades);
    expect(r.openPositions).toHaveLength(3); // each (sym, exch) is its own row
  });
});
