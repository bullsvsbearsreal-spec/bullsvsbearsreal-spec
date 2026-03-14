/**
 * Cloudflare Worker proxy for CloudFlare-blocked exchange APIs (BitMEX, Gate.io).
 *
 * Deploy to Cloudflare Workers (free tier: 100k requests/day):
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. cd proxy && wrangler deploy
 *
 * Then set PROXY_URL in your Vercel env vars:
 *   PROXY_URL=https://your-worker.your-subdomain.workers.dev
 *
 * Usage: GET https://your-worker.workers.dev?url=https://api.gateio.ws/api/v4/...
 */

const ALLOWED_DOMAINS = new Set([
  'www.bitmex.com',
  'api.gateio.ws',
]);

// Secret token to prevent abuse — set as env var in Cloudflare dashboard
// Then add PROXY_TOKEN to your Vercel env and append ?token=xxx to PROXY_URL

export default {
  async fetch(request, env) {
    // Only allow GET
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    // Optional token auth
    if (env.PROXY_TOKEN) {
      const token = url.searchParams.get('token');
      if (token !== env.PROXY_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Validate domain whitelist
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
      return new Response(`Domain not allowed: ${parsed.hostname}`, { status: 403 });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      // Forward the response with CORS headers
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
        },
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }
  },
};
