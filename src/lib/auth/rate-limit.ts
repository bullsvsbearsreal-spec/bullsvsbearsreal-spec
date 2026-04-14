/**
 * Hybrid rate limiter for auth endpoints.
 * Uses in-memory as fast first check + DB for persistence across instances.
 *
 * On Vercel serverless, in-memory state is lost between cold starts and
 * not shared across instances. The DB layer ensures limits are enforced
 * consistently, while the in-memory layer avoids DB round-trips for
 * repeated abuse from the same instance.
 */

import { isDBConfigured, getSQL } from '@/lib/db';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
  /** Identifier for this limiter in the DB (e.g. 'signup', '2fa') */
  name: string;
}

export function createRateLimiter({ maxAttempts, windowMs, name }: RateLimiterOptions) {
  const entries = new Map<string, RateLimitEntry>();
  let lastCleanup = 0;

  return {
    /** Returns true if allowed, false if rate-limited. */
    async check(key: string): Promise<boolean> {
      const now = Date.now();
      const normalizedKey = key.toLowerCase();

      // Periodic cleanup of in-memory entries (at most once per minute)
      if (now - lastCleanup > 60_000) {
        lastCleanup = now;
        entries.forEach((v, k) => {
          if (now > v.resetAt) entries.delete(k);
        });
      }

      // Fast in-memory check first
      const memEntry = entries.get(normalizedKey);
      if (memEntry && now <= memEntry.resetAt && memEntry.count >= maxAttempts) {
        return false;
      }

      // DB-backed check for cross-instance consistency
      if (isDBConfigured()) {
        try {
          const sql = getSQL();
          const windowSec = Math.ceil(windowMs / 1000);
          const rows = await sql`
            SELECT count(*)::int AS cnt FROM rate_limit_events
            WHERE limiter = ${name}
              AND key = ${normalizedKey}
              AND created_at > NOW() - ${windowSec + ' seconds'}::interval
          `;
          const dbCount = rows[0]?.cnt ?? 0;

          if (dbCount >= maxAttempts) {
            // Sync to memory so we don't hit DB again
            entries.set(normalizedKey, { count: maxAttempts, resetAt: now + windowMs });
            return false;
          }

          // Record this attempt
          await sql`
            INSERT INTO rate_limit_events (limiter, key)
            VALUES (${name}, ${normalizedKey})
          `;
        } catch {
          // DB error — fall through to in-memory only
        }
      }

      // Update in-memory
      if (!memEntry || now > memEntry.resetAt) {
        entries.set(normalizedKey, { count: 1, resetAt: now + windowMs });
      } else {
        memEntry.count++;
        if (memEntry.count >= maxAttempts) return false;
      }

      return true;
    },
  };
}

// Shared limiters for auth endpoints
export const signupLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000, name: 'signup' });
export const forgotPasswordLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000, name: 'forgot-pw' });
export const twoFaChallengeLimiter = createRateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000, name: '2fa' });

/** Basic email format validation. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Extract client IP from request headers. */
export function getClientIP(req: Request): string {
  return (
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ||
    'unknown'
  );
}
