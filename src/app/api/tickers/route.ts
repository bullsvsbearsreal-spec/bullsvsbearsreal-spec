import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { fetchAllExchanges } from '../_shared/exchange-fetchers';
import { tickerFetchers } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const results = await fetchAllExchanges(tickerFetchers, fetchWithTimeout);
  return NextResponse.json(results);
}
