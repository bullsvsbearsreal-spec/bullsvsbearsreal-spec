import { NextRequest, NextResponse } from 'next/server';

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

// Routes to skip entirely (have own limiters or are auth-protected)
function shouldSkip(path: string): boolean {
  if (path === '/api/chat') return true;             // has own rate limiter
  if (path.startsWith('/api/admin/')) return true;   // auth-protected
  if (path.startsWith('/api/cron/')) return true;    // internal cron
  if (path === '/api/telegram/webhook') return true; // webhook
  return false;
}

// Max query string length — reject absurdly long params to prevent abuse
const MAX_QUERY_LENGTH = 512;

// ---------------------------------------------------------------------------
// Auth wall — pages that DON'T require authentication
// ---------------------------------------------------------------------------

const PUBLIC_PAGES = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/faq',
  '/team',
  '/brand',
  '/referrals',
  '/api-docs',
  '/guides',
  '/trailer',
]);

// Prefixes that are always public (static assets, next internals)
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/api/')) return true;       // API has its own auth
  if (pathname.startsWith('/exchanges/')) return true;  // static logos
  if (pathname.startsWith('/icons/')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname === '/robots.txt') return true;
  if (pathname === '/sitemap.xml') return true;
  if (pathname.endsWith('.png') || pathname.endsWith('.svg') || pathname.endsWith('.ico')) return true;
  return false;
}

/**
 * Check if user has a valid session cookie.
 * NextAuth v5 JWT strategy uses:
 *   - Production (HTTPS): __Secure-next-auth.session-token
 *   - Development (HTTP):  next-auth.session-token
 */
function hasSessionCookie(request: NextRequest): boolean {
  return !!(
    request.cookies.get('__Secure-next-auth.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('authjs.session-token')?.value
  );
}

// ---------------------------------------------------------------------------
// Public API v1 — lightweight middleware (Edge-compatible)
// Auth + rate limiting happens in route handlers via v1-auth.ts (Node.js)
// ---------------------------------------------------------------------------

function handleV1Route(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname;

  // /api/v1/status is free — no auth required
  if (path === '/api/v1/status') return NextResponse.next();

  // Key management endpoints use session auth, not API key
  if (path.startsWith('/api/v1/keys')) return NextResponse.next();

  // Basic Bearer token format check (fast, Edge-compatible)
  // Full validation + rate limiting happens in route handlers
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.match(/^Bearer\s+ih_.+$/i)) {
    return NextResponse.json(
      { success: false, error: 'API key required. Pass Authorization: Bearer ih_xxx' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="InfoHub API"' } },
    );
  }

  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ── Auth wall: redirect unauthenticated users to login ──
  if (!isPublicPath(pathname) && !hasSessionCookie(request)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname + search);
    return NextResponse.redirect(loginUrl);
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

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  // Auth routes — strict limits + no-store cache
  if (AUTH_PATHS.has(pathname) || pathname.startsWith('/api/auth/')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store');

    if (AUTH_PATHS.has(pathname)) {
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
    }

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
    '/((?!_next/static|_next/image).*)',
  ],
};
