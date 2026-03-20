import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  clearWatchlist,
} from '../watchlist';

// Mock localStorage AND window (watchlist.ts checks typeof window)
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
// Ensure `typeof window !== 'undefined'` passes in Node
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

beforeEach(() => {
  storage.clear();
});

describe('Watchlist', () => {
  it('starts empty', () => {
    expect(getWatchlist()).toEqual([]);
  });

  it('adds a symbol', () => {
    addToWatchlist('BTC');
    expect(getWatchlist()).toEqual(['BTC']);
  });

  it('uppercases symbols', () => {
    addToWatchlist('eth');
    expect(getWatchlist()).toEqual(['ETH']);
  });

  it('trims whitespace', () => {
    addToWatchlist('  sol  ');
    expect(getWatchlist()).toEqual(['SOL']);
  });

  it('does not add duplicates', () => {
    addToWatchlist('BTC');
    addToWatchlist('BTC');
    addToWatchlist('btc');
    expect(getWatchlist()).toEqual(['BTC']);
  });

  it('does not add empty strings', () => {
    addToWatchlist('');
    addToWatchlist('   ');
    expect(getWatchlist()).toEqual([]);
  });

  it('adds multiple symbols', () => {
    addToWatchlist('BTC');
    addToWatchlist('ETH');
    addToWatchlist('SOL');
    expect(getWatchlist()).toEqual(['BTC', 'ETH', 'SOL']);
  });

  it('removes a symbol', () => {
    addToWatchlist('BTC');
    addToWatchlist('ETH');
    removeFromWatchlist('BTC');
    expect(getWatchlist()).toEqual(['ETH']);
  });

  it('removes case-insensitively', () => {
    addToWatchlist('BTC');
    removeFromWatchlist('btc');
    expect(getWatchlist()).toEqual([]);
  });

  it('isInWatchlist returns correct boolean', () => {
    addToWatchlist('BTC');
    expect(isInWatchlist('BTC')).toBe(true);
    expect(isInWatchlist('btc')).toBe(true);
    expect(isInWatchlist('ETH')).toBe(false);
  });

  it('clearWatchlist removes all', () => {
    addToWatchlist('BTC');
    addToWatchlist('ETH');
    clearWatchlist();
    expect(getWatchlist()).toEqual([]);
  });

  it('handles corrupt localStorage gracefully', () => {
    storage.set('ih_watchlist', 'not-json');
    expect(getWatchlist()).toEqual([]);
  });

  it('handles non-array JSON gracefully', () => {
    storage.set('ih_watchlist', '{"foo": "bar"}');
    expect(getWatchlist()).toEqual([]);
  });

  it('filters non-string entries', () => {
    storage.set('ih_watchlist', '["BTC", 123, null, "ETH"]');
    expect(getWatchlist()).toEqual(['BTC', 'ETH']);
  });
});
