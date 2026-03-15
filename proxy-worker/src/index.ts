/**
 * InfoHub Proxy Worker
 *
 * Forwards API requests to CloudFlare-blocked exchanges (BitMEX, Gate.io, BloFin).
 * Cloudflare Workers use residential-class IPs, bypassing datacenter IP blocks.
 *
 * Usage: GET https://<worker>.workers.dev?url=<encoded_target_url>
 */

interface Env {
  ALLOWED_ORIGINS: string;
  ALLOWED_TARGETS: string;
}

// Browser-like headers to avoid bot detection
// NOTE: Do NOT set Accept-Encoding — Workers fetch() handles decompression
// automatically, and setting it explicitly causes raw gzip to pass through.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// Rate limiting: simple in-memory counter per IP (resets on worker restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 300;        // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Periodic cleanup of stale rate limit entries
function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only allow GET requests
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Rate limit by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return json({ error: 'Rate limited' }, 429);
    }

    // Periodic cleanup (every ~100 requests)
    if (Math.random() < 0.01) cleanupRateLimits();

    // Parse target URL from ?url= parameter
    const reqUrl = new URL(request.url);
    const targetUrl = reqUrl.searchParams.get('url');
    if (!targetUrl) {
      return json({ error: 'Missing ?url= parameter' }, 400);
    }

    // Validate target URL
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return json({ error: 'Invalid URL' }, 400);
    }

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return json({ error: 'Only HTTPS targets allowed' }, 400);
    }

    // Check target domain against allowlist
    const allowedTargets = new Set(env.ALLOWED_TARGETS.split(',').map(s => s.trim()));
    if (!allowedTargets.has(parsed.hostname)) {
      return json({ error: `Domain not allowed: ${parsed.hostname}` }, 403);
    }

    // Forward the request
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: BROWSER_HEADERS,
      });

      // Read the full response body (this ensures decompression happens)
      const body = await response.text();

      // Build response with CORS headers
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'application/json');
      responseHeaders.set('Cache-Control', 'no-store');

      // CORS
      const origin = request.headers.get('Origin') || '';
      const allowedOrigins = new Set(env.ALLOWED_ORIGINS.split(',').map(s => s.trim()));
      if (allowedOrigins.has(origin) || allowedOrigins.has('*')) {
        responseHeaders.set('Access-Control-Allow-Origin', origin);
      }

      return new Response(body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return json({ error: `Proxy fetch failed: ${message}` }, 502);
    }
  },
};

function handleCORS(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = new Set(env.ALLOWED_ORIGINS.split(',').map(s => s.trim()));
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allowedOrigins.has(origin) || allowedOrigins.has('*')) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return new Response(null, { status: 204, headers });
}

function json(data: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
