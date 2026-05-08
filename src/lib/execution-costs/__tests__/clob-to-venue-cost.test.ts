/**
 * Tests for clobToVenueCost — the per-venue cost row builder for
 * /trade-optimizer. This is the function that decides whether a venue
 * shows up as "cheapest" / "available" / "insufficient depth".
 *
 * Past silent failures we are guarding against:
 *   - Lighter's indexer returning empty books → previously sorted to
 *     the top with 0bps cost, telling users "Lighter is the cheapest!"
 *     when it physically couldn't fill the order. Fixed by setting
 *     available:false on empty book.
 *   - Tiny venues with $50k of depth getting recommended for $5M orders
 *     because the slippage extrapolation came out small. Fixed by the
 *     50% partial-fill guard.
 *
 * A regression here would re-introduce both classes of bug: pages
 * still load, top recommendation is silently wrong.
 */
import { describe, it, expect } from 'vitest';
import { clobToVenueCost } from '../calculator';
import type { RawBookData } from '../types';

function book(overrides: Partial<RawBookData>): RawBookData {
  return {
    exchange: 'Binance',
    symbol: 'BTC',
    midPrice: 100,
    method: 'clob',
    bids: [
      { price: 99.95, size: 100 },   // $9,995
      { price: 99.90, size: 100 },   // $9,990
      { price: 99.80, size: 100 },   // $9,980
    ],
    asks: [
      { price: 100.05, size: 100 },  // $10,005
      { price: 100.10, size: 100 },  // $10,010
      { price: 100.20, size: 100 },  // $10,020
    ],
    ...overrides,
  };
}

describe('clobToVenueCost — null and empty inputs', () => {
  it('returns null when book is null', () => {
    expect(clobToVenueCost(null, 1000, 'long')).toBe(null);
  });

  it('returns available:false on empty asks for a long', () => {
    const r = clobToVenueCost(book({ asks: [] }), 1000, 'long')!;
    expect(r.available).toBe(false);
    expect(r.error).toBe('Empty book');
    expect(r.totalCost).toBe(0); // does NOT report 0bps as a real cost
  });

  it('returns available:false on empty bids for a short', () => {
    const r = clobToVenueCost(book({ bids: [] }), 1000, 'short')!;
    expect(r.available).toBe(false);
    expect(r.error).toBe('Empty book');
  });
});

describe('clobToVenueCost — direction routing', () => {
  it('long uses asks (you cross the bid-ask spread upward)', () => {
    const r = clobToVenueCost(book({}), 5000, 'long')!;
    expect(r.available).toBe(true);
    // Best ask 100.05 > mid 100 → spread should be positive
    expect(r.spread).toBeGreaterThan(0);
    expect(r.executionPrice).toBeGreaterThan(100);
  });

  it('short uses bids (you cross downward, but cost is still positive %)', () => {
    const r = clobToVenueCost(book({}), 5000, 'short')!;
    expect(r.available).toBe(true);
    // Best bid 99.95 < mid 100 → execution price below mid
    expect(r.executionPrice).toBeLessThan(100);
    // But spread + impact are positive percentages (they're costs)
    expect(r.spread).toBeGreaterThan(0);
    expect(r.priceImpact).toBeGreaterThanOrEqual(0);
  });
});

describe('clobToVenueCost — partial-fill guard (50%)', () => {
  it('marks available:false when book absorbs <50% of order', () => {
    // Book has only ~$30k depth on the asks side, asking for $200k.
    // fillRatio = 30035/200000 ≈ 0.15 → guard fires.
    const r = clobToVenueCost(book({}), 200_000, 'long')!;
    expect(r.available).toBe(false);
    expect(r.error).toMatch(/Insufficient depth/);
    expect(r.error).toMatch(/\$\d+k available/); // includes max-fill hint
  });

  it('available at the exact 50% boundary (guard is < 0.5, not <=)', () => {
    // Total ask depth = 30035 (3 levels × 100 size × ~100 price).
    // Order $60_070 → fillRatio = 30035/60070 = 0.5 exactly → guard does
    // NOT fire (boundary is exclusive). Documents the inclusive/exclusive
    // semantics so a refactor can't silently flip it.
    const r = clobToVenueCost(book({}), 60_070, 'long')!;
    expect(r.available).toBe(true);
  });

  it('available when book fills >=50%', () => {
    // Order $1k against $30k of depth → 100% fill.
    const r = clobToVenueCost(book({}), 1_000, 'long')!;
    expect(r.available).toBe(true);
    expect(r.totalCost).toBeGreaterThanOrEqual(0);
  });
});

describe('clobToVenueCost — fee + spread + impact composition', () => {
  it('totalCost = fee + spread + priceImpact', () => {
    const r = clobToVenueCost(book({ exchange: 'Binance' }), 1000, 'long')!;
    expect(r.totalCost).toBeCloseTo(r.fee + r.spread + r.priceImpact, 6);
  });

  it('uses the venue\'s configured taker fee', () => {
    // Binance fee = 0.0500 (5bps)
    const r = clobToVenueCost(book({ exchange: 'Binance' }), 1000, 'long')!;
    expect(r.fee).toBeCloseTo(0.05, 4);
  });

  it('falls back to fee=0 for an unknown exchange', () => {
    const r = clobToVenueCost(book({ exchange: 'NonexistentExchange' }), 1000, 'long')!;
    expect(r.fee).toBe(0);
  });
});

describe('clobToVenueCost — output shape', () => {
  it('reports method, midPrice, maxFillableSize, depthLevels', () => {
    const r = clobToVenueCost(book({}), 5000, 'long')!;
    expect(r.method).toBe('clob');
    expect(r.midPrice).toBe(100);
    expect(r.maxFillableSize).toBeGreaterThan(0);
    expect(r.depthLevels).toBeGreaterThan(0);
  });

  it('clamps non-finite spread/impact to 0 (defensive)', () => {
    // midPrice=0 would produce Infinity in slippage calc — should fall back.
    const r = clobToVenueCost(book({ midPrice: 0 }), 1000, 'long')!;
    // With midPrice=0, the fillRatio guard will fire first or the spread
    // calc returns 0. Either way the row must have finite numbers.
    expect(Number.isFinite(r.spread)).toBe(true);
    expect(Number.isFinite(r.priceImpact)).toBe(true);
    expect(Number.isFinite(r.totalCost)).toBe(true);
  });
});
