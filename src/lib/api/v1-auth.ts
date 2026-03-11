/**
 * API v1 authentication + rate limiting helper.
 * Called by each v1 route handler (Node.js runtime) — NOT from middleware (Edge).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/db';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { createRateLimiter } from '@/lib/auth/rate-limit';

// Fallback in-memory rate limiter when Redis is unavailable
const fallbackLimiter = createRateLimiter({ maxAttempts: 60, windowMs: 60 * 1000 });

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
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'API key required. Pass Authorization: Bearer ih_xxx' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="InfoHub API"' } },
      ),
    };
  }

  const rawKey = match[1];

  // Check in-memory cache first
  let keyData = apiKeyCache.get(rawKey);
  if (!keyData || Date.now() - keyData.cachedAt > API_KEY_CACHE_TTL) {
    try {
      const result = await validateApiKey(rawKey);
      if (!result) {
        return {
          ok: false,
          response: NextResponse.json(
            { success: false, error: 'Invalid or revoked API key' },
            { status: 401 },
          ),
        };
      }
      keyData = { ...result, cachedAt: Date.now() };
      // Enforce max cache size — evict oldest entry if at cap
      if (apiKeyCache.size >= API_KEY_CACHE_MAX) {
        const firstKey = apiKeyCache.keys().next().value;
        if (firstKey) apiKeyCache.delete(firstKey);
      }
      apiKeyCache.set(rawKey, keyData);
    } catch (e) {
      console.error('API key validation error:', e);
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Authentication service unavailable' },
          { status: 503 },
        ),
      };
    }
  }

  // Rate limit via Upstash Redis
  const rateLimitHeaders: Record<string, string> = {};
  try {
    const { allowed, remaining, reset, limit } = await checkRateLimit(keyData.keyId, keyData.tier);
    rateLimitHeaders['X-RateLimit-Limit'] = String(limit);
    rateLimitHeaders['X-RateLimit-Remaining'] = String(remaining);
    rateLimitHeaders['X-RateLimit-Reset'] = String(Math.ceil(reset / 1000));

    if (!allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Upgrade to Pro for higher limits.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
              ...rateLimitHeaders,
              'X-RateLimit-Remaining': '0',
            },
          },
        ),
      };
    }
  } catch (e) {
    // Fallback to in-memory rate limiter when Redis is down
    console.error('Redis rate limit failed, using in-memory fallback:', e);
    if (!fallbackLimiter.check(keyData.keyId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Rate limit exceeded (service degraded). Try again shortly.' },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      };
    }
  }

  return {
    ok: true,
    user: { userId: keyData.userId, tier: keyData.tier, keyId: keyData.keyId },
    headers: rateLimitHeaders,
  };
}
