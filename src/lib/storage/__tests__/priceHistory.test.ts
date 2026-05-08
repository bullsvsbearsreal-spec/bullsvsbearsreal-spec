import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  savePriceSnapshot,
  getPriceHistory,
  getAvailableSymbols,
  getPriceHistoryStats,
} from '../priceHistory';

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

beforeEach(() => {
  storage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('savePriceSnapshot', () => {
  it('saves a single snapshot', () => {
    savePriceSnapshot({ BTC: 100000, ETH: 3500 });
    expect(getPriceHistoryStats().count).toBe(1);
    expect(getAvailableSymbols()).toEqual(['BTC', 'ETH']);
  });

  it('skips a snapshot in the same 5-min slot (dedup)', () => {
    savePriceSnapshot({ BTC: 100000 });
    vi.setSystemTime(new Date('2026-05-08T12:00:30Z')); // +30s, same 5-min bucket
    savePriceSnapshot({ BTC: 100100 });
    expect(getPriceHistoryStats().count).toBe(1);
  });

  it('saves a new snapshot in the next 5-min slot', () => {
    savePriceSnapshot({ BTC: 100000 });
    vi.setSystemTime(new Date('2026-05-08T12:05:01Z')); // +5min1s, next bucket
    savePriceSnapshot({ BTC: 100100 });
    expect(getPriceHistoryStats().count).toBe(2);
  });

  it('ignores empty / invalid input', () => {
    savePriceSnapshot({});
    savePriceSnapshot(null as any);
    expect(getPriceHistoryStats().count).toBe(0);
  });

  it('prunes entries older than 7 days', () => {
    // Manually seed an ancient snapshot.
    const ancient = Date.now() - 8 * 24 * 60 * 60 * 1000;
    storage.set('ih_price_history', JSON.stringify([
      { timestamp: ancient, prices: { BTC: 50000 } },
    ]));
    // New save should prune the ancient one + add new.
    savePriceSnapshot({ BTC: 100000 });
    const stats = getPriceHistoryStats();
    expect(stats.count).toBe(1);
    expect(stats.oldest).toBeGreaterThan(ancient);
  });
});

describe('getPriceHistory', () => {
  it('returns aligned prices only when ALL symbols have data', () => {
    // T0: BTC + ETH
    savePriceSnapshot({ BTC: 100000, ETH: 3500 });
    vi.setSystemTime(new Date('2026-05-08T12:05:01Z'));
    // T+5min: only BTC (ETH missing → this row should be dropped from
    // alignment when we ask for BTC + ETH together).
    savePriceSnapshot({ BTC: 100100 });
    vi.setSystemTime(new Date('2026-05-08T12:10:01Z'));
    // T+10min: BTC + ETH again
    savePriceSnapshot({ BTC: 100200, ETH: 3550 });

    const r = getPriceHistory(['BTC', 'ETH'], 1);
    expect(r).toHaveLength(2);
    const btcRow = r.find(s => s.symbol === 'BTC')!;
    const ethRow = r.find(s => s.symbol === 'ETH')!;
    expect(btcRow.prices).toEqual([100000, 100200]); // T+5min row dropped
    expect(ethRow.prices).toEqual([3500, 3550]);
  });

  it('returns empty when no snapshots cover the window', () => {
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
    savePriceSnapshot({ BTC: 100000 });
    // Jump 24h forward; ask for last 1h → no data in window.
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));
    expect(getPriceHistory(['BTC'], 1)).toEqual([]);
  });

  it('returns empty for empty symbols list', () => {
    savePriceSnapshot({ BTC: 100000 });
    expect(getPriceHistory([], 24)).toEqual([]);
  });

  it('treats zero-price as missing data (filtered out)', () => {
    savePriceSnapshot({ BTC: 100000, ETH: 0 });
    expect(getPriceHistory(['BTC', 'ETH'], 1)).toEqual([]);
  });
});

describe('getAvailableSymbols', () => {
  it('returns the union of symbols across snapshots, sorted', () => {
    savePriceSnapshot({ BTC: 1, ETH: 1 });
    vi.setSystemTime(new Date('2026-05-08T12:05:01Z'));
    savePriceSnapshot({ SOL: 1, BTC: 1 });
    expect(getAvailableSymbols()).toEqual(['BTC', 'ETH', 'SOL']);
  });

  it('returns empty when no data', () => {
    expect(getAvailableSymbols()).toEqual([]);
  });
});

describe('getPriceHistoryStats', () => {
  it('reports count + oldest/newest + symbolCount', () => {
    savePriceSnapshot({ BTC: 1 });
    vi.setSystemTime(new Date('2026-05-08T12:05:01Z'));
    savePriceSnapshot({ ETH: 1 });
    const s = getPriceHistoryStats();
    expect(s.count).toBe(2);
    expect(s.symbolCount).toBe(2);
    expect(s.oldest).toBeLessThan(s.newest!);
    expect(s.sizeKB).toBeGreaterThanOrEqual(0);
  });

  it('returns zero stats on empty store', () => {
    const s = getPriceHistoryStats();
    expect(s.count).toBe(0);
    expect(s.oldest).toBe(null);
    expect(s.newest).toBe(null);
  });
});
