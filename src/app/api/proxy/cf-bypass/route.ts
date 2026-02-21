import { NextRequest, NextResponse } from 'next/server';

// Node.js runtime for external proxy support
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Allowed upstream URLs (whitelist to prevent open proxy abuse)
const ALLOWED_URLS: Record<string, string> = {
  // BitMEX
  'bitmex-instruments': 'https://www.bitmex.com/api/v1/instrument/active',
  'bitmex-funding': 'https://www.bitmex.com/api/v1/instrument?columns=symbol,fundingRate,fundingInterval,lastPrice,volume24h&filter=%7B%22state%22%3A%22Open%22%2C%22typ%22%3A%22FFWCSX%22%7D&count=500',
  // Gate.io
  'gateio-tickers': 'https://api.gateio.ws/api/v4/futures/usdt/tickers',
  'gateio-funding': 'https://api.gateio.ws/api/v4/futures/usdt/contracts',
  // Crypto.com
  'cryptocom-tickers': 'https://api.crypto.com/exchange/v1/public/get-tickers',
  'cryptocom-instruments': 'https://api.crypto.com/exchange/v1/public/get-instruments',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || '';
  const url = ALLOWED_URLS[endpoint];

  if (!url) {
    return NextResponse.json(
      { error: 'Unknown endpoint', available: Object.keys(ALLOWED_URLS) },
      { status: 400 },
    );
  }

  const proxyUrl = process.env.PROXY_URL; // e.g. http://user:pass@proxy.service.com:port

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    let res: Response;

    if (proxyUrl) {
      // Use external proxy (residential/mobile IP) to bypass CloudFlare
      // The proxy service handles the actual request routing
      const proxyTarget = new URL(proxyUrl);
      const targetUrl = new URL(url);

      // For HTTP CONNECT proxies, use undici or node-fetch with agent
      // For simple HTTPS proxies, pass through query param
      res = await fetch(`${proxyUrl.replace(/\/$/, '')}?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
        headers,
      });
    } else {
      // Direct fetch (will likely fail for CloudFlare-protected sites)
      res = await fetch(url, { signal: controller.signal, headers });
    }

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}`, blocked: res.status === 403 || res.status === 503 },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Proxy fetch failed', data: [] },
      { status: 502 },
    );
  }
}
