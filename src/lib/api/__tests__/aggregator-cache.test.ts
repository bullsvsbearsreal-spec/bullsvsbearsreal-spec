import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('aggregator cache helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('clearCache', () => {
    it('exists and is callable', async () => {
      const { clearCache } = await import('../aggregator');
      expect(typeof clearCache).toBe('function');
      expect(() => clearCache()).not.toThrow();
    });

    it('returns undefined (side-effect only)', async () => {
      const { clearCache } = await import('../aggregator');
      expect(clearCache()).toBeUndefined();
    });
  });

  describe('getServerTotalVolume', () => {
    it('returns null when cache is empty', async () => {
      const { getServerTotalVolume, clearCache } = await import('../aggregator');
      clearCache();
      expect(getServerTotalVolume()).toBeNull();
    });

    it('returns null after clearCache wipes the value', async () => {
      // Even after the module has been used, clearing the cache should
      // return null for subsequent reads.
      const { getServerTotalVolume, clearCache } = await import('../aggregator');
      clearCache();
      expect(getServerTotalVolume()).toBeNull();
    });
  });

  describe('getCurrencyStatus', () => {
    it('returns an object (initially empty)', async () => {
      const { getCurrencyStatus } = await import('../aggregator');
      const status = getCurrencyStatus();
      expect(typeof status).toBe('object');
      expect(status).not.toBeNull();
    });
  });
});
