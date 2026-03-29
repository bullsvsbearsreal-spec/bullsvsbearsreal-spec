/**
 * InfoHub Proxy Worker
 *
 * Forwards API requests to CloudFlare-blocked exchanges (BitMEX, Gate.io, edgeX).
 * Cloudflare Workers use residential-class IPs, bypassing datacenter IP blocks.
 *
 * Usage: GET https://<worker>.workers.dev?url=<encoded_target_url>
 */

interface Env {
  ALLOWED_ORIGINS?: string;
  ALLOWED_TARGETS?: string;
}

// Default allowed targets if env var is missing
const DEFAULT_TARGETS = 'www.bitmex.com,api.gateio.ws,pro.edgex.exchange,query1.finance.yahoo.com,query2.finance.yahoo.com';
const DEFAULT_ORIGINS = '*';

// Browser-like headers to avoid bot detection
// NOTE: Do NOT set Accept-Encoding — Workers fetch() handles decompression
// automatically, and setting it explicitly causes raw gzip to pass through.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// Rate limiting: simple in-memory counter per IP (resets on worker restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3000;       // requests per window (edgeX alone needs ~185/call)
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

function getAllowedTargets(env: Env): Set<string> {
  const raw = env.ALLOWED_TARGETS || DEFAULT_TARGETS;
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

function getAllowedOrigins(env: Env): Set<string> {
  const raw = env.ALLOWED_ORIGINS || DEFAULT_ORIGINS;
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

function json(data: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function addCorsHeaders(responseHeaders: Headers, request: Request, env: Env): void {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = getAllowedOrigins(env);
  if (allowedOrigins.has('*') || allowedOrigins.has(origin)) {
    responseHeaders.set('Access-Control-Allow-Origin', origin || '*');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // CORS preflight
      if (request.method === 'OPTIONS') {
        const headers: Record<string, string> = {
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          'Access-Control-Allow-Origin': '*',
        };
        const origin = request.headers.get('Origin') || '';
        const allowedOrigins = getAllowedOrigins(env);
        if (allowedOrigins.has(origin) || allowedOrigins.has('*')) {
          headers['Access-Control-Allow-Origin'] = origin || '*';
        }
        return new Response(null, { status: 204, headers });
      }

      // Only allow GET requests
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
        return json({ error: 'Missing ?url= parameter', status: 'ok', worker: 'infohub-proxy' }, 400);
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
      const allowedTargets = getAllowedTargets(env);
      if (!allowedTargets.has(parsed.hostname)) {
        return json({ error: `Domain not allowed: ${parsed.hostname}` }, 403);
      }

      // Forward the request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Read the full response body (this ensures decompression happens)
        const body = await response.text();

        // Build response with CORS headers
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'application/json');
        responseHeaders.set('Cache-Control', 'no-store');
        addCorsHeaders(responseHeaders, request, env);

        return new Response(body, {
          status: response.status,
          headers: responseHeaders,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return json({ error: `Proxy fetch failed: ${message}` }, 502);
      }
    } catch (err) {
      // Top-level catch — should never reach here but prevents 1027 errors
      const message = err instanceof Error ? err.message : 'Unknown error';
      return new Response(JSON.stringify({ error: `Worker error: ${message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
