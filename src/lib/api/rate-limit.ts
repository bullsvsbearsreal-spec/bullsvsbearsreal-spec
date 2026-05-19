/**
 * Upstash Redis rate limiting for InfoHub Public API (v1).
 * Tier-based sliding window limiters.
 *
 * Env vars: UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

/**
 * Per-tier API rate limits. Exported as constants so:
 *  1. Marketing copy on /developers, /faq, README can reference the
 *     same numbers (no more "100 req/min" drift between docs and code).
 *  2. The OpenAPI spec + rate-limit headers carry the same values
 *     the limiter actually enforces.
 *  3. The cross-surface consistency test can grep these literals
 *     against the user-facing copy.
 *
 * Bump cautiously. The Upstash free tier covers ~1k req/s aggregate
 * across all prefixes; the current ceiling (500 Pro × N partners)
 * gives plenty of headroom but isn't infinite.
 */
export const FREE_TIER_PER_MINUTE = 100;
export const PRO_TIER_PER_MINUTE = 500;
export const FREE_TIER_PER_DAY = 5000;

/** Free tier: 100 req / 1 minute */
export const freeTierLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(FREE_TIER_PER_MINUTE, '1m'),
  prefix: 'ih:rl:free',
  analytics: true,
});

/** Pro tier: 500 req / 1 minute */
export const proTierLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(PRO_TIER_PER_MINUTE, '1m'),
  prefix: 'ih:rl:pro',
  analytics: true,
});

/** Daily limit (free tier only): 5,000 req / day */
export const dailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(FREE_TIER_PER_DAY, '1d'),
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
