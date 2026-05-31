/**
 * API v1 authentication + rate limiting helper.
 * Called by each v1 route handler (Node.js runtime) — NOT from middleware (Edge).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { validateApiKey } from '@/lib/db';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { createRateLimiter, getClientIP } from '@/lib/auth/rate-limit';
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

/**
 * Salt for hashing client IPs in api_request_log's ip_hash column. Reuses
 * an existing server secret (AUTH_SECRET is always set in prod for v5) so
 * the hash is process-stable — giving accurate distinct-source counts in
 * the admin panel — without introducing a new env var. We NEVER store the
 * raw IP, only sha256(ip + salt) truncated. Admin-only, pseudonymous.
 */
const IP_HASH_SALT =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.CRON_SECRET ||
  'ih-anon-ip-salt-v1';

/**
 * Pseudonymise a client IP for the unauthenticated-traffic log. Returns
 * null for unknown IPs (nothing useful to record). Truncated to 128 bits
 * — ample to distinguish sources, cheaper to store. Exported for tests.
 */
export function hashIpForLog(ip: string | null | undefined): string | null {
  if (!ip || ip === 'unknown') return null;
  return createHash('sha256').update(ip + IP_HASH_SALT).digest('hex').slice(0, 32);
}

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

/** Clear all cached API keys (positive + negative) — call after key revocation to prevent stale auth. */
export function clearApiKeyCache(): void {
  apiKeyCache.clear();
  negativeKeyCache.clear();
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

// ---------------------------------------------------------------------------
// DoS hardening for the pre-validation path (rejected / rotating fake keys)
// ---------------------------------------------------------------------------
// A format-valid `Bearer ih_...` token that isn't in apiKeyCache forces a
// validateApiKey() DB lookup. The middleware deliberately skips /api/v1
// rate-limiting, and the per-key limiter further down only runs AFTER a key
// validates — so without a guard here, rotating fake keys = one DB lookup
// per request, unbounded. Two cheap, PURELY IN-MEMORY guards (zero DB calls,
// per-instance — a cheap abuse guard doesn't need cross-instance state, and
// the deploy is single-instance) bound that load. Note: createRateLimiter is
// DB-backed (SELECT+INSERT per call), so it is deliberately NOT used here.

// 1) Negative cache — a key hash rejected by the DB is remembered briefly so
//    the SAME bad key retried in a loop doesn't re-query. Short TTL is safe:
//    keys never transition invalid→valid (a freshly-created key was never
//    queried-as-invalid, so it can't be falsely cached bad).
const NEG_CACHE_TTL = 60 * 1000;
const NEG_CACHE_MAX = 5000;
const negativeKeyCache = new Map<string, number>(); // key hash -> insertedAt (ms)

/** True if this key hash was rejected within the negative-cache TTL. Exported for tests. */
export function negativeKeyCacheHas(hash: string): boolean {
  const ts = negativeKeyCache.get(hash);
  if (ts === undefined) return false;
  if (Date.now() - ts > NEG_CACHE_TTL) { negativeKeyCache.delete(hash); return false; }
  return true;
}

/** Remember a rejected key hash (bounded; evicts oldest at cap). Exported for tests. */
export function negativeKeyCacheSet(hash: string): void {
  if (negativeKeyCache.size >= NEG_CACHE_MAX) {
    const first = negativeKeyCache.keys().next().value;
    if (first !== undefined) negativeKeyCache.delete(first);
    else negativeKeyCache.clear();
  }
  negativeKeyCache.set(hash, Date.now());
}

// 2) Per-IP throttle on UNCACHED validations. Legit keys cache after the
//    first hit, so a real consumer spends ~1 slot per TTL — only a flood of
//    distinct (uncached) keys from one IP burns through the budget.
export const PREAUTH_MAX_PER_MIN = 120;
const PREAUTH_WINDOW_MS = 60 * 1000;
const PREAUTH_MAX_KEYS = 50_000; // memory bound under a many-IP flood
const preAuthIpHits = new Map<string, { count: number; resetAt: number }>();
let preAuthLastCleanup = 0;

/**
 * True if `ip` may perform another uncached key validation this window,
 * false once it has exceeded PREAUTH_MAX_PER_MIN. Purely in-memory (no DB).
 * Exported for tests.
 */
export function preAuthIpAllowed(ip: string): boolean {
  const now = Date.now();
  if (now - preAuthLastCleanup > 60_000) {
    preAuthLastCleanup = now;
    preAuthIpHits.forEach((v, k) => { if (now > v.resetAt) preAuthIpHits.delete(k); });
  }
  // Hard memory bound: a many-IP flood could grow this faster than cleanup;
  // resetting gives an attacker at most one fresh window (volumetric DDoS is
  // infra's job, not this guard's).
  if (preAuthIpHits.size >= PREAUTH_MAX_KEYS) preAuthIpHits.clear();

  const e = preAuthIpHits.get(ip);
  if (!e || now > e.resetAt) {
    preAuthIpHits.set(ip, { count: 1, resetAt: now + PREAUTH_WINDOW_MS });
    return true;
  }
  if (e.count >= PREAUTH_MAX_PER_MIN) return false;
  e.count++;
  return true;
}

/** Shared 401 body for missing/rejected keys. */
function invalidKeyResponse(): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: 'Invalid or revoked API key' },
      { status: 401, headers: { ...FEE_MODEL_HEADERS } },
    ),
  };
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
    // Deliberately NOT logged: the Edge middleware (handleV1Route) short-
    // circuits keyless /api/v1 requests with an identical 401 BEFORE this
    // Node handler runs, so this branch is only a defense-in-depth fallback
    // and almost never executes. Logging here would be inconsistent +
    // misleading. Capturing true no-key volume needs Edge-side counting.
    return { ok: false, response: noKeyRes };
  }

  const rawKey = match[1];
  // Cache lookup uses the SHA-256 hash, not the raw bearer token.
  const cacheKey = cacheKeyFor(rawKey);

  // Check in-memory cache first
  let keyData = apiKeyCache.get(cacheKey);
  if (!keyData || Date.now() - keyData.cachedAt > API_KEY_CACHE_TTL) {
    // Known-bad key retried in a loop → reject from the negative cache with
    // no DB hit. Still logged (sampled + capped) so the rejected-keys signal
    // stays accurate.
    if (negativeKeyCacheHas(cacheKey)) {
      logRejectedKey(request, 401);
      return invalidKeyResponse();
    }
    // Bound uncached validations per IP — the only rate limit on the
    // pre-validation path (middleware skips /api/v1; the per-key limiter
    // below runs only after a key validates). In-memory, zero DB calls.
    if (!preAuthIpAllowed(getClientIP(request))) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Too many authentication attempts. Slow down and use a valid API key.' },
          { status: 429, headers: { 'Retry-After': '60', ...FEE_MODEL_HEADERS } },
        ),
      };
    }
    try {
      const result = await validateApiKey(rawKey);
      if (!result) {
        negativeKeyCacheSet(cacheKey); // remember so a retry loop skips the DB
        logRejectedKey(request, 401); // format-valid but rejected key → "rejected keys" admin signal
        return invalidKeyResponse();
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
  userId: string | null;
  apiKeyId: string | null;
  endpoint: string;
  statusCode?: number;
  ipHash?: string | null;
}): Promise<void> {
  try {
    const { getSQL, isDBConfigured } = await import('@/lib/db');
    if (!isDBConfigured()) return;
    const db = getSQL();
    await db`
      INSERT INTO api_request_log (user_id, api_key_id, endpoint, status_code, duration_ms, ip_hash)
      VALUES (${row.userId}, ${row.apiKeyId}, ${row.endpoint}, ${row.statusCode ?? 200}, NULL, ${row.ipHash ?? null})
    `;
  } catch (e) {
    // Don't let log failures fail the request — silently swallow.
    console.warn('api_request_log insert failed:', e instanceof Error ? e.message : e);
  }
}

// Process-wide cap on rejected-key log inserts. The invalid-key path is
// NOT rate-limited before it (the per-key limiter runs only AFTER a key
// validates), so a key-guessing flood could otherwise spray inserts. This
// bounds writes to ANON_LOG_MAX_PER_MIN process-wide regardless of request
// rate; the daily prune cron handles retention on top.
const ANON_LOG_MAX_PER_MIN = 120;
let anonLogWindowStart = 0;
let anonLogCount = 0;
function anonLogBudgetOk(): boolean {
  const now = Date.now();
  if (now - anonLogWindowStart > 60_000) { anonLogWindowStart = now; anonLogCount = 0; }
  if (anonLogCount >= ANON_LOG_MAX_PER_MIN) return false;
  anonLogCount++;
  return true;
}

/**
 * Fire-and-forget log of a REJECTED-KEY v1 request: the caller sent a
 * format-valid `Bearer ih_...` token that FAILED validation (a revoked key
 * still in use, or key-guessing). user_id + api_key_id are NULL; the only
 * identifier is a salted IP hash. Surfaces in the admin "Rejected keys"
 * panel as a security / ops signal.
 *
 * This is NOT a general "anonymous traffic" capture: keyless (no-header)
 * requests are short-circuited by the Edge middleware before the Node
 * handler runs, so they never reach here — capturing those needs Edge-side
 * counting. Sampled 1-in-5 AND globally capped (this path isn't rate-limited).
 */
function logRejectedKey(request: NextRequest, statusCode: number): void {
  if (Math.random() >= 0.2) return;
  if (!anonLogBudgetOk()) return;
  try {
    const url = new URL(request.url);
    void logApiRequestSafe({
      userId: null,
      apiKeyId: null,
      endpoint: url.pathname,
      statusCode,
      ipHash: hashIpForLog(getClientIP(request)),
    });
  } catch {
    // never let logging affect the response
  }
}
