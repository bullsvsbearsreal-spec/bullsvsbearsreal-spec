/**
 * Unit tests for computeTradeStats — the math behind the live tape
 * sidebar's buy/sell/CVD/VWAP stats bar.
 *
 * Locks in the windowed vs session-wide split:
 *   - windowed: buyVolume / sellVolume / netDelta / tradeCount /
 *     tradeSpeed / bigBuys / bigSells
 *   - session-wide: cvd / vwap / cvdHistory
 *
 * Also locks in `now` injection so the function is deterministic
 * under test (vs. the original which read Date.now() inline).
 */

import { describe, it, expect } from 'vitest';
import {
  computeTradeStats,
  BIG_TRADE_USD,
  type RealtimeTrade,
} from '../computeTradeStats';

/** Helper: build a trade with sensible defaults. */
function tr(opts: Partial<RealtimeTrade> & { time: number }): RealtimeTrade {
  return {
    price: opts.price ?? 100,
    qty: opts.qty ?? 1,
    quoteQty: opts.quoteQty ?? (opts.price ?? 100) * (opts.qty ?? 1),
    isBuy: opts.isBuy ?? true,
    time: opts.time,
  };
}

describe('computeTradeStats', () => {
  /* ─── Empty / edge cases ─────────────────────────────────────── */

  it('returns zeroes on empty input', () => {
    const s = computeTradeStats([], 60_000, 1_000_000);
    expect(s).toEqual({
      buyVolume: 0,
      sellVolume: 0,
      netDelta: 0,
      tradeCount: 0,
      tradeSpeed: 0,
      bigBuys: 0,
      bigSells: 0,
      cvd: 0,
      vwap: 0,
      cvdHistory: [],
    });
  });

  it('returns zero stats when all trades outside window', () => {
    const now = 1_000_000;
    const trades = [
      tr({ time: now - 120_000, quoteQty: 1000, isBuy: true }),
    ];
    const s = computeTradeStats(trades, 60_000, now);
    expect(s.buyVolume).toBe(0);
    expect(s.tradeCount).toBe(0);
    // But session-wide CVD still sees the trade
    expect(s.cvd).toBe(1000);
    expect(s.vwap).toBe(100); // price 100, qty 1 → vwap = price
  });

  /* ─── Buy / sell windowed aggregation ────────────────────────── */

  describe('buy/sell windowed aggregation', () => {
    const now = 1_000_000;
    const trades = [
      // newest first (matches hook's internal ordering)
      tr({ time: now - 5_000,  quoteQty: 1000, isBuy: true }),
      tr({ time: now - 10_000, quoteQty: 500,  isBuy: false }),
      tr({ time: now - 15_000, quoteQty: 200,  isBuy: true }),
      tr({ time: now - 70_000, quoteQty: 999,  isBuy: true }), // outside 60s window
    ];

    it('sums buyVolume within window only', () => {
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.buyVolume).toBe(1200); // 1000 + 200, NOT 999
    });

    it('sums sellVolume within window only', () => {
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.sellVolume).toBe(500);
    });

    it('netDelta = buyVolume - sellVolume', () => {
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.netDelta).toBe(700);
    });

    it('tradeCount counts only windowed trades', () => {
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.tradeCount).toBe(3);
    });
  });

  /* ─── Big-trade thresholds ───────────────────────────────────── */

  describe('big trades', () => {
    const now = 1_000_000;

    it('counts bigBuys at >= BIG_TRADE_USD', () => {
      const trades = [
        tr({ time: now - 1000, quoteQty: BIG_TRADE_USD,     isBuy: true }),
        tr({ time: now - 2000, quoteQty: BIG_TRADE_USD - 1, isBuy: true }), // just below
        tr({ time: now - 3000, quoteQty: BIG_TRADE_USD + 1, isBuy: true }),
      ];
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.bigBuys).toBe(2);
      expect(s.bigSells).toBe(0);
    });

    it('counts bigSells at >= BIG_TRADE_USD', () => {
      const trades = [
        tr({ time: now - 1000, quoteQty: 100_000, isBuy: false }),
        tr({ time: now - 2000, quoteQty: 60_000,  isBuy: false }),
        tr({ time: now - 3000, quoteQty: 1_000,   isBuy: false }),
      ];
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.bigSells).toBe(2);
      expect(s.bigBuys).toBe(0);
    });

    it('respects custom bigTradeUsd threshold', () => {
      const trades = [
        tr({ time: now - 1000, quoteQty: 10_000, isBuy: true }),
        tr({ time: now - 2000, quoteQty:  4_000, isBuy: true }),
      ];
      const s = computeTradeStats(trades, 60_000, now, { bigTradeUsd: 5_000 });
      expect(s.bigBuys).toBe(1);
    });
  });

  /* ─── Trade speed ────────────────────────────────────────────── */

  describe('trade speed', () => {
    const now = 1_000_000;

    it('rounds to nearest integer trades/sec', () => {
      // 10 trades over a 10-second span → 1 trade/sec
      const trades = Array.from({ length: 10 }, (_, i) => tr({
        time: now - i * 1000, quoteQty: 100, isBuy: true,
      }));
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.tradeSpeed).toBe(1);
    });

    it('handles single-trade case without divide-by-zero', () => {
      const trades = [tr({ time: now, quoteQty: 100, isBuy: true })];
      const s = computeTradeStats(trades, 60_000, now);
      // span = 0 → falls through to spanSec = 1 → 1 trade / 1s = 1
      expect(s.tradeSpeed).toBe(1);
    });

    it('returns 0 trades/sec when window is empty', () => {
      const trades = [
        tr({ time: now - 999_999, quoteQty: 100, isBuy: true }),
      ];
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.tradeSpeed).toBe(0);
    });
  });

  /* ─── CVD (session-wide) ─────────────────────────────────────── */

  describe('CVD', () => {
    const now = 1_000_000;

    it('cumulates buy-sell across full session, ignores window', () => {
      const trades = [
        tr({ time: now - 1000,    quoteQty: 1000, isBuy: true }),
        tr({ time: now - 999_999, quoteQty: 600,  isBuy: false }), // outside any window
      ];
      const s = computeTradeStats(trades, 60_000, now);
      expect(s.cvd).toBe(400); // 1000 - 600
    });

    it('handles all sells (negative CVD)', () => {
      const trades = [
        tr({ time: now - 1000, quoteQty: 500, isBuy: false }),
        tr({ time: now - 2000, quoteQty: 200, isBuy: false }),
      ];
      expect(computeTradeStats(trades, 60_000, now).cvd).toBe(-700);
    });

    it('handles all buys (positive CVD)', () => {
      const trades = [
        tr({ time: now - 1000, quoteQty: 500, isBuy: true }),
        tr({ time: now - 2000, quoteQty: 200, isBuy: true }),
      ];
      expect(computeTradeStats(trades, 60_000, now).cvd).toBe(700);
    });
  });

  /* ─── VWAP (session-wide) ────────────────────────────────────── */

  describe('VWAP', () => {
    const now = 1_000_000;

    it('returns 0 when no volume', () => {
      const s = computeTradeStats([], 60_000, now);
      expect(s.vwap).toBe(0);
    });

    it('VWAP = price for a single trade', () => {
      const trades = [tr({ time: now, price: 50_000, qty: 1, quoteQty: 50_000, isBuy: true })];
      expect(computeTradeStats(trades, 60_000, now).vwap).toBe(50_000);
    });

    it('VWAP is volume-weighted, not arithmetic mean', () => {
      // 1 BTC @ $100, 9 BTC @ $200 → VWAP = (100 + 1800) / 10 = 190
      const trades = [
        tr({ time: now - 1000, price: 100, qty: 1, quoteQty: 100, isBuy: true }),
        tr({ time: now - 2000, price: 200, qty: 9, quoteQty: 1800, isBuy: true }),
      ];
      expect(computeTradeStats(trades, 60_000, now).vwap).toBeCloseTo(190, 5);
    });

    it('VWAP uses session-wide volume regardless of window filter', () => {
      const trades = [
        tr({ time: now - 1000,    price: 100, qty: 1, isBuy: true }),
        tr({ time: now - 999_999, price: 200, qty: 4, isBuy: true }), // out of window
      ];
      // Standard VWAP uses base qty: (100*1 + 200*4)/(1+4) = 900/5 = 180.
      // Even though only trade 1 is in window, both contribute to VWAP.
      expect(computeTradeStats(trades, 60_000, now).vwap).toBeCloseTo(180, 5);
    });
  });

  /* ─── CVD history (sparkline) ───────────────────────────────── */

  describe('CVD history', () => {
    const now = 1_000_000;

    it('returns empty when no trades', () => {
      expect(computeTradeStats([], 60_000, now).cvdHistory).toEqual([]);
    });

    it('emits up to bucket count for many trades', () => {
      const trades = Array.from({ length: 600 }, (_, i) => tr({
        time: now - i * 100, quoteQty: 10, isBuy: i % 2 === 0,
      }));
      const s = computeTradeStats(trades, 60_000, now);
      // step = Math.floor(600/60) = 10, so we sample every 10 → ~60 buckets
      expect(s.cvdHistory.length).toBeGreaterThan(50);
      expect(s.cvdHistory.length).toBeLessThanOrEqual(60);
    });

    it('emits 1 sample per trade when trade count < bucket count', () => {
      const trades = Array.from({ length: 5 }, (_, i) => tr({
        time: now - i * 100, quoteQty: 10, isBuy: true,
      }));
      const s = computeTradeStats(trades, 60_000, now);
      // step = max(1, floor(5/60)) = 1 → sample every trade → 5 entries
      expect(s.cvdHistory).toHaveLength(5);
    });

    it('respects custom cvdHistoryBuckets', () => {
      const trades = Array.from({ length: 100 }, (_, i) => tr({
        time: now - i * 100, quoteQty: 10, isBuy: true,
      }));
      const s = computeTradeStats(trades, 60_000, now, { cvdHistoryBuckets: 10 });
      // step = max(1, floor(100/10)) = 10 → 10 samples
      expect(s.cvdHistory.length).toBeLessThanOrEqual(10);
    });

    it('final cvdHistory value equals total CVD', () => {
      const trades = [
        tr({ time: now - 100, quoteQty: 300, isBuy: true }),
        tr({ time: now - 200, quoteQty: 100, isBuy: false }),
      ];
      const s = computeTradeStats(trades, 60_000, now);
      const lastSample = s.cvdHistory[s.cvdHistory.length - 1];
      expect(lastSample).toBe(s.cvd); // 300 - 100 = 200
    });
  });

  /* ─── windowMs = Infinity ───────────────────────────────────── */

  describe('window = all (Infinity)', () => {
    const now = 1_000_000;

    it('does not filter when windowMs is Infinity', () => {
      const trades = [
        tr({ time: now - 1_000_000_000, quoteQty: 100, isBuy: true }),
      ];
      const s = computeTradeStats(trades, Infinity, now);
      expect(s.tradeCount).toBe(1);
      expect(s.buyVolume).toBe(100);
    });
  });
});
