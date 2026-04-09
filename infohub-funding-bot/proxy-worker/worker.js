/**
 * Cloudflare Worker proxy for InfoHub funding bot.
 * Proxies requests to CloudFlare-blocked exchange APIs (BitMEX, Gate.io, HTX, edgeX).
 *
 * Usage: GET https://<worker>.workers.dev/?url=<encoded_target_url>
 *
 * Requests originate from within Cloudflare's network so they bypass
 * datacenter IP bot-detection that blocks DigitalOcean/Vercel IPs.
 *
 * Deploy: cd proxy-worker && npx wrangler deploy
 */

// Only allow proxying to these exchange API domains
const ALLOWED_DOMAINS = new Set([
  'www.bitmex.com',
  'api.gateio.ws',
  'api.hbdm.com',           // HTX
  'pro.edgex.exchange',
  'fapi.binance.com',       // Binance (backup if geo-blocked)
  'dapi.binance.com',       // Binance COIN-M
  'fapi.binance.me',
  'api.bybit.com',          // Bybit (backup if geo-blocked)
  'api.bytick.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'omni-client-api.prod.ap-northeast-1.variational.io', // Variational
]);

// Simple shared secret to prevent open-proxy abuse
// Set via: npx wrangler secret put PROXY_SECRET
// Then pass as ?secret=<value> or Authorization: Bearer <value>

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Only GET requests allowed' }, 405);
    }

    const reqUrl = new URL(request.url);

    // Auth check (optional but recommended)
    if (env.PROXY_SECRET) {
      const secret = reqUrl.searchParams.get('secret')
        || request.headers.get('Authorization')?.replace('Bearer ', '');
      if (secret !== env.PROXY_SECRET) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    // Get target URL
    const targetUrl = reqUrl.searchParams.get('url');
    if (!targetUrl) {
      return jsonResponse({
        error: 'Missing ?url= parameter',
        usage: 'GET /?url=<encoded_target_url>',
        allowed_domains: [...ALLOWED_DOMAINS],
      }, 400);
    }

    // Validate domain
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return jsonResponse({ error: 'Invalid URL' }, 400);
    }

    if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
      return jsonResponse({
        error: `Domain not allowed: ${parsed.hostname}`,
        allowed: [...ALLOWED_DOMAINS],
      }, 403);
    }

    // Proxy the request with browser-like headers
    try {
      const proxyResponse = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive',
        },
        cf: {
          // Cloudflare-specific options to avoid caching stale data
          cacheTtl: 0,
          cacheEverything: false,
        },
      });

      // Clone response with CORS headers
      const body = await proxyResponse.arrayBuffer();
      return new Response(body, {
        status: proxyResponse.status,
        headers: {
          'Content-Type': proxyResponse.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Proxied-From': parsed.hostname,
          'X-Proxy-Status': proxyResponse.status.toString(),
        },
      });
    } catch (err) {
      return jsonResponse({
        error: 'Proxy fetch failed',
        detail: err.message,
        target: parsed.hostname,
      }, 502);
    }
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
