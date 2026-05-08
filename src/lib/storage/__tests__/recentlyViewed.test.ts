import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRecentlyViewed,
  addRecentlyViewed,
  clearRecentlyViewed,
  type RecentItem,
} from '../recentlyViewed';

// Mock localStorage AND window — recentlyViewed.ts checks typeof window before
// reading. Same pattern used by watchlist.test.ts.
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
  vi.useRealTimers();
});

describe('getRecentlyViewed', () => {
  it('returns empty array when storage is empty', () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('returns parsed array when storage has data', () => {
    const items: RecentItem[] = [
      { path: '/funding/BTC', label: 'BTC Funding', ts: 100 },
    ];
    storage.set('infohub-recently-viewed', JSON.stringify(items));
    expect(getRecentlyViewed()).toEqual(items);
  });

  it('returns empty array on corrupt JSON', () => {
    storage.set('infohub-recently-viewed', '{not-json');
    expect(getRecentlyViewed()).toEqual([]);
  });
});

describe('addRecentlyViewed', () => {
  it('adds to the front (most-recent-first)', () => {
    addRecentlyViewed('/a', 'A');
    addRecentlyViewed('/b', 'B');
    addRecentlyViewed('/c', 'C');
    const list = getRecentlyViewed();
    expect(list.map(i => i.path)).toEqual(['/c', '/b', '/a']);
  });

  it('moves an existing path to the front (no duplicates)', () => {
    addRecentlyViewed('/a', 'A');
    addRecentlyViewed('/b', 'B');
    addRecentlyViewed('/c', 'C');
    addRecentlyViewed('/a', 'A'); // re-visit /a
    const list = getRecentlyViewed();
    expect(list.map(i => i.path)).toEqual(['/a', '/c', '/b']);
  });

  it('updates timestamp when re-visiting an existing path', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    addRecentlyViewed('/a', 'A');
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    addRecentlyViewed('/a', 'A');
    const list = getRecentlyViewed();
    expect(list).toHaveLength(1);
    expect(list[0].ts).toBe(new Date('2026-02-01T00:00:00Z').getTime());
  });

  it('caps at 12 items (MAX_ITEMS — drops the oldest)', () => {
    for (let i = 0; i < 15; i++) {
      addRecentlyViewed(`/p${i}`, `Page ${i}`);
    }
    const list = getRecentlyViewed();
    expect(list).toHaveLength(12);
    // Most recent first → /p14
    expect(list[0].path).toBe('/p14');
    // /p0, /p1, /p2 should have been dropped
    expect(list.find(i => i.path === '/p0')).toBeUndefined();
    expect(list.find(i => i.path === '/p2')).toBeUndefined();
    // /p3 should still be there (it's the 12th from the top)
    expect(list[list.length - 1].path).toBe('/p3');
  });

  it('preserves the optional symbol field', () => {
    addRecentlyViewed('/funding/BTC', 'BTC Funding', 'BTC');
    expect(getRecentlyViewed()[0].symbol).toBe('BTC');
  });

  it('records a timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
    addRecentlyViewed('/a', 'A');
    expect(getRecentlyViewed()[0].ts).toBe(new Date('2026-05-08T12:00:00Z').getTime());
  });
});

describe('clearRecentlyViewed', () => {
  it('removes all stored items', () => {
    addRecentlyViewed('/a', 'A');
    addRecentlyViewed('/b', 'B');
    clearRecentlyViewed();
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('no-op when storage is already empty', () => {
    clearRecentlyViewed();
    expect(getRecentlyViewed()).toEqual([]);
  });
});
