import { NextRequest, NextResponse } from 'next/server';

// Node.js runtime (NOT Edge) — uses AWS Lambda IPs which are less likely to be blocked
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const BITUNIX_ENDPOINTS: Record<string, string> = {
  funding: 'https://fapi.bitunix.com/api/v1/futures/market/funding_rate/batch',
  tickers: 'https://fapi.bitunix.com/api/v1/futures/market/tickers',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || 'funding';
  const url = BITUNIX_ENDPOINTS[endpoint];
  if (!url) {
    return NextResponse.json({ error: 'Unknown endpoint' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: -1, msg: err?.message || 'Proxy fetch failed', data: [] },
      { status: 502 },
    );
  }
}
