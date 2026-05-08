import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getHoldings,
  addHolding,
  updateHolding,
  removeHolding,
  clearHoldings,
  type Holding,
} from '../portfolio';

const storage = new Map<string, string>();
const mockLS = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLS, writable: true });
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

beforeEach(() => storage.clear());
afterEach(() => vi.useRealTimers());

describe('addHolding — basic + dedup', () => {
  it('starts empty', () => {
    expect(getHoldings()).toEqual([]);
  });

  it('adds a new holding with uppercased symbol + addedAt timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
    addHolding({ symbol: 'btc', quantity: 0.5, avgPrice: 100_000 });
    const list = getHoldings();
    expect(list).toHaveLength(1);
    expect(list[0].symbol).toBe('BTC');
    expect(list[0].quantity).toBe(0.5);
    expect(list[0].avgPrice).toBe(100_000);
    expect(list[0].addedAt).toBe(new Date('2026-05-08T12:00:00Z').getTime());
  });

  it('rejects empty symbol or non-positive quantity', () => {
    addHolding({ symbol: '', quantity: 1, avgPrice: 100 });
    addHolding({ symbol: 'BTC', quantity: 0, avgPrice: 100 });
    addHolding({ symbol: 'BTC', quantity: -0.5, avgPrice: 100 });
    expect(getHoldings()).toEqual([]);
  });
});

describe('addHolding — weighted-avg merge for existing symbol', () => {
  it('merges the new lot into the existing position with cost-weighted avg', () => {
    // Initial: 1 BTC @ $50,000 (cost basis $50k)
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 50_000 });
    // Add: 1 BTC @ $100,000 (cost basis $100k)
    // Combined: 2 BTC, total cost $150k, avg = $75,000.
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });

    const list = getHoldings();
    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(2);
    expect(list[0].avgPrice).toBeCloseTo(75_000, 2);
  });

  it('weighted avg with unequal lot sizes', () => {
    // 9 BTC @ $50k + 1 BTC @ $100k → 10 BTC at $55k avg
    addHolding({ symbol: 'BTC', quantity: 9, avgPrice: 50_000 });
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    const h = getHoldings()[0];
    expect(h.quantity).toBe(10);
    expect(h.avgPrice).toBeCloseTo(55_000, 2);
  });

  it('case-insensitive merge (btc and BTC merge)', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 50_000 });
    addHolding({ symbol: 'btc', quantity: 1, avgPrice: 100_000 });
    const list = getHoldings();
    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(2);
  });
});

describe('updateHolding', () => {
  it('updates quantity only', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    updateHolding('BTC', { quantity: 2 });
    const h = getHoldings()[0];
    expect(h.quantity).toBe(2);
    expect(h.avgPrice).toBe(100_000); // unchanged
  });

  it('updates avgPrice only', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    updateHolding('BTC', { avgPrice: 50_000 });
    expect(getHoldings()[0].avgPrice).toBe(50_000);
  });

  it('updates both', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    updateHolding('BTC', { quantity: 5, avgPrice: 60_000 });
    const h = getHoldings()[0];
    expect(h.quantity).toBe(5);
    expect(h.avgPrice).toBe(60_000);
  });

  it('no-op for non-existent symbol', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    updateHolding('ETH', { quantity: 5 });
    expect(getHoldings()).toHaveLength(1);
  });

  it('case-insensitive match', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    updateHolding('btc', { quantity: 2 });
    expect(getHoldings()[0].quantity).toBe(2);
  });
});

describe('removeHolding + clearHoldings', () => {
  it('removes by symbol (case-insensitive)', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    addHolding({ symbol: 'ETH', quantity: 5, avgPrice: 3_000 });
    removeHolding('btc');
    expect(getHoldings().map(h => h.symbol)).toEqual(['ETH']);
  });

  it('clearHoldings empties the list', () => {
    addHolding({ symbol: 'BTC', quantity: 1, avgPrice: 100_000 });
    addHolding({ symbol: 'ETH', quantity: 5, avgPrice: 3_000 });
    clearHoldings();
    expect(getHoldings()).toEqual([]);
  });
});

describe('defensive: bad localStorage data', () => {
  it('returns empty list on corrupt JSON', () => {
    storage.set('ih_portfolio', '{not-json');
    expect(getHoldings()).toEqual([]);
  });

  it('filters out malformed entries (missing/wrong-type fields)', () => {
    const mixed = [
      { symbol: 'BTC', quantity: 1, avgPrice: 100, addedAt: 1 }, // valid
      { symbol: 'ETH', quantity: 'big', avgPrice: 100, addedAt: 1 }, // bad qty
      null, // null entry
      { symbol: 'SOL', quantity: 5 }, // missing fields
      { symbol: 'BTC', quantity: 2, avgPrice: 100, addedAt: 2 }, // valid
    ];
    storage.set('ih_portfolio', JSON.stringify(mixed));
    const list = getHoldings();
    expect(list.length).toBe(2);
    expect(list.map(h => h.symbol)).toEqual(['BTC', 'BTC']);
  });
});
