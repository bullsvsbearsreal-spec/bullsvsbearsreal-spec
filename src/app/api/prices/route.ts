import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'bom1';

const AGGREGATOR = 'http://46.101.247.54:3100';

// Thin proxy to the VPS price aggregator — avoids mixed content (HTTPS→HTTP).
// Cached at the edge for 5s with up-to-15s SWR — this route is hit on
// most page loads, and `no-store` would force every user to round-trip
// to FRA1 (CLAUDE.md prohibits no-store on public, non-personalised
// routes). 5s is short enough that prices stay fresh; SWR ensures a
// burst of users on a popular page doesn't all hit the upstream.
export async function GET(req: NextRequest) {
  const rawSymbol = req.nextUrl.searchParams.get('symbol') || '';
  const symbol = /^[A-Za-z0-9,]+$/.test(rawSymbol) ? rawSymbol : '';
  const url = symbol ? `${AGGREGATOR}/prices?symbol=${symbol}` : `${AGGREGATOR}/prices`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'Aggregator unavailable' }, { status: 502 });
    const data = await r.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Aggregator timeout' }, { status: 504 });
  }
}
