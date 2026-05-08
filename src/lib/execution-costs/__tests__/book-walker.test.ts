/**
 * Tests for the orderbook walker — the math behind /trade-optimizer's
 * "true execution cost" ranking. A regression here would mis-rank
 * venues, telling users a venue is cheap when it's expensive
 * (or vice versa). Page still loads. Numbers silently wrong.
 *
 * walkBook: traverse a side of the book, fill an order of the requested
 *   USD size, return VWAP. Bug surface: off-by-one on remaining size,
 *   wrong base-quantity accumulation, divide-by-zero when size = 0.
 *
 * computeCostFromWalk: split the slippage between bid-ask spread (cost
 *   of crossing) and price impact (cost of depth consumption).
 *   Bug surface: forgetting the abs() — sign-flips for shorts.
 *
 * maxFillableUsd: total USD depth — drives "size too large" warnings.
 */
import { describe, it, expect } from 'vitest';
import {
  walkBook,
  computeCostFromWalk,
  maxFillableUsd,
  buildDepthCurve,
} from '../book-walker';
import type { OrderbookLevel } from '../types';

describe('walkBook — fully fills with deep book', () => {
  it('returns the best-level price as VWAP when one level is enough', () => {
    const asks: OrderbookLevel[] = [
      { price: 100, size: 100 },  // 100 BTC * $100 = $10,000 depth
    ];
    const r = walkBook(asks, 5000, 100); // want $5k @ mid=100
    expect(r.vwap).toBe(100);
    expect(r.filledUsd).toBe(5000);
    expect(r.levelsConsumed).toBe(1);
  });

  it('weights VWAP across multiple levels', () => {
    const asks: OrderbookLevel[] = [
      { price: 100, size: 10 },   // $1,000 @ 100
      { price: 110, size: 10 },   // $1,100 @ 110
    ];
    // Order of $2,100 fills both levels exactly.
    // 10 base @ 100 = $1000, 10 base @ 110 = $1100, total 20 base = $2100.
    // VWAP = $2100/20 = $105
    const r = walkBook(asks, 2100, 105);
    expect(r.vwap).toBeCloseTo(105, 5);
    expect(r.filledUsd).toBe(2100);
    expect(r.levelsConsumed).toBe(2);
  });

  it('partially consumes the second level when the first is insufficient', () => {
    const asks: OrderbookLevel[] = [
      { price: 100, size: 10 },   // $1,000 @ 100
      { price: 110, size: 10 },   // $1,100 @ 110 (partial: only $500 needed)
    ];
    // Want $1,500 — fills L1 ($1k) + half of L2 ($500 / 110 ≈ 4.545 BTC).
    const r = walkBook(asks, 1500, 105);
    expect(r.filledUsd).toBe(1500);
    expect(r.levelsConsumed).toBe(2);
    // VWAP between 100 and 110, closer to 100 (more weight on L1)
    expect(r.vwap).toBeGreaterThan(100);
    expect(r.vwap).toBeLessThan(110);
  });
});

describe('walkBook — partial fills (book exhausted)', () => {
  it('fills as much as possible and reports the actual filledUsd', () => {
    const asks: OrderbookLevel[] = [
      { price: 100, size: 5 },   // $500 only
    ];
    // Want $5k but only $500 available
    const r = walkBook(asks, 5000, 100);
    expect(r.filledUsd).toBe(500);
    expect(r.vwap).toBe(100);
    expect(r.levelsConsumed).toBe(1);
  });

  it('returns midPrice as VWAP when nothing fills', () => {
    const r = walkBook([], 1000, 99.5);
    expect(r.vwap).toBe(99.5);
    expect(r.filledUsd).toBe(0);
    expect(r.levelsConsumed).toBe(0);
  });

  it('skips zero-priced levels (defensive against bad upstream data)', () => {
    const asks: OrderbookLevel[] = [
      { price: 0, size: 100 },     // bad
      { price: 100, size: 10 },    // good but never reached
    ];
    const r = walkBook(asks, 500, 100);
    // Loop hits the zero-price guard and breaks; nothing fills.
    expect(r.filledUsd).toBe(0);
    expect(r.vwap).toBe(100); // falls back to mid
  });
});

describe('walkBook — degenerate inputs', () => {
  it('zero order size → zero fill', () => {
    const asks: OrderbookLevel[] = [{ price: 100, size: 100 }];
    const r = walkBook(asks, 0, 100);
    expect(r.filledUsd).toBe(0);
    expect(r.levelsConsumed).toBe(0);
  });

  it('empty book → no fill, fallback VWAP', () => {
    const r = walkBook([], 1000, 100);
    expect(r.filledUsd).toBe(0);
    expect(r.vwap).toBe(100);
  });
});

describe('computeCostFromWalk', () => {
  it('zero filledUsd → zero costs', () => {
    const r = computeCostFromWalk({ vwap: 100, filledUsd: 0, levelsConsumed: 0 }, 100);
    expect(r.spread).toBe(0);
    expect(r.priceImpact).toBe(0);
  });

  it('zero midPrice → zero costs (defensive)', () => {
    const r = computeCostFromWalk({ vwap: 100, filledUsd: 1000, levelsConsumed: 1 }, 0);
    expect(r.spread).toBe(0);
    expect(r.priceImpact).toBe(0);
  });

  it('splits slippage into spread (mid→best) + impact (best→VWAP)', () => {
    // mid=100, best ask=100.10 (10bps spread), VWAP=100.30 (30bps total slip)
    const r = computeCostFromWalk(
      { vwap: 100.30, filledUsd: 1000, levelsConsumed: 2 },
      100,
      100.10,
    );
    expect(r.spread).toBeCloseTo(0.10, 4);       // 10bps
    expect(r.priceImpact).toBeCloseTo(0.20, 4);  // 20bps additional
  });

  it('without bestLevelPrice, all slippage attributed to impact', () => {
    const r = computeCostFromWalk(
      { vwap: 100.30, filledUsd: 1000, levelsConsumed: 2 },
      100,
    );
    expect(r.spread).toBe(0);
    expect(r.priceImpact).toBeCloseTo(0.30, 4);
  });

  it('uses abs() so short-side (VWAP < mid) is still positive cost', () => {
    // For a SELL: VWAP into the bid side is BELOW mid. Slippage should still
    // surface as positive cost — not a negative "you got a discount".
    const r = computeCostFromWalk(
      { vwap: 99.70, filledUsd: 1000, levelsConsumed: 2 },
      100,
      99.90,
    );
    expect(r.spread).toBeCloseTo(0.10, 4);       // |99.90-100| / 100 = 10bps
    expect(r.priceImpact).toBeCloseTo(0.20, 4);  // 30bps total - 10 spread
  });

  it('priceImpact never goes negative (clamped to 0)', () => {
    // Pathological: bestLevelPrice further from mid than VWAP. Shouldn't happen
    // with a legit book but the function must not return a negative impact.
    const r = computeCostFromWalk(
      { vwap: 100.05, filledUsd: 1000, levelsConsumed: 1 },
      100,
      100.20,  // best level somehow further from mid than VWAP
    );
    expect(r.priceImpact).toBeGreaterThanOrEqual(0);
  });
});

describe('maxFillableUsd', () => {
  it('sums size × price across all levels', () => {
    const levels: OrderbookLevel[] = [
      { price: 100, size: 5 },     // $500
      { price: 101, size: 10 },    // $1,010
      { price: 102, size: 20 },    // $2,040
    ];
    expect(maxFillableUsd(levels)).toBeCloseTo(3550, 5);
  });

  it('returns 0 for empty book', () => {
    expect(maxFillableUsd([])).toBe(0);
  });
});

describe('buildDepthCurve', () => {
  it('builds a cumulative depth curve with mid-relative offsets', () => {
    const levels: OrderbookLevel[] = [
      { price: 100, size: 10 },   // $1k cumulative, 0 bps from mid (mid=100)
      { price: 101, size: 10 },   // $2,010 cumulative, ~100 bps from mid
    ];
    const curve = buildDepthCurve(levels, 100, 'binance');
    expect(curve).toHaveLength(2);
    expect(curve[0].exchange).toBe('binance');
    expect(curve[0].cumulativeUsd).toBe(1000);
    expect(curve[0].priceOffset).toBe(0);
    expect(curve[1].cumulativeUsd).toBe(2010);
    expect(curve[1].priceOffset).toBe(1); // 1% offset rounded to 3 decimals
  });

  it('handles zero midPrice without divide-by-zero', () => {
    const levels: OrderbookLevel[] = [{ price: 100, size: 10 }];
    const curve = buildDepthCurve(levels, 0, 'binance');
    expect(curve[0].priceOffset).toBe(0); // graceful fallback
    expect(curve[0].cumulativeUsd).toBe(1000);
  });
});
