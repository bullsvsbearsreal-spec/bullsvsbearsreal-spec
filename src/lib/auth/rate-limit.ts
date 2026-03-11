/**
 * Simple in-memory rate limiter for auth endpoints.
 * Per-key (IP or email) sliding window with configurable limits.
 *
 * Note: On Vercel serverless, each instance has separate state,
 * so this provides best-effort protection. For stronger guarantees,
 * use Upstash Redis (already used for v1 API rate limiting).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
}

export function createRateLimiter({ maxAttempts, windowMs }: RateLimiterOptions) {
  const entries = new Map<string, RateLimitEntry>();
  let lastCleanup = 0;

  return {
    /** Returns true if allowed, false if rate-limited. */
    check(key: string): boolean {
      const now = Date.now();
      const normalizedKey = key.toLowerCase();

      // Periodic cleanup (at most once per minute)
      if (now - lastCleanup > 60_000) {
        lastCleanup = now;
        entries.forEach((v, k) => {
          if (now > v.resetAt) entries.delete(k);
        });
      }

      const entry = entries.get(normalizedKey);
      if (!entry || now > entry.resetAt) {
        entries.set(normalizedKey, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= maxAttempts) return false;
      entry.count++;
      return true;
    },
  };
}

// Shared limiters for auth endpoints
export const signupLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });
export const forgotPasswordLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });
export const twoFaChallengeLimiter = createRateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 });

/** Basic email format validation. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Extract client IP from request headers. */
export function getClientIP(req: Request): string {
  return (
    (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
