/**
 * GET /api/liquidations/aggregate?hours=24&limit=30
 *
 * Site-wide liquidation totals, DB-backed. Used by the homepage heatmap widget
 * to hydrate on mount so fresh visitors see real numbers, not an empty WebSocket
 * window. The widget then merges live WS events on top.
 *
 * Returns per-symbol + combined totals over the chosen rolling window.
 * Cache: 30s (DB is updated every minute by the cron).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, getLiquidationTreemap } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface AggregatedSymbol {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}

interface AggregateResponse {
  symbols: AggregatedSymbol[];
  totals: {
    totalValue: number;
    longValue: number;
    shortValue: number;
    longPct: number;
    count: number;
    exchanges: string[];
  };
  meta: {
    windowHours: number;
    source: 'db' | 'empty';
    timestamp: number;
  };
}

const cache = new Map<string, { body: AggregateResponse; ts: number }>();
const CACHE_TTL = 30_000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const hours = Math.min(168, Math.max(1, parseInt(searchParams.get('hours') || '24', 10) || 24));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30));

  const cacheKey = `liq-agg:${hours}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  if (!isDBConfigured()) {
    const empty: AggregateResponse = {
      symbols: [],
      totals: { totalValue: 0, longValue: 0, shortValue: 0, longPct: 50, count: 0, exchanges: [] },
      meta: { windowHours: hours, source: 'empty', timestamp: Date.now() },
    };
    return NextResponse.json(empty);
  }

  try {
    // Skip initDB() on the hot path — it's idempotent but adds cold-start latency.
    // The liquidations table is already created by other routes.
    // Single DB round-trip: top symbols with aggregated totals. Limit to 100
    // — more than enough for the widget, keeps the query bounded.
    const queryLimit = Math.max(limit, 100);
    const allSymbols = await getLiquidationTreemap(hours, queryLimit);
    const symbols = allSymbols.slice(0, limit);

    // Global totals across ALL queried symbols
    const totalValue = allSymbols.reduce((s, r) => s + r.totalValue, 0);
    const longValue = allSymbols.reduce((s, r) => s + r.longValue, 0);
    const shortValue = allSymbols.reduce((s, r) => s + r.shortValue, 0);
    const count = allSymbols.reduce((s, r) => s + r.count, 0);
    const longPct = totalValue > 0 ? (longValue / totalValue) * 100 : 50;

    // Exchange list is intentionally empty here — the widget already derives
    // live connection state from its own WebSockets, we don't need another DB
    // round-trip for this.
    const exchangesSet = new Set<string>();

    const body: AggregateResponse = {
      symbols,
      totals: {
        totalValue,
        longValue,
        shortValue,
        longPct,
        count,
        exchanges: Array.from(exchangesSet),
      },
      meta: { windowHours: hours, source: 'db', timestamp: Date.now() },
    };

    // Only pin cache when we have liquidations. Was: cached
    // `{symbols: [], totals: {totalValue: 0}}` for 30s when the
    // DB had no recent liq data (cron lag or table just got pruned).
    // CommandCenter showed "$0 vaporized" until cache expired.
    if (symbols.length > 0) {
      cache.set(cacheKey, { body, ts: Date.now() });
    }
    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': symbols.length > 0
          ? 'public, s-maxage=30, stale-while-revalidate=120'
          : 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[liquidations/aggregate] error:', msg);
    return NextResponse.json({ error: msg, symbols: [], totals: { totalValue: 0 } }, { status: 502 });
  }
}
