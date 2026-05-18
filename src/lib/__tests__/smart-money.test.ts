import { describe, it, expect } from 'vitest';
import { summariseFills } from '../smart-money';
import type { NormalizedTrade } from '../wallet-clients/types';

const NOW = new Date('2026-05-17T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const LOOKBACK = 90 * DAY;

function fill(o: Partial<NormalizedTrade>): NormalizedTrade {
  return {
    venue: 'hyperliquid',
    address: '0xabc',
    symbol: 'BTC',
    side: 'buy',
    sizeBase: 1,
    valueUsd: 50_000,
    feeUsd: 0,
    realizedPnlUsd: null, // opens default to null
    ts: new Date(NOW - DAY),
    txHash: null,
    ...o,
  };
}

describe('summariseFills', () => {
  it('returns zero-state for empty input', () => {
    expect(summariseFills([], LOOKBACK, NOW)).toEqual({
      realised: 0, closing: 0, wins: 0,
      biggestWin: 0, biggestLoss: 0,
      topSymbols: [], lastTs: null,
    });
  });

  it('sums realized PnL across closing fills', () => {
    const out = summariseFills([
      fill({ realizedPnlUsd: 1000 }),
      fill({ realizedPnlUsd: -200 }),
      fill({ realizedPnlUsd: 500 }),
    ], LOOKBACK, NOW);
    expect(out.realised).toBe(1300);
    expect(out.closing).toBe(3);
  });

  it('counts wins as STRICTLY > 0 PnL (breakeven not a win)', () => {
    const out = summariseFills([
      fill({ realizedPnlUsd: 100 }),    // win
      fill({ realizedPnlUsd: 0 }),      // breakeven, NOT a win
      fill({ realizedPnlUsd: -50 }),    // loss
    ], LOOKBACK, NOW);
    expect(out.wins).toBe(1);
    expect(out.closing).toBe(3);
  });

  it('skips fills with null realizedPnl from closing/wins (those are opens)', () => {
    const out = summariseFills([
      fill({ realizedPnlUsd: 100 }),    // close
      fill({ realizedPnlUsd: null }),   // open — NOT counted in closing
    ], LOOKBACK, NOW);
    expect(out.closing).toBe(1);
    expect(out.realised).toBe(100);
  });

  it('biggestWin defaults to 0 when there are no wins', () => {
    const out = summariseFills([
      fill({ realizedPnlUsd: -50 }),
      fill({ realizedPnlUsd: -100 }),
    ], LOOKBACK, NOW);
    expect(out.biggestWin).toBe(0);
  });

  it('biggestLoss defaults to 0 when there are no losses', () => {
    const out = summariseFills([
      fill({ realizedPnlUsd: 50 }),
      fill({ realizedPnlUsd: 100 }),
    ], LOOKBACK, NOW);
    expect(out.biggestLoss).toBe(0);
  });

  it('tracks the most-negative loss as biggestLoss', () => {
    const out = summariseFills([
      fill({ realizedPnlUsd: -50 }),
      fill({ realizedPnlUsd: -500 }),
      fill({ realizedPnlUsd: -100 }),
    ], LOOKBACK, NOW);
    expect(out.biggestLoss).toBe(-500);
  });

  it('filters fills outside the lookback window', () => {
    const tooOld = new Date(NOW - 100 * DAY); // older than 90d lookback
    const recent = new Date(NOW - 10 * DAY);
    const out = summariseFills([
      fill({ realizedPnlUsd: 9999, ts: tooOld }),
      fill({ realizedPnlUsd: 100, ts: recent }),
    ], LOOKBACK, NOW);
    expect(out.realised).toBe(100); // old fill excluded
    expect(out.closing).toBe(1);
  });

  it('lastTs is the max ts within the window (opens count too)', () => {
    const t1 = NOW - 10 * DAY;
    const t2 = NOW - 5 * DAY;
    const t3 = NOW - 1 * DAY;
    const out = summariseFills([
      fill({ realizedPnlUsd: 100, ts: new Date(t1) }),
      fill({ realizedPnlUsd: null, ts: new Date(t3) }), // open is most-recent
      fill({ realizedPnlUsd: -50,  ts: new Date(t2) }),
    ], LOOKBACK, NOW);
    expect(out.lastTs).toBe(t3);
  });

  it('topSymbols sorts by total valueUsd across ALL fills (not realized PnL)', () => {
    const out = summariseFills([
      fill({ symbol: 'BTC', valueUsd: 100 }),
      fill({ symbol: 'BTC', valueUsd: 200 }),
      fill({ symbol: 'ETH', valueUsd: 500 }),
      fill({ symbol: 'SOL', valueUsd: 50 }),
    ], LOOKBACK, NOW);
    expect(out.topSymbols).toEqual(['ETH', 'BTC', 'SOL']);
  });

  it('topSymbols caps at 5', () => {
    const fills = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s, i) =>
      fill({ symbol: s, valueUsd: 100 - i }),
    );
    const out = summariseFills(fills, LOOKBACK, NOW);
    expect(out.topSymbols).toHaveLength(5);
    expect(out.topSymbols).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('does not crash on a fill with valueUsd = 0', () => {
    const out = summariseFills([fill({ valueUsd: 0 })], LOOKBACK, NOW);
    expect(out.topSymbols).toEqual(['BTC']);
  });

  it('handles a single closing fill at the cutoff boundary', () => {
    // Edge case: a fill exactly at the cutoff should be EXCLUDED
    // (the filter uses strict <, so equality fails) — but lookback
    // is approximate, so this is informational. We just check it
    // doesn't crash.
    const at = NOW - LOOKBACK;
    const out = summariseFills([
      fill({ realizedPnlUsd: 100, ts: new Date(at - 1) }), // before cutoff
      fill({ realizedPnlUsd: 100, ts: new Date(at + 1) }), // after cutoff
    ], LOOKBACK, NOW);
    expect(out.closing).toBe(1); // only the post-cutoff fill counts
  });
});
