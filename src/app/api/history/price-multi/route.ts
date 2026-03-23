export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getPriceHistoryMulti } from '@/lib/db';

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get('symbol') || 'BTC').toUpperCase();
  const days = Math.min(Number(request.nextUrl.searchParams.get('days')) || 7, 90);

  if (!isDBConfigured()) {
    return NextResponse.json({ exchanges: {} }, { status: 200 });
  }

  try {
    await initDB();
    const exchanges = await getPriceHistoryMulti(symbol, days);

    return NextResponse.json(
      { symbol, days, exchanges },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } },
    );
  } catch (e) {
    console.error('[history/price-multi] error:', e);
    return NextResponse.json({ exchanges: {} }, { status: 200 });
  }
}
