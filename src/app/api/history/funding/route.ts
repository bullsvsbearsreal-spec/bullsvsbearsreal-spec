/**
 * GET /api/history/funding?symbol=BTC&exchange=Binance&days=30
 *
 * Returns historical funding rate data from the database.
 * If no exchange specified, returns average across all exchanges.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundingHistory, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const exchange = searchParams.get('exchange') || undefined;
  const days = Math.min(parseInt(searchParams.get('days') || '30') || 30, 90);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const points = await getFundingHistory(symbol, exchange, days);

  return NextResponse.json({
    symbol,
    exchange: exchange || 'all',
    days,
    points,
    count: points.length,
  });
}
