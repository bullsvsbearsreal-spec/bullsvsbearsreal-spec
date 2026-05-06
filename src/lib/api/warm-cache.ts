/**
 * Redis-backed warm cache for slow upstream JSON sources.
 *
 * Pattern: a cron job calls `setWarmCache(key, body)` every N minutes,
 * a public API route calls `getWarmCache(key)` first and only falls
 * through to the live upstream fetch when Redis is empty / stale.
 * Solves the "cold-start 504" problem on routes whose upstream is
 * slow (DefiLlama yields, Farside ETF flows, etc.) without making
 * users wait through the live fetch on first request.
 *
 * Falls back gracefully when UPSTASH_REDIS_REST_URL isn't set —
 * `get` returns null, `set` is a no-op. So local dev keeps working
 * without Redis.
 */
import { Redis } from '@upstash/redis';

const URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!URL || !TOKEN) return null;
  if (redis) return redis;
  try {
    redis = Redis.fromEnv();
    return redis;
  } catch {
    return null;
  }
}

export interface WarmCacheEntry<T> {
  body: T;
  /** Server time (unix ms) when this entry was written by the cron. */
  ts: number;
}

const PREFIX = 'warm:';

/** Read a cached entry. Returns null when missing / Redis offline. */
export async function getWarmCache<T>(key: string): Promise<WarmCacheEntry<T> | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get<WarmCacheEntry<T>>(`${PREFIX}${key}`);
    return raw ?? null;
  } catch {
    return null;
  }
}

/**
 * Write a cached entry. `ttlSeconds` is a safety-net upper bound; the
 * cron is expected to refresh well within it. Default 1 hour.
 */
export async function setWarmCache<T>(
  key: string,
  body: T,
  ttlSeconds: number = 3600,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const entry: WarmCacheEntry<T> = { body, ts: Date.now() };
  try {
    await r.set(`${PREFIX}${key}`, entry, { ex: ttlSeconds });
  } catch {
    /* swallow — slow cache failure shouldn't bring down the cron */
  }
}
