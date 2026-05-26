import { NextRequest, NextResponse } from 'next/server';
import { FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT } from '@/lib/constants/exchanges';

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter — no external deps needed at this scale
// ---------------------------------------------------------------------------

interface RateWindow {
  count: number;
  start: number;
}

const authBuckets = new Map<string, RateWindow>();   // strict: 5 req / 15 min
const apiBuckets  = new Map<string, RateWindow>();   // moderate: 120 req / 1 min

const AUTH_LIMIT   = 5;
const AUTH_WINDOW   = 15 * 60 * 1000; // 15 min
const API_LIMIT    = 120;
const API_WINDOW    = 60 * 1000;       // 1 min

// Cleanup stale entries every 5 min to prevent unbounded growth
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

const MAX_BUCKET_SIZE = 50_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  authBuckets.forEach((v, k) => { if (now - v.start > AUTH_WINDOW) authBuckets.delete(k); });
  apiBuckets.forEach((v, k) =>  { if (now - v.start > API_WINDOW)  apiBuckets.delete(k); });
}

function isRateLimited(
  buckets: Map<string, RateWindow>,
  key: string,
  limit: number,
  window: number,
): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.start > window) {
    // Hard cap: reject new IPs if map is full (prevents memory exhaustion under DDoS)
    if (!bucket && buckets.size >= MAX_BUCKET_SIZE) {
      return { limited: true, retryAfter: 60 };
    }
    buckets.set(key, { count: 1, start: now });
    return { limited: false, retryAfter: 0 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.start + window - now) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false, retryAfter: 0 };
}

// Auth routes that need strict rate limiting
const AUTH_PATHS = new Set([
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/verify-email/resend',
  '/api/auth/check-credentials',
  '/api/auth/2fa/challenge',
]);

/**
 * Routes to skip entirely. Each has its own limiter or is auth-protected
 * upstream, so applying the middleware bucket here would either double-
 * count (chat) or block legitimate access (admin / cron).
 *
 * Exported so unit tests can lock in the skip-list without needing a
 * real NextRequest. Keep this small + explicit — any new addition is a
 * security decision (we're disabling DDoS protection for that path).
 */
export function shouldSkip(path: string): boolean {
  if (path === '/api/chat') return true;             // has own rate limiter
  if (path.startsWith('/api/admin/')) return true;   // auth-protected
  if (path.startsWith('/api/cron/')) return true;    // internal cron
  if (path === '/api/telegram/webhook') return true; // telegram bot webhook
  return false;
}

// Exported for testing — the bare AUTH_PATHS set is the contract that
// shouldStrictBucket reads against the moderate bucket fall-through.
export { AUTH_PATHS };

// Max query string length — reject absurdly long params to prevent abuse
const MAX_QUERY_LENGTH = 512;

// ---------------------------------------------------------------------------
// Auth wall — pages that DON'T require authentication
// ---------------------------------------------------------------------------

// Auth wall removed — all pages are public, auth is handled per-page via soft gates.

// ---------------------------------------------------------------------------
// Public API v1 — lightweight middleware (Edge-compatible)
// Auth + rate limiting happens in route handlers via v1-auth.ts (Node.js)
// ---------------------------------------------------------------------------

// Exported for unit tests — locks in the no-key 401 contract
// (status + X-Fee-Model-Version + X-Fee-Model-Updated-At headers).
export function handleV1Route(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname;

  // /api/v1/status is free — no auth required
  if (path === '/api/v1/status') return NextResponse.next();

  // /api/v1/openapi serves the public OpenAPI 3.1 spec — public by design
  // so Swagger UI / Postman / codegen tools can fetch it anonymously
  if (path === '/api/v1/openapi') return NextResponse.next();

  // Key management endpoints use session auth, not API key
  if (path.startsWith('/api/v1/keys')) return NextResponse.next();

  // Basic Bearer token format check (fast, Edge-compatible)
  // Full validation + rate limiting happens in route handlers
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.match(/^Bearer\s+ih_.+$/i)) {
    // Emit X-Fee-Model-* on this short-circuit 401 too — without these,
    // partners doing cheap HEAD-based version polling against an
    // unauthenticated endpoint miss schedule bumps until they renew
    // their key. The route-handler 401 path (v1-auth.ts) sets these
    // explicitly via .set() for the same reason; the middleware short-
    // circuit was the missing surface (verified live May 2026).
    const noKeyRes = NextResponse.json(
      { success: false, error: 'API key required. Pass Authorization: Bearer ih_xxx' },
      { status: 401 },
    );
    noKeyRes.headers.set('WWW-Authenticate', 'Bearer realm="InfoHub API"');
    noKeyRes.headers.set('X-Fee-Model-Version', FEE_MODEL_VERSION);
    noKeyRes.headers.set('X-Fee-Model-Updated-At', FEE_MODEL_UPDATED_AT);
    return noKeyRes;
  }

  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

// Affiliate-cookie max-age. 90 days = 90 * 24 * 3600 = 7,776,000 seconds.
// Bumped from the standard 60d because our biggest creator partners
// (newsletter/podcast audiences) have longer funnels — a reader might
// see a recommendation, sit on it for 6-8 weeks, then sign up. Costs
// us nothing at our volume and gives creators meaningful credit for
// slow conversions. Notion / ConvertKit / Stripe Atlas use similar
// windows.
const REFERRAL_COOKIE_NAME = 'ih_ref';
const REFERRAL_COOKIE_MAX_AGE_SEC = 90 * 24 * 3600;

/**
 * If the URL carries `?ref=CODE`, stamp a long-lived cookie so signup
 * can attribute the user even if they wander off + come back later.
 * Returns a response with the cookie set, or null when there's nothing
 * to do (no `?ref=`, or cookie already set with the same value).
 *
 * Validation here is loose (alphanumeric, ≤16 chars) — the actual code
 * resolution against the users table happens server-side at signup, so
 * a garbage cookie just no-ops there.
 */
function handleReferralCookie(request: NextRequest): NextResponse | null {
  const ref = request.nextUrl.searchParams.get('ref');
  if (!ref) return null;
  // Only accept the alphabet our codes are drawn from + a sane length.
  if (!/^[A-Z0-9]{4,16}$/i.test(ref)) return null;
  const upper = ref.toUpperCase();
  const existing = request.cookies.get(REFERRAL_COOKIE_NAME)?.value;
  if (existing === upper) return null; // already attributed — don't reset clock
  const res = NextResponse.next();
  res.cookies.set({
    name: REFERRAL_COOKIE_NAME,
    value: upper,
    maxAge: REFERRAL_COOKIE_MAX_AGE_SEC,
    httpOnly: false,    // readable by the /signup form so it can include in the body
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Affiliate referral cookie — runs on every request so we catch landings
  // on any page (not just /). Stamps the cookie once and falls through; the
  // signup route reads it server-side and stamps users.referred_by_user_id.
  const refRes = handleReferralCookie(request);
  if (refRes && !pathname.startsWith('/api/')) {
    // Non-API path: ship the response with the cookie set + skip the
    // API rate-limit branches below.
    return refRes;
  }

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (shouldSkip(pathname)) return NextResponse.next();

  // Public API v1 — separate auth flow
  if (pathname.startsWith('/api/v1/')) {
    return handleV1Route(request);
  }

  // Input length guard — reject query strings > 512 chars
  if (search.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: 'Query string too long' },
      { status: 400 },
    );
  }

  cleanup();

  // Prefer x-real-ip (set by upstream proxy/load balancer, not spoofable) over
  // x-forwarded-for (client-controlled leftmost value). On DO App Platform this
  // is set by the platform's edge router; behind Cloudflare proxy (orange cloud)
  // prefer cf-connecting-ip if added in future.
  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  // Auth WRITE routes — strict limits + no-store cache.
  // Read-only NextAuth endpoints (/api/auth/session, /csrf, /providers) are
  // hit on every page load by useSession() — they MUST fall through to the
  // moderate API bucket below, otherwise normal browsing trips the 5/15min
  // limiter and breaks the whole app with auth errors.
  const isAuthWrite =
    AUTH_PATHS.has(pathname)
    || (pathname.startsWith('/api/auth/')
        && request.method !== 'GET'
        && request.method !== 'HEAD'
        && request.method !== 'OPTIONS');
  if (isAuthWrite) {
    const key = `auth:${ip}`;
    const { limited, retryAfter } = isRateLimited(authBuckets, key, AUTH_LIMIT, AUTH_WINDOW);
    if (limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'Cache-Control': 'no-store',
            'X-RateLimit-Limit': String(AUTH_LIMIT),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
          },
        },
      );
    }

    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  // All other API routes — moderate limits
  const key = `api:${ip}`;
  const { limited, retryAfter } = isRateLimited(apiBuckets, key, API_LIMIT, API_WINDOW);

  if (limited) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(API_LIMIT),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
        },
      },
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next();
  const updatedBucket = apiBuckets.get(key);
  const remaining = updatedBucket ? Math.max(0, API_LIMIT - updatedBucket.count) : API_LIMIT;
  const resetAt = updatedBucket ? Math.ceil((updatedBucket.start + API_WINDOW) / 1000) : Math.ceil(Date.now() / 1000) + 60;
  response.headers.set('X-RateLimit-Limit', String(API_LIMIT));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(resetAt));

  return response;
}

// Match ALL routes now (not just /api/*) for the auth wall
export const config = {
  matcher: [
    /*
     * Match all request paths except static files:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
