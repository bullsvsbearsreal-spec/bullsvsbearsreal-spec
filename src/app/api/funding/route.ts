import { NextResponse } from 'next/server';
import { fetchWithTimeout, getTop500Symbols, isTop500Symbol } from '../_shared/fetch';
import { fetchAllExchanges } from '../_shared/exchange-fetchers';
import { fundingFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'sin1';

export async function GET() {
  const [results, top500] = await Promise.all([
    fetchAllExchanges(fundingFetchers, fetchWithTimeout),
    getTop500Symbols(),
  ]);
  const filtered = results.filter(r => isTop500Symbol(r.symbol, top500));
  return NextResponse.json(filtered);
}
