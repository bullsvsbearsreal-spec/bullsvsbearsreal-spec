/**
 * Upstash Redis rate limiting for InfoHub Public API (v1).
 * Tier-based sliding window limiters.
 *
 * Env vars: UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

/** Free tier: 100 req / 1 minute */
export const freeTierLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1m'),
  prefix: 'ih:rl:free',
  analytics: true,
});

/** Pro tier: 500 req / 1 minute */
export const proTierLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(500, '1m'),
  prefix: 'ih:rl:pro',
  analytics: true,
});

/** Daily limit (free tier only): 5,000 req / day */
export const dailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5000, '1d'),
  prefix: 'ih:rl:daily',
});

/** Check rate limit for a given API key based on tier */
export async function checkRateLimit(keyId: string, tier: string): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
}> {
  const limiter = tier === 'pro' ? proTierLimiter : freeTierLimiter;
  const { success, remaining, reset, limit } = await limiter.limit(keyId);

  if (!success) {
    return { allowed: false, remaining, reset, limit };
  }

  // Free tier also has a daily cap
  if (tier === 'free') {
    const daily = await dailyLimiter.limit(keyId);
    if (!daily.success) {
      return { allowed: false, remaining: daily.remaining, reset: daily.reset, limit: daily.limit };
    }
  }

  return { allowed: true, remaining, reset, limit };
}
