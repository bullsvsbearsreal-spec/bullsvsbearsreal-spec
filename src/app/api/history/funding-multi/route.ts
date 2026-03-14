export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getFundingHistoryMulti } from '@/lib/db';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const days = Math.min(Number(request.nextUrl.searchParams.get('days')) || 7, 90);

  if (!symbol) {
    return NextResponse.json({ error: 'symbol parameter required' }, { status: 400 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const exchanges = await getFundingHistoryMulti(symbol, days);

    return NextResponse.json(
      { symbol, days, exchanges },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } },
    );
  } catch (e) {
    console.error('[history/funding-multi] error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
