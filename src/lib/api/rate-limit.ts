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
 * 4-tier ladder (May 2026): Free → Trader $12 → Pro $29 → Whale $59.
 * Pro bumped 500→600/min so the new $29 middle tier feels meaningfully
 * bigger than Trader $12 at 200/min. Whale stays unlimited.
 *
 * Bump cautiously. The Upstash free tier covers ~1k req/s aggregate
 * across all prefixes; the current ceiling (600 Pro × N partners)
 * gives plenty of headroom but isn't infinite.
 */
export const FREE_TIER_PER_MINUTE = 100;
export const TRADER_TIER_PER_MINUTE = 200;
export const PRO_TIER_PER_MINUTE = 600;
export const FREE_TIER_PER_DAY = 5_000;
export const TRADER_TIER_PER_DAY = 25_000;

/**
 * Per-user cap on number of active API keys. Exported so the
 * /developers UI ("Your Keys (N/5)" counter) and the server-side
 * enforcement at /api/v1/keys POST both read the same source — was
 * hardcoded as `/5` in the UI and `MAX_KEYS_PER_USER = 5` in the
 * route, drift would silently let a user create a 6th key while
 * the UI still capped at 5.
 *
 * Bump cautiously — every key gets its own Upstash rate-limit
 * bucket and an api_keys row.
 */
export const MAX_API_KEYS_PER_USER = 5;

/** Free tier: 100 req / 1 minute */
export const freeTierLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(FREE_TIER_PER_MINUTE, '1m'),
  prefix: 'ih:rl:free',
  analytics: true,
});

/** Trader tier: 200 req / 1 minute */
export const traderTierLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(TRADER_TIER_PER_MINUTE, '1m'),
  prefix: 'ih:rl:trader',
  analytics: true,
});

/** Pro tier: 600 req / 1 minute */
export const proTierLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(PRO_TIER_PER_MINUTE, '1m'),
  prefix: 'ih:rl:pro',
  analytics: true,
});

/** Free tier daily cap: 5,000 req / day */
export const freeDailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(FREE_TIER_PER_DAY, '1d'),
  prefix: 'ih:rl:daily:free',
});

/** Trader tier daily cap: 25,000 req / day */
export const traderDailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(TRADER_TIER_PER_DAY, '1d'),
  prefix: 'ih:rl:daily:trader',
});

/** Check rate limit for a given API key based on tier */
export async function checkRateLimit(keyId: string, tier: string): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
}> {
  // Whale tier: unlimited per /pricing. Bypass the limiter entirely so
  // institutional customers aren't artificially throttled. Sentinel
  // limit value of Number.MAX_SAFE_INTEGER signals "unlimited" to the
  // header writer in v1-auth.ts (it'll render as a giant number — the
  // client should look at X-RateLimit-Remaining instead).
  if (tier === 'whale') {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      reset: Date.now() + 60_000,
      limit: Number.MAX_SAFE_INTEGER,
    };
  }

  // Per-minute limiter selection
  const limiter =
    tier === 'pro' ? proTierLimiter :
    tier === 'trader' ? traderTierLimiter :
    freeTierLimiter;
  const { success, remaining, reset, limit } = await limiter.limit(keyId);

  if (!success) {
    return { allowed: false, remaining, reset, limit };
  }

  // Daily cap applies to Free + Trader. Pro + Whale are "unlimited
  // daily" per /pricing so they skip the daily limiter entirely.
  if (tier === 'free' || tier === 'trader') {
    const dailyLimiter = tier === 'trader' ? traderDailyLimiter : freeDailyLimiter;
    const daily = await dailyLimiter.limit(keyId);
    if (!daily.success) {
      return { allowed: false, remaining: daily.remaining, reset: daily.reset, limit: daily.limit };
    }
  }

  return { allowed: true, remaining, reset, limit };
}
