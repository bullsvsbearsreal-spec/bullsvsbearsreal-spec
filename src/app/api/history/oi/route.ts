/**
 * GET /api/history/oi?symbol=BTC&days=7
 *
 * Returns historical open interest data from the database.
 * Aggregated by sum across all exchanges per timestamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOIHistory, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const days = Math.min(parseInt(searchParams.get('days') || '7') || 7, 90);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const points = await getOIHistory(symbol, days);

  return NextResponse.json({
    symbol,
    days,
    points,
    count: points.length,
  });
}
