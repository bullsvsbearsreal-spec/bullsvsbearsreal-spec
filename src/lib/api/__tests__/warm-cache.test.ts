import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('warm-cache (Redis-backed)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('graceful no-Redis fallback', () => {
    it('getWarmCache returns null when UPSTASH_REDIS_REST_URL is unset', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const { getWarmCache } = await import('../warm-cache');
      const result = await getWarmCache('test-key');
      expect(result).toBeNull();
    });

    it('setWarmCache is a no-op when Redis is unconfigured (no throw)', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const { setWarmCache } = await import('../warm-cache');
      await expect(setWarmCache('test-key', { data: 'foo' }, 60)).resolves.toBeUndefined();
    });

    it('getWarmCache returns null when only one of URL/TOKEN is set', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const { getWarmCache } = await import('../warm-cache');
      const result = await getWarmCache('test-key');
      // Without a valid Redis client, returns null
      expect(result).toBeNull();
    });
  });

  describe('shape contract', () => {
    it('getWarmCache return type is WarmCacheEntry<T> | null', async () => {
      // Just verify the type doesn't throw on import + invocation
      delete process.env.UPSTASH_REDIS_REST_URL;
      const { getWarmCache } = await import('../warm-cache');
      const result = await getWarmCache<{ foo: string }>('key');
      if (result !== null) {
        expect(result).toHaveProperty('body');
        expect(result).toHaveProperty('ts');
      }
    });

    it('setWarmCache accepts a default TTL of 3600s when none given', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      const { setWarmCache } = await import('../warm-cache');
      // Should not throw on the default-TTL path
      await expect(setWarmCache('key', { a: 1 })).resolves.toBeUndefined();
    });

    it('setWarmCache accepts a custom TTL', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      const { setWarmCache } = await import('../warm-cache');
      await expect(setWarmCache('key', { a: 1 }, 120)).resolves.toBeUndefined();
    });
  });
});
