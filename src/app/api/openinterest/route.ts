import { NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { oiFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const [{ data, health }, top500] = await Promise.all([
    fetchAllExchangesWithHealth(oiFetchers, fetchWithTimeout),
    getTop500Symbols(),
  ]);

  const filtered = data.filter(r => isTop500Symbol(r.symbol, top500));

  return NextResponse.json({
    data: filtered,
    health,
    meta: {
      totalExchanges: oiFetchers.length,
      activeExchanges: health.filter(h => h.status === 'ok').length,
      totalEntries: filtered.length,
      timestamp: Date.now(),
    },
  });
}
