import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub localStorage globally — vitest is node-only, no real DOM
class LocalStorageMock {
  private store: Map<string, string> = new Map();
  get length(): number { return this.store.size; }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, value); }
  removeItem(key: string): void { this.store.delete(key); }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  clear(): void { this.store.clear(); }
}

const STORAGE_PREFIX = 'ih_fr_';

describe('fundingHistory (localStorage path)', () => {
  let origWindow: unknown;
  let origLocalStorage: unknown;

  beforeEach(() => {
    origWindow = (globalThis as Record<string, unknown>).window;
    origLocalStorage = (globalThis as Record<string, unknown>).localStorage;
    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).localStorage = new LocalStorageMock();
    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).window = origWindow;
    (globalThis as Record<string, unknown>).localStorage = origLocalStorage;
    vi.restoreAllMocks();
  });

  describe('saveFundingSnapshot', () => {
    it('writes a snapshot under a 5-min-bucketed key', async () => {
      const { saveFundingSnapshot } = await import('../fundingHistory');
      saveFundingSnapshot([
        { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01 },
      ]);
      // Find the written key
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      const keys: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k) keys.push(k);
      }
      const ihKeys = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
      expect(ihKeys.length).toBe(1);
    });

    it('deduplicates within the same 5-min bucket (only one write)', async () => {
      const { saveFundingSnapshot } = await import('../fundingHistory');
      saveFundingSnapshot([{ symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01 }]);
      saveFundingSnapshot([{ symbol: 'BTC', exchange: 'Binance', fundingRate: 0.02 }]);
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      const keys: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      // Only ONE snapshot (dedupe in the same 5-min slot)
      expect(keys.length).toBe(1);
    });

    it('caps stored symbols at MAX_SYMBOLS = 100 (by exchange count)', async () => {
      const { saveFundingSnapshot, getFundingHistory } = await import('../fundingHistory');
      // Build 150 symbols — top 100 should be stored
      const rates: { symbol: string; exchange: string; fundingRate: number }[] = [];
      // Symbol 'S0' has 5 exchanges, 'S1' has 5, ... S149 has 5
      // All same count → arbitrary top-100 cut
      for (let i = 0; i < 150; i++) {
        rates.push(
          { symbol: `S${i}`, exchange: 'Binance', fundingRate: 0.01 },
          { symbol: `S${i}`, exchange: 'Bybit', fundingRate: 0.01 },
        );
      }
      saveFundingSnapshot(rates);
      // Probe that fewer than all 150 are present
      let foundCount = 0;
      for (let i = 0; i < 150; i++) {
        const pts = getFundingHistory(`S${i}`, 'Binance', 1);
        if (pts.length > 0) foundCount++;
      }
      expect(foundCount).toBeLessThanOrEqual(100);
    });
  });

  describe('getFundingHistory', () => {
    it('returns empty array when no snapshots exist', async () => {
      const { getFundingHistory } = await import('../fundingHistory');
      expect(getFundingHistory('BTC', 'Binance', 30)).toEqual([]);
    });

    it('returns the stored history points sorted ascending by time', async () => {
      const { saveFundingSnapshot, getFundingHistory } = await import('../fundingHistory');
      saveFundingSnapshot([{ symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01 }]);
      const points = getFundingHistory('BTC', 'Binance', 30);
      expect(points.length).toBeGreaterThan(0);
      expect(points[0].rate).toBeCloseTo(0.01, 4);
      expect(typeof points[0].t).toBe('number');
    });

    it('filters out points older than the lookback window', async () => {
      // Write a fake snapshot from 100 days ago
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      const oldTs = Date.now() - 100 * 24 * 60 * 60 * 1000;
      ls.setItem(`${STORAGE_PREFIX}${oldTs}`, JSON.stringify({
        t: oldTs,
        r: { 'OLD|Binance': 0.05 },
      }));
      const { getFundingHistory } = await import('../fundingHistory');
      // 30-day window should exclude
      expect(getFundingHistory('OLD', 'Binance', 30)).toEqual([]);
      // 200-day window should include
      expect(getFundingHistory('OLD', 'Binance', 200).length).toBeGreaterThan(0);
    });

    it('skips corrupt JSON entries gracefully', async () => {
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      ls.setItem(`${STORAGE_PREFIX}${Date.now()}`, 'NOT VALID JSON');
      const { getFundingHistory } = await import('../fundingHistory');
      // Should not throw
      expect(getFundingHistory('BTC', 'Binance', 30)).toEqual([]);
    });
  });

  describe('getSymbolHistory', () => {
    it('averages rates across all exchanges per timestamp', async () => {
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      const ts = Date.now();
      ls.setItem(`${STORAGE_PREFIX}${ts}`, JSON.stringify({
        t: ts,
        r: { 'BTC|Binance': 0.02, 'BTC|Bybit': 0.04 },
      }));
      const { getSymbolHistory } = await import('../fundingHistory');
      const points = getSymbolHistory('BTC', 30);
      expect(points.length).toBe(1);
      expect(points[0].rate).toBeCloseTo(0.03, 6); // average of 0.02 + 0.04
    });

    it('returns empty array when no matching symbol', async () => {
      const { getSymbolHistory } = await import('../fundingHistory');
      expect(getSymbolHistory('NONEXISTENT', 30)).toEqual([]);
    });
  });

  describe('getAccumulatedFunding', () => {
    it('returns 0 when no history exists', async () => {
      const { getAccumulatedFunding } = await import('../fundingHistory');
      expect(getAccumulatedFunding('BTC', 'Binance', 30)).toBe(0);
    });

    it('groups by 8h periods and sums averages', async () => {
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      // Two snapshots locked into the SAME 8h period by anchoring both to a
      // known 8h-bucket boundary (the floor() math depends on the absolute
      // epoch, not "N hours ago" — relative offsets can cross buckets).
      const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
      const periodStart = Math.floor(Date.now() / EIGHT_HOURS_MS) * EIGHT_HOURS_MS;
      const ts1 = periodStart + 1000;  // start of period
      const ts2 = periodStart + 2 * 60 * 60 * 1000;  // +2h within same period
      ls.setItem(`${STORAGE_PREFIX}${ts1}`, JSON.stringify({
        t: ts1, r: { 'BTC|Binance': 0.02 },
      }));
      ls.setItem(`${STORAGE_PREFIX}${ts2}`, JSON.stringify({
        t: ts2, r: { 'BTC|Binance': 0.04 },
      }));
      const { getAccumulatedFunding } = await import('../fundingHistory');
      // Both in same 8h period → average = 0.03, sum across periods = 0.03
      const acc = getAccumulatedFunding('BTC', 'Binance', 7);
      expect(acc).toBeCloseTo(0.03, 4);
    });
  });

  describe('getStorageStats', () => {
    it('reports zero when storage is empty', async () => {
      const { getStorageStats } = await import('../fundingHistory');
      const stats = getStorageStats();
      expect(stats.count).toBe(0);
      expect(stats.oldest).toBeNull();
      expect(stats.newest).toBeNull();
    });

    it('reports count + oldest + newest correctly', async () => {
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      ls.setItem(`${STORAGE_PREFIX}1000000`, JSON.stringify({ t: 1000000, r: {} }));
      ls.setItem(`${STORAGE_PREFIX}2000000`, JSON.stringify({ t: 2000000, r: {} }));
      ls.setItem(`${STORAGE_PREFIX}3000000`, JSON.stringify({ t: 3000000, r: {} }));
      const { getStorageStats } = await import('../fundingHistory');
      const stats = getStorageStats();
      expect(stats.count).toBe(3);
      expect(stats.oldest).toBe(1000000);
      expect(stats.newest).toBe(3000000);
      expect(stats.sizeKB).toBeGreaterThanOrEqual(0);
    });

    it('ignores keys not matching the STORAGE_PREFIX', async () => {
      const ls = (globalThis as Record<string, unknown>).localStorage as LocalStorageMock;
      ls.setItem('other_key', 'whatever');
      ls.setItem(`${STORAGE_PREFIX}1000`, JSON.stringify({ t: 1000, r: {} }));
      const { getStorageStats } = await import('../fundingHistory');
      const stats = getStorageStats();
      expect(stats.count).toBe(1);
    });
  });

  describe('SSR safety', () => {
    it('saveFundingSnapshot no-ops when window is undefined', async () => {
      delete (globalThis as Record<string, unknown>).window;
      const { saveFundingSnapshot } = await import('../fundingHistory');
      // Should not throw
      expect(() => saveFundingSnapshot([{ symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01 }])).not.toThrow();
    });

    it('getFundingHistory returns [] when window is undefined', async () => {
      delete (globalThis as Record<string, unknown>).window;
      const { getFundingHistory } = await import('../fundingHistory');
      expect(getFundingHistory('BTC', 'Binance', 30)).toEqual([]);
    });

    it('getAccumulatedFunding returns 0 when window is undefined', async () => {
      delete (globalThis as Record<string, unknown>).window;
      const { getAccumulatedFunding } = await import('../fundingHistory');
      expect(getAccumulatedFunding('BTC', 'Binance', 30)).toBe(0);
    });

    it('getStorageStats returns zeros when window is undefined', async () => {
      delete (globalThis as Record<string, unknown>).window;
      const { getStorageStats } = await import('../fundingHistory');
      const stats = getStorageStats();
      expect(stats.count).toBe(0);
      expect(stats.sizeKB).toBe(0);
    });
  });
});
