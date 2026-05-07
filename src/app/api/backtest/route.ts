/**
 * POST /api/backtest
 *
 * Run a strategy backtest. Body shape:
 *   { strategy: 'dca' | 'funding-carry', config: {...} }
 *
 * Returns BacktestResult with daily series for charting.
 *
 * No auth — backtests are pure math on public data, useful for marketing
 * + sharing. 1-min in-process cache keyed by full request body so click-
 * spamming doesn't hammer CoinGecko / our DB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runDcaBacktest, runFundingCarryBacktest } from '@/lib/backtest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const cache = new Map<string, { ts: number; body: any }>();
const TTL = 60_000;

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cacheKey = JSON.stringify(body);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  try {
    let result;
    if (body.strategy === 'dca') {
      result = await runDcaBacktest({
        asset: String(body.config?.asset ?? 'bitcoin'),
        amountUsd: Number(body.config?.amountUsd) || 100,
        intervalDays: Number(body.config?.intervalDays) || 7,
        lookbackDays: Number(body.config?.lookbackDays) || 90,
      });
    } else if (body.strategy === 'funding-carry') {
      result = await runFundingCarryBacktest({
        notionalUsd: Number(body.config?.notionalUsd) || 10_000,
        lookbackDays: Number(body.config?.lookbackDays) || 30,
        symbol: body.config?.symbol ? String(body.config.symbol).toUpperCase() : undefined,
      });
    } else {
      return NextResponse.json({ error: 'Unknown strategy. Use "dca" or "funding-carry"' }, { status: 400 });
    }

    const responseBody = { success: true, result };
    cache.set(cacheKey, { ts: Date.now(), body: responseBody });
    if (cache.size > 50) {
      // Trim oldest
      const oldest = Array.from(cache.entries()).sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) cache.delete(oldest[0]);
    }

    return NextResponse.json(responseBody, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    console.error('backtest error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Backtest failed' },
      { status: 500 },
    );
  }
}
