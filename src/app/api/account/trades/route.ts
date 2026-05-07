/**
 * GET /api/account/trades — caller's trade history.
 *
 * Authenticated. Returns recent fills sorted newest-first plus aggregate
 * stats (realised PnL, win rate, fees) and a daily PnL series for the
 * journal page chart.
 *
 * Query params:
 *   ?symbol=BTC      filter
 *   ?exchange=Hyperliquid
 *   ?limit=200       1..1000 default 200
 *   ?offset=0        pagination
 *   ?since=ts        UNIX ms — only return fills since this time
 *   ?days=90         daily-PnL chart window, 1..365 default 90
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  isDBConfigured,
  listUserTrades,
  getUserTradeStats,
  getUserDailyPnlSeries,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503, headers: NO_STORE });
  }

  const sp = request.nextUrl.searchParams;
  const symbol = sp.get('symbol')?.toUpperCase() || undefined;
  const exchange = sp.get('exchange') || undefined;
  const limit = Math.min(Math.max(parseInt(sp.get('limit') ?? '200', 10) || 200, 1), 1000);
  const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0);
  const sinceMs = sp.get('since') ? parseInt(sp.get('since') ?? '0', 10) : undefined;
  const days = Math.min(Math.max(parseInt(sp.get('days') ?? '90', 10) || 90, 1), 365);

  // Three parallel queries: row list, aggregate stats, chart series. Stats
  // and series are scoped to the whole user (ignoring filters) so the
  // header numbers are absolute even when the table is filtered.
  const [trades, stats, series] = await Promise.all([
    listUserTrades(session.user.id, { symbol, exchange, limit, offset, sinceMs }),
    getUserTradeStats(session.user.id),
    getUserDailyPnlSeries(session.user.id, days),
  ]);

  return NextResponse.json({
    success: true,
    trades,
    stats,
    series,
    meta: { symbol, exchange, limit, offset, sinceMs, days, count: trades.length },
    ts: Date.now(),
  }, { headers: NO_STORE });
}
