/**
 * GET /api/history/liquidations?symbol=BTC&days=7
 * GET /api/history/liquidations?mode=top&days=1&limit=20
 * GET /api/history/liquidations?symbol=BTC&mode=exchanges&days=7
 * GET /api/history/liquidations?mode=treemap&hours=4&limit=30
 * GET /api/history/liquidations?mode=feed&hours=12&limit=200&exchange=binance&side=long
 *
 * Returns historical liquidation data from the database.
 *
 * Modes:
 * - default: Hourly-bucketed liquidation history for a symbol (value, count, long/short breakdown)
 * - top: Top liquidated symbols by total value
 * - exchanges: Per-exchange breakdown for a symbol
 * - treemap: Aggregated liquidation data grouped by symbol for treemap visualization
 * - feed: Individual liquidation events with optional exchange/side filters
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isDBConfigured,
  getLiquidationHistory,
  getLiquidationsByExchange,
  getTopLiquidatedSymbols,
  getLiquidationTreemap,
  getLiquidationFeedFiltered,
} from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
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

  // Treemap mode — aggregated by symbol for treemap visualization
  if (mode === 'treemap') {
    const hours = Math.min(parseInt(searchParams.get('hours') || '1') || 1, 72);
    const treemapLimit = Math.min(parseInt(searchParams.get('limit') || '30') || 30, 100);
    const data = await getLiquidationTreemap(hours, treemapLimit);
    return NextResponse.json({ mode: 'treemap', hours, data, count: data.length }, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
    });
  }

  // Feed mode — individual events across all symbols with optional filters
  if (mode === 'feed') {
    const hours = Math.min(parseInt(searchParams.get('hours') || '1') || 1, 72);
    const feedLimit = Math.min(parseInt(searchParams.get('limit') || '500') || 500, 2000);
    const exchange = searchParams.get('exchange') || undefined;
    const sideParam = searchParams.get('side');
    const validSide = sideParam === 'long' || sideParam === 'short' ? sideParam : undefined;
    const data = await getLiquidationFeedFiltered(hours, feedLimit, exchange, validSide);
    return NextResponse.json({ mode: 'feed', hours, data, count: data.length }, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
    });
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
