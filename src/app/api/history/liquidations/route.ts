/**
 * GET /api/history/liquidations?symbol=BTC&days=7
 * GET /api/history/liquidations?mode=top&days=1&limit=20
 * GET /api/history/liquidations?symbol=BTC&mode=exchanges&days=7
 *
 * Returns historical liquidation data from the database.
 *
 * Modes:
 * - default: Hourly-bucketed liquidation history for a symbol (value, count, long/short breakdown)
 * - top: Top liquidated symbols by total value
 * - exchanges: Per-exchange breakdown for a symbol
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isDBConfigured,
  getLiquidationHistory,
  getLiquidationsByExchange,
  getTopLiquidatedSymbols,
} from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const mode = searchParams.get('mode') || 'history';
  const days = Math.min(parseInt(searchParams.get('days') || '7') || 7, 90);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 50);

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  // Top liquidated symbols — no symbol required
  if (mode === 'top') {
    const data = await getTopLiquidatedSymbols(days, limit);
    return NextResponse.json({
      mode: 'top',
      days,
      data,
      count: data.length,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  // All other modes require symbol
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  if (mode === 'exchanges') {
    const data = await getLiquidationsByExchange(symbol, days);
    return NextResponse.json({
      symbol,
      mode: 'exchanges',
      days,
      data,
      count: data.length,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  // Default: hourly history
  const points = await getLiquidationHistory(symbol, days);
  return NextResponse.json({
    symbol,
    mode: 'history',
    days,
    points,
    count: points.length,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
