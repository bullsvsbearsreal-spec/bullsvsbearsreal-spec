import { NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { fundingFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'sin1';

export async function GET() {
  const [{ data, health }, top500] = await Promise.all([
    fetchAllExchangesWithHealth(fundingFetchers, fetchWithTimeout),
    getTop500Symbols(),
  ]);

  const filtered = data.filter(r => isTop500Symbol(r.symbol, top500));

  return NextResponse.json({
    data: filtered,
    health,
    meta: {
      totalExchanges: fundingFetchers.length,
      activeExchanges: health.filter(h => h.status === 'ok').length,
      totalEntries: filtered.length,
      timestamp: Date.now(),
    },
  });
}
