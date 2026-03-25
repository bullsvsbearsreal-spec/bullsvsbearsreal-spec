import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGGREGATOR = 'http://46.101.247.54:3100';

// Thin proxy to the VPS price aggregator — avoids mixed content (HTTPS→HTTP)
// No caching — the aggregator serves fresh data every request
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || '';
  const url = symbol ? `${AGGREGATOR}/prices?symbol=${symbol}` : `${AGGREGATOR}/prices`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'Aggregator unavailable' }, { status: 502 });
    const data = await r.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Access-Control-Allow-Origin': '*' },
    });
  } catch {
    return NextResponse.json({ error: 'Aggregator timeout' }, { status: 504 });
  }
}
