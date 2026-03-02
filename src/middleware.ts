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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (shouldSkip(pathname)) return NextResponse.next();

  cleanup();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  // Auth routes — strict limits + no-store cache
  if (AUTH_PATHS.has(pathname) || pathname.startsWith('/api/auth/')) {
    // All auth responses must never be cached
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store');

    if (AUTH_PATHS.has(pathname)) {
      const key = `auth:${ip}`;
      const { limited, retryAfter } = isRateLimited(authBuckets, key, AUTH_LIMIT, AUTH_WINDOW);
      if (limited) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } },
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
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
