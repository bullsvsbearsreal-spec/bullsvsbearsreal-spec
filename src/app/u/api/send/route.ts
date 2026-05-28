/**
 * POST /u/api/send
 *
 * Same-origin Umami collect endpoint. Replaces the raw `/u/api/send →
 * analytics.info-hub.io/api/send` rewrite that previously lived in
 * next.config.js, which was a fully open relay (anyone could POST and
 * inject fake page-view events into our Umami stats — there's no auth
 * on Umami's public /api/send by design, since it's the equivalent of
 * Google Analytics' /collect, intended for browser tracker scripts).
 *
 * What this handler adds:
 *   1. Origin guard — must match our own host (or be empty, which some
 *      browsers omit on simple same-origin POSTs).
 *   2. Per-IP rate limit — 60 req/min. A real user fires ~1 page-view
 *      every few seconds; 60/min is generous enough to never trip a
 *      live human but tight enough to cap an attacker's pollution
 *      rate.
 *   3. X-Forwarded-For preservation — Umami's GeoIP lookup reads the
 *      leftmost XFF entry, so we pin it to the real client IP rather
 *      than letting Umami see our droplet's IP and geolocate every
 *      visit to Frankfurt.
 *
 * Why not authenticate? The tracker script runs in every visitor's
 * browser with zero credentials by design — that's the point of a
 * public collection endpoint. Server-side guards are the only place
 * the validation can live.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UMAMI_HOST = process.env.UMAMI_HOST || process.env.NEXT_PUBLIC_UMAMI_HOST || '';

// Per-IP token bucket. Module-scoped so it survives across requests
// in the same Node worker. Each entry resets after WINDOW_MS.
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_MIN = 60;
const WINDOW_MS = 60_000;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_MIN) return false;
  bucket.count++;
  return true;
}

// Periodic GC so the bucket map doesn't grow unboundedly under a long
// tail of one-off IPs. Triggered every 100 requests, sweeps any
// expired entries. Cheap relative to the network round-trip it precedes.
let gcCounter = 0;
function maybeGc() {
  if (++gcCounter % 100 !== 0) return;
  const now = Date.now();
  const stale: string[] = [];
  buckets.forEach((b, ip) => { if (b.resetAt < now) stale.push(ip); });
  stale.forEach(ip => buckets.delete(ip));
}

export async function POST(req: NextRequest) {
  if (!UMAMI_HOST) {
    // Analytics not configured. Return 204 (success-no-content) so the
    // tracker doesn't retry, but skip the work.
    return new NextResponse(null, { status: 204 });
  }

  // Origin guard — must be our own host, or absent (browsers omit
  // Origin on certain simple same-origin POSTs). Bots that send a
  // foreign Origin get a 403; bots that strip Origin entirely fall
  // through to the rate limiter, which caps their pollution rate.
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const u = new URL(origin);
      const host = req.headers.get('host') || '';
      const allowed =
        u.host === host ||
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1';
      if (!allowed) {
        return new NextResponse(null, { status: 403 });
      }
    } catch {
      return new NextResponse(null, { status: 400 });
    }
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return new NextResponse(null, { status: 429 });
  }
  maybeGc();

  try {
    const body = await req.text();
    const userAgent = req.headers.get('user-agent') || '';
    const contentType = req.headers.get('content-type') || 'application/json';

    const res = await fetch(`${UMAMI_HOST}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'User-Agent': userAgent,
        // Pin the real client IP for Umami's GeoIP lookup — otherwise
        // every visit geolocates to our droplet's IP.
        'X-Forwarded-For': ip,
      },
      body,
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'text/plain',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
