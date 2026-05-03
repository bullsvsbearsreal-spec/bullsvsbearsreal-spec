/**
 * GET /api/gmx-markets?chain=arbitrum
 *
 * Returns the list of active GMX V2 markets for a given chain, in a compact
 * shape suitable for populating a filter dropdown on the traders page.
 * Wraps the shared markets resolver so the 1h cache is reused.
 *
 * Response shape:
 *   { markets: Array<{ address, symbol, name, pair, isDeprecated }>, chain }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGMXMarkets } from '@/lib/gmx/markets';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const chainRaw = (request.nextUrl.searchParams.get('chain') || 'arbitrum').toLowerCase();
  const chain = (['arbitrum', 'avalanche'].includes(chainRaw) ? chainRaw : 'arbitrum') as 'arbitrum' | 'avalanche';

  try {
    const map = await getGMXMarkets(chain);
    const markets = Array.from(map.values())
      .filter(m => !m.isDeprecated)
      .map(m => ({
        address: m.address,
        symbol: m.symbol,
        fullName: m.fullName,
        pair: m.pair,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return NextResponse.json({ markets, chain }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg, markets: [] }, { status: 502 });
  }
}
