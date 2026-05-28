/**
 * API v1 authentication + rate limiting helper.
 * Called by each v1 route handler (Node.js runtime) — NOT from middleware (Edge).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { validateApiKey } from '@/lib/db';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { createRateLimiter } from '@/lib/auth/rate-limit';
import { FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT } from '@/lib/constants/exchanges';

/**
 * Hash the raw bearer token before using it as a Map key. Without this,
 * a memory dump (Node.js --inspect, OOM crash dump) would expose live
 * bearer tokens in plaintext. The DB layer already SHA-256s before
 * storage; this matches that pattern in-process.
 */
function cacheKeyFor(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

// Fallback in-memory rate limiter when Redis is unavailable
const fallbackLimiter = createRateLimiter({ maxAttempts: 60, windowMs: 60 * 1000, name: 'v1-api' });

/**
 * Fee-model identifier headers surfaced on ALL v1 error responses so
 * partners doing cheap HEAD-based version polling can detect schedule
 * bumps even when their key is rejected (no-key, invalid-key, DB-down,
 * rate-limited). Without this on every path, a partner whose key gets
 * revoked silently misses the next fee-schedule bump until they renew.
 */
const FEE_MODEL_HEADERS = {
  'X-Fee-Model-Version': FEE_MODEL_VERSION,
  'X-Fee-Model-Updated-At': FEE_MODEL_UPDATED_AT,
};

interface V1AuthResult {
  userId: string;
  tier: string;
  keyId: string;
}

// In-memory cache for validated API keys (avoids DB hit per request)
const apiKeyCache = new Map<string, V1AuthResult & { cachedAt: number }>();
const API_KEY_CACHE_TTL = 60 * 1000; // 1 min (shorter to limit revocation window)
const API_KEY_CACHE_MAX = 1000; // cap to prevent unbounded growth
let lastCacheCleanup = 0;

/** Clear all cached API keys — call after key revocation to prevent stale auth. */
export function clearApiKeyCache(): void {
  apiKeyCache.clear();
}

/** Evict expired entries periodically (at most once per minute). */
function evictStaleKeys(): void {
  const now = Date.now();
  if (now - lastCacheCleanup < 60_000) return;
  lastCacheCleanup = now;
  apiKeyCache.forEach((v, k) => {
    if (now - v.cachedAt > API_KEY_CACHE_TTL) apiKeyCache.delete(k);
  });
}

/**
 * Authenticate a v1 API request.
 * Returns user context + rate limit headers on success, or an error NextResponse on failure.
 */
export async function authenticateV1Request(request: NextRequest): Promise<
  | { ok: true; user: V1AuthResult; headers: Record<string, string> }
  | { ok: false; response: NextResponse }
> {
  // Periodic cleanup of expired cache entries
  evictStaleKeys();

  // Extract API key from Authorization header
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(ih_.+)$/i);
  if (!match) {
    // Build via explicit headers.set so DO's edge layer doesn't drop
    // custom X-Fee-Model-* headers — previous spread-into-init approach
    // delivered WWW-Authenticate but silently dropped the X-Fee-Model
    // pair on this 401 path (verified live May 2026). The invalid-key
    // 401 below worked because it had no WWW-Authenticate; turns out
    // mixing WWW-Authenticate with custom X-* in the init.headers object
    // triggers some header normalisation that strips the X-* entries.
    const noKeyRes = NextResponse.json(
      { success: false, error: 'API key required. Pass Authorization: Bearer ih_xxx' },
      { status: 401 },
    );
    noKeyRes.headers.set('WWW-Authenticate', 'Bearer realm="InfoHub API"');
    noKeyRes.headers.set('X-Fee-Model-Version', FEE_MODEL_VERSION);
    noKeyRes.headers.set('X-Fee-Model-Updated-At', FEE_MODEL_UPDATED_AT);
    return { ok: false, response: noKeyRes };
  }

  const rawKey = match[1];
  // Cache lookup uses the SHA-256 hash, not the raw bearer token.
  const cacheKey = cacheKeyFor(rawKey);

  // Check in-memory cache first
  let keyData = apiKeyCache.get(cacheKey);
  if (!keyData || Date.now() - keyData.cachedAt > API_KEY_CACHE_TTL) {
    try {
      const result = await validateApiKey(rawKey);
      if (!result) {
        return {
          ok: false,
          response: NextResponse.json(
            { success: false, error: 'Invalid or revoked API key' },
            { status: 401, headers: { ...FEE_MODEL_HEADERS } },
          ),
        };
      }
      keyData = { ...result, cachedAt: Date.now() };
      // Enforce max cache size — evict oldest entry if at cap
      if (apiKeyCache.size >= API_KEY_CACHE_MAX) {
        const firstKey = apiKeyCache.keys().next().value;
        if (firstKey !== undefined) apiKeyCache.delete(firstKey);
        else apiKeyCache.clear(); // fallback: clear all if iterator fails
      }
      apiKeyCache.set(cacheKey, keyData);
    } catch (e) {
      console.error('API key validation error:', e);
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Authentication service unavailable' },
          { status: 503, headers: { ...FEE_MODEL_HEADERS } },
        ),
      };
    }
  }

  // Rate limit via Upstash Redis.
  //
  // CUSTOMER BUG (AB-Samurai, 5/27/2026): valid keys hang indefinitely
  // while invalid keys return 401 instantly. Root cause: `limiter.limit()`
  // is a fetch to the Upstash REST API with no client-side timeout. If
  // Upstash's edge holds the TCP socket open (even when degraded), the
  // await never resolves and the route hangs until the client gives up.
  // The catch block below ONLY fires on a thrown error, not a hung
  // promise — so the in-memory fallback never engaged.
  //
  // Fix: race the Redis call with a 2-second timeout. On timeout we
  // throw into the catch block, which engages the in-memory fallback
  // (60/min) so the customer's request still gets through. 2s is
  // generous — healthy Upstash p99 is ~50ms — but covers a degraded
  // edge node without making real users wait noticeably long.
  const REDIS_TIMEOUT_MS = 2000;
  const rateLimitHeaders: Record<string, string> = {};
  try {
    const { allowed, remaining, reset, limit } = await Promise.race([
      checkRateLimit(keyData.keyId, keyData.tier),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upstash rate-limit check timed out')), REDIS_TIMEOUT_MS),
      ),
    ]);
    rateLimitHeaders['X-RateLimit-Limit'] = String(limit);
    rateLimitHeaders['X-RateLimit-Remaining'] = String(remaining);
    rateLimitHeaders['X-RateLimit-Reset'] = String(Math.ceil(reset / 1000));

    if (!allowed) {
      // Tier-aware error so the user knows whether an upgrade would help
      // (Free hit the cap) vs whether they've genuinely overshot a
      // higher tier (Pro/Whale hit aren't normal — likely runaway client).
      const upsell = keyData.tier === 'free'
        ? 'Trader tier offers 200/min, Pro 600/min with no daily cap (free during launch — see /pricing).'
        : keyData.tier === 'trader'
        ? 'Pro tier offers 600/min with no daily cap (free during launch — see /pricing).'
        : 'Slow down or contact support if this is unexpected.';
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: `Rate limit exceeded. ${upsell}` },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
              ...rateLimitHeaders,
              'X-RateLimit-Remaining': '0',
              ...FEE_MODEL_HEADERS,
            },
          },
        ),
      };
    }
  } catch (e) {
    // Fallback to in-memory rate limiter when Redis is down
    console.error('Redis rate limit failed, using in-memory fallback:', e);
    if (!(await fallbackLimiter.check(keyData.keyId))) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Rate limit exceeded (service degraded). Try again shortly.' },
          { status: 429, headers: { 'Retry-After': '60', ...FEE_MODEL_HEADERS } },
        ),
      };
    }
  }

  // Fire-and-forget log into api_request_log for the developer dashboard.
  //
  // SUCCESS-ONLY by design: we log at the point of successful auth, so
  // the row reflects "request was authenticated + permitted" not the
  // ultimate HTTP status. Route handlers can fail downstream — those
  // 4xx/5xx responses are intentionally NOT captured here (would require
  // wrapping every v1 route handler). The admin API Log tab surfaces
  // request volume, top endpoints, and top consumers, which are the
  // primary use cases and are correct under success-only semantics.
  //
  // We log status_code = 200 and duration_ms = NULL — both are honest
  // placeholders. If we add per-route success logging later, that path
  // can write the real status + duration.
  //
  // Sampled to 1 in 5 requests to keep the table size manageable at peak.
  // Heavy hitters at 100 req/s still produce 20 rows/sec which is fine.
  if (Math.random() < 0.2) {
    const url = new URL(request.url);
    void logApiRequestSafe({
      userId: keyData.userId,
      apiKeyId: keyData.keyId,
      endpoint: url.pathname,
    });
  }

  return {
    ok: true,
    user: { userId: keyData.userId, tier: keyData.tier, keyId: keyData.keyId },
    headers: rateLimitHeaders,
  };
}

/**
 * Fire-and-forget insert into api_request_log. Lazy-imports lib/db so
 * we don't pay the postgres.js connection cost on requests that never
 * touch the DB. See semantics in the call site above — success-only.
 */
async function logApiRequestSafe(row: {
  userId: string;
  apiKeyId: string;
  endpoint: string;
}): Promise<void> {
  try {
    const { getSQL, isDBConfigured } = await import('@/lib/db');
    if (!isDBConfigured()) return;
    const db = getSQL();
    await db`
      INSERT INTO api_request_log (user_id, api_key_id, endpoint, status_code, duration_ms)
      VALUES (${row.userId}, ${row.apiKeyId}, ${row.endpoint}, 200, NULL)
    `;
  } catch (e) {
    // Don't let log failures fail the request — silently swallow.
    console.warn('api_request_log insert failed:', e instanceof Error ? e.message : e);
  }
}
