export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initDB, isDBConfigured, getBulkFundingHistory } from '@/lib/db';

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get('symbols');
  const days = Math.min(Number(request.nextUrl.searchParams.get('days')) || 7, 90);

  if (!symbolsParam) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  const symbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50); // cap at 50 symbols

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await initDB();
    const resultMap = await getBulkFundingHistory(symbols, days);

    // Convert Map to plain object for JSON serialization
    const data: Record<string, Array<{ day: string; rate: number }>> = {};
    resultMap.forEach((points, sym) => {
      data[sym] = points;
    });

    return NextResponse.json(
      { symbols, days, data },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } },
    );
  } catch (e) {
    console.error('[history/funding-bulk] error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
