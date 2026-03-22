export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getSpreadHistory } from '@/lib/db';

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get('symbol') || 'BTC').toUpperCase();
  const days = Math.min(Number(request.nextUrl.searchParams.get('days')) || 7, 90);

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const history = await getSpreadHistory(symbol, days);

    return NextResponse.json(
      { symbol, days, data: history, count: history.length },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } },
    );
  } catch (e) {
    console.error('[history/spreads] error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
